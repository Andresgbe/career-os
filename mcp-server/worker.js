#!/usr/bin/env node
// NEXUS chat worker.
//
// Polls Supabase for chat messages written from the NEXUS web app, answers
// each one by running Claude Code locally (so it uses the user's own
// subscription, not an API key), and writes the reply back.
//
// Claude is locked to the "nexus" MCP server: it can read and write NEXUS
// data and nothing else. No Bash, no file writes, no network calls — this
// runs unattended, driven by text typed into a web form.
//
// Run it with:  npm run worker      (from mcp-server/)
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { buildContext } from "./context.js";

dotenv.config({ path: new URL(".env", import.meta.url) });

const POLL_MS = Number(process.env.NEXUS_WORKER_POLL_MS || 3000);
const TIMEOUT_MS = Number(process.env.NEXUS_WORKER_TIMEOUT_MS || 180000);

// Blast-radius limits. Even if someone got into the NEXUS account and
// started firing messages at the queue, these cap how much of the Claude
// subscription they can burn before the worker simply refuses.
const MAX_CHARS = Number(process.env.NEXUS_WORKER_MAX_CHARS || 2000);
const MAX_PER_HOUR = Number(process.env.NEXUS_WORKER_MAX_PER_HOUR || 20);
const MAX_PER_DAY = Number(process.env.NEXUS_WORKER_MAX_PER_DAY || 100);
// A message that sat in the queue for days is almost certainly not something
// the user still wants run, so it expires instead of executing on startup.
const MAX_AGE_HOURS = Number(process.env.NEXUS_WORKER_MAX_AGE_HOURS || 24);

const log = (...args) =>
  console.log(new Date().toLocaleTimeString(), ...args);

// ============================================
// SUPABASE
// ============================================

const { NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY, NEXUS_EMAIL, NEXUS_PASSWORD } =
  process.env;

if (!NEXUS_SUPABASE_URL || !NEXUS_SUPABASE_ANON_KEY || !NEXUS_EMAIL || !NEXUS_PASSWORD) {
  console.error(
    "Faltan credenciales en mcp-server/.env " +
      "(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY, NEXUS_EMAIL, NEXUS_PASSWORD)."
  );
  process.exit(1);
}

const supabase = createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});

// ============================================
// CLAUDE
// ============================================

// Attachments are written here so Claude can look at them. Read is scoped
// to the working directory, so it can't wander outside the project.
const TMP_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".tmp-attachments"
);

const SYSTEM = [
  "Sos el asistente personal de Andrés dentro de NEXUS, su herramienta personal.",
  "Respondés en español, directo y breve, como un mensaje de chat.",
  "Cada mensaje llega con un bloque CONTEXTO DE NEXUS adelante: son sus datos",
  "reales de este momento. Respondé con eso, sin volver a consultar lo que ya",
  "esté ahí y sin preguntarle nada que el bloque ya conteste.",
  "Si necesitás algo más, usá las herramientas mcp__nexus__*, que leen y escriben sus datos reales:",
  "no inventes tareas, notas ni datos, y no le preguntes lo que podés consultar.",
  "Cuando te pida anotar o cambiar algo, hacelo con la herramienta y después",
  "confirmáselo en una línea. No muestres JSON ni nombres de herramientas.",
  "Si el mensaje trae una imagen adjunta, mirala con Read, deducí qué es y",
  "archivala con mcp__nexus__file_attachment usando el chat_path que te den.",
].join(" ");

// Runs one turn of Claude Code. Without --bare it loads the user's MCP
// servers and CLAUDE.md, and signs in with their subscription.
function runClaude(prompt, sessionId, withImage = false) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format",
      "json",
      "--append-system-prompt",
      SYSTEM,
      // Only NEXUS tools are pre-approved; dontAsk denies everything else
      // that would otherwise need a human to approve it.
      "--allowedTools",
      // Read is added only when there's an image to look at. It's read-only
      // and confined to the working directory either way.
      withImage ? "mcp__nexus__*,Read" : "mcp__nexus__*",
      "--permission-mode",
      "dontAsk",
    ];
    if (sessionId) args.push("--resume", sessionId);

    // `claude` is a .cmd shim on Windows, so it needs a shell there. With a
    // shell, arguments are concatenated into one command string without
    // escaping — so the user's message NEVER goes on the command line, or a
    // message containing shell metacharacters could run commands on this
    // machine. It goes in through stdin instead, which the shell never sees.
    const child = spawn("claude", args, {
      shell: process.platform === "win32",
      windowsHide: true,
    });

    child.stdin.on("error", () => {
      // the process may have exited before we finished writing
    });
    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude no respondió en ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `claude salió con código ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve({
          text: parsed.result ?? "",
          sessionId: parsed.session_id ?? null,
          isError: parsed.is_error === true,
        });
      } catch {
        // Not JSON — hand back whatever came out so the chat shows something
        resolve({ text: stdout.trim(), sessionId: null, isError: false });
      }
    });
  });
}

// ============================================
// QUEUE
// ============================================

// The session of the most recent answered message, so the chat keeps context
async function lastSessionId(userId) {
  const { data } = await supabase
    .from("chat_messages")
    .select("session_id")
    .eq("user_id", userId)
    .eq("role", "assistant")
    .not("session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.session_id ?? null;
}

// Returns a refusal string when the message must not be run, or null when
// it's safe to spend a Claude turn on it. Every check here is about limiting
// what a compromised NEXUS account could cost, not about correctness.
async function guard(message, userId) {
  if (message.content.length > MAX_CHARS) {
    return `Mensaje demasiado largo (${message.content.length} caracteres, máximo ${MAX_CHARS}). No se ejecutó.`;
  }

  const ageHours = (Date.now() - new Date(message.created_at).getTime()) / 3600000;
  if (ageHours > MAX_AGE_HOURS) {
    return `Este mensaje llevaba ${Math.round(ageHours)} horas en cola, así que no se ejecutó. Si todavía lo querés, mandalo de nuevo.`;
  }

  const since = (hours) => new Date(Date.now() - hours * 3600000).toISOString();

  const { count: lastHour } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "assistant")
    .gte("created_at", since(1));
  if ((lastHour ?? 0) >= MAX_PER_HOUR) {
    return `Límite de seguridad alcanzado: ${MAX_PER_HOUR} respuestas en la última hora. El worker se detiene acá para no consumir tu cuenta de Claude. Si fuiste vos, esperá un rato o subí NEXUS_WORKER_MAX_PER_HOUR en mcp-server/.env.`;
  }

  const { count: lastDay } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "assistant")
    .gte("created_at", since(24));
  if ((lastDay ?? 0) >= MAX_PER_DAY) {
    return `Límite diario alcanzado: ${MAX_PER_DAY} respuestas en 24 horas. Si no fuiste vos, cambiá la contraseña de NEXUS en Supabase ahora mismo.`;
  }

  return null;
}

async function handleMessage(message, userId) {
  log(`→ "${message.content.slice(0, 60)}"`);

  // Claim it first, so a second worker instance can't take the same row
  const { error: claimErr } = await supabase
    .from("chat_messages")
    .update({ status: "running" })
    .eq("id", message.id)
    .eq("status", "pending");
  if (claimErr) {
    log("  no se pudo reclamar:", claimErr.message);
    return;
  }

  // Refuse before spending anything on Claude
  const refusal = await guard(message, userId);
  if (refusal) {
    log(`  RECHAZADO: ${refusal}`);
    await supabase.from("chat_messages").insert({
      user_id: userId,
      role: "assistant",
      content: refusal,
      status: "error",
    });
    await supabase
      .from("chat_messages")
      .update({ status: "error" })
      .eq("id", message.id);
    return;
  }

  let reply = "";
  let sessionId = null;
  let failed = false;

  let tmpFile = null;
  try {
    let prompt = message.content;

    if (message.image_path) {
      const { data: blob, error: dlErr } = await supabase.storage
        .from("chat-files")
        .download(message.image_path);
      if (dlErr) throw new Error(`no pude bajar el adjunto: ${dlErr.message}`);
      await mkdir(TMP_DIR, { recursive: true });
      tmpFile = path.join(TMP_DIR, path.basename(message.image_path));
      await writeFile(tmpFile, Buffer.from(await blob.arrayBuffer()));
      prompt =
        `${message.content}

` +
        `[Imagen adjunta. Mirala con Read en: ${tmpFile}
` +
        `Para archivarla, su chat_path es: ${message.image_path}]`;
      log(`  adjunto descargado: ${path.basename(tmpFile)}`);
    }

    // La base de conocimiento va solo en sesión nueva: una sesión
    // reanudada ya la tiene en contexto.
    const resume = await lastSessionId(userId);
    const context = await buildContext(supabase, !resume);
    prompt = `=== CONTEXTO DE NEXUS ===
${context}
=== FIN DEL CONTEXTO ===

Mensaje de Andrés:
${prompt}`;

    const result = await runClaude(prompt, resume, !!message.image_path);
    reply = result.text || "(sin respuesta)";
    sessionId = result.sessionId;
    failed = result.isError;
  } catch (err) {
    reply = `No pude responder: ${err instanceof Error ? err.message : String(err)}`;
    failed = true;
  } finally {
    // the copy only exists so Claude could look at it
    if (tmpFile) await rm(tmpFile, { force: true }).catch(() => {});
  }

  const { error: insertErr } = await supabase.from("chat_messages").insert({
    user_id: userId,
    role: "assistant",
    content: reply,
    status: failed ? "error" : "done",
    session_id: sessionId,
  });
  if (insertErr) log("  no se pudo guardar la respuesta:", insertErr.message);

  await supabase
    .from("chat_messages")
    .update({ status: failed ? "error" : "done" })
    .eq("id", message.id);

  log(`← ${failed ? "ERROR: " : ""}${reply.slice(0, 80).replace(/\n/g, " ")}`);
}

async function tick(userId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("role", "user")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    log("error consultando:", error.message);
    return;
  }
  if (data && data.length > 0) await handleMessage(data[0], userId);
}

// ============================================
// START
// ============================================

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: NEXUS_EMAIL,
  password: NEXUS_PASSWORD,
});
if (authErr) {
  console.error("No se pudo iniciar sesión en Supabase:", authErr.message);
  process.exit(1);
}

const userId = auth.user.id;
log(`Worker de NEXUS escuchando como ${auth.user.email} (cada ${POLL_MS / 1000}s)`);
log("Dejá esta ventana abierta. Ctrl+C para detenerlo.");

let running = false;
setInterval(async () => {
  if (running) return; // never overlap two runs
  running = true;
  try {
    await tick(userId);
  } catch (err) {
    log("fallo en el ciclo:", err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}, POLL_MS);
