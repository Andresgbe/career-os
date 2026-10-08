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
import { retryAfter, readableError } from "./retry.js";

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
// Cada cuánto se comprueba si Andrés detuvo el mensaje que está corriendo
const CANCEL_POLL_MS = Number(process.env.NEXUS_WORKER_CANCEL_POLL_MS || 2000);

// Cuántas veces se reintenta un mensaje que falló por algo pasajero (el
// límite de uso de Claude, la red, un timeout) antes de darlo por perdido.
const MAX_RETRIES = Number(process.env.NEXUS_WORKER_MAX_RETRIES || 8);
// Espera por defecto cuando no se puede deducir cuándo se destraba
const RETRY_MS = Number(process.env.NEXUS_WORKER_RETRY_MS || 5 * 60 * 1000);

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
// `onAbort` recibe una función para matar el proceso: el worker la usa para
// cortar cuando Andrés aprieta "Detener" en el chat.
function runClaude(prompt, sessionId, withImage = false, onAbort = null) {
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

    let aborted = false;
    if (onAbort) {
      onAbort(() => {
        aborted = true;
        child.kill();
      });
    }

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
      if (aborted) {
        resolve({ text: "", sessionId: null, isError: false, aborted: true });
        return;
      }
      if (code !== 0) {
        // Claude Code escupe un JSON enorme al fallar; lo que importa es su
        // campo `result`, que trae la frase en claro ("You've hit your
        // session limit · resets 6:10pm"). Esa frase es además la que lee
        // retryAfter() para saber hasta cuándo esperar.
        reject(new Error(readableError(stdout, stderr, code)));
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
// REINTENTOS
//
// Un mensaje solo se da por muerto cuando el problema es del mensaje. Si el
// problema es "todavía no se puede" — se llegó al tope de uso, se cayó la
// red, Claude está saturado — el mensaje vuelve a la cola y el worker se
// queda comprobando solo hasta que pueda. Andrés no reescribe nada.
// ============================================

// Hasta cuándo no vale la pena ni consultar. Mientras tanto el ciclo no
// toca la cola: no gasta turnos de Claude ni consultas.
let pausedUntil = 0;
let pausedReason = "";
// Intentos por mensaje, para no reintentar para siempre
const attempts = new Map();

function pause(until, reason) {
  pausedUntil = until;
  pausedReason = reason;
  const minutes = Math.max(1, Math.round((until - Date.now()) / 60000));
  log(`  EN ESPERA (${reason}). Reintenta solo en ~${minutes} min.`);
}

// ¿Sigue vivo este mensaje? Si Andrés apretó "Detener", la app le puso
// status "error" y acá deja de estar en "running".
async function stillRunning(messageId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("status")
    .eq("id", messageId)
    .maybeSingle();
  if (error) return true; // ante la duda, no cortar su mensaje
  return data?.status === "running";
}

// Devuelve el mensaje a la cola para que el próximo ciclo lo vuelva a tomar
async function requeue(messageId) {
  const { error } = await supabase
    .from("chat_messages")
    .update({ status: "pending" })
    .eq("id", messageId);
  if (error) log("  no se pudo devolver a la cola:", error.message);
}

// ============================================
// QUEUE
// ============================================

// La sesión de Claude Code de ESTA conversación. Cada conversación del
// historial tiene la suya: por eso "Nuevo chat" arranca de cero en vez de
// arrastrar todo lo anterior.
//
// Si el mensaje es de antes del historial (sin conversation_id), se cae al
// comportamiento viejo: la última sesión del usuario.
async function lastSessionId(userId, conversationId) {
  if (conversationId) {
    const { data } = await supabase
      .from("chat_conversations")
      .select("session_id")
      .eq("id", conversationId)
      .maybeSingle();
    return data?.session_id ?? null;
  }

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
// Cuántas respuestas se dieron en las últimas `hours` horas y, si ya se llegó
// al tope, en qué momento exacto se destraba: cuando la más vieja de esa
// ventana salga de ella. Así la espera es la justa, no un número al aire.
async function windowLimit(userId, hours, max, label) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const { data, count, error } = await supabase
    .from("chat_messages")
    .select("created_at", { count: "exact" })
    .eq("user_id", userId)
    .eq("role", "assistant")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || (count ?? 0) < max) return null;

  const oldest = data?.[0]?.created_at;
  const until = oldest
    ? new Date(oldest).getTime() + hours * 3600000 + 1000
    : Date.now() + RETRY_MS;
  return { kind: "wait", until, reason: label };
}

// Qué hacer con un mensaje ANTES de gastar un turno de Claude:
//   null        → adelante
//   "permanent" → no se va a poder nunca; se responde con el motivo
//   "wait"      → todavía no; vuelve a la cola y se reintenta solo
async function guard(message, userId) {
  if (message.content.length > MAX_CHARS) {
    return {
      kind: "permanent",
      message: `Mensaje demasiado largo (${message.content.length} caracteres, máximo ${MAX_CHARS}). No se ejecutó.`,
    };
  }

  const ageHours = (Date.now() - new Date(message.created_at).getTime()) / 3600000;
  if (ageHours > MAX_AGE_HOURS) {
    return {
      kind: "permanent",
      message: `Este mensaje llevaba ${Math.round(ageHours)} horas en cola, así que no se ejecutó. Si todavía lo querés, mandalo de nuevo.`,
    };
  }

  // Los topes de uso no son un rechazo: son un "todavía no".
  return (
    (await windowLimit(userId, 1, MAX_PER_HOUR, `tope de ${MAX_PER_HOUR} por hora`)) ??
    (await windowLimit(userId, 24, MAX_PER_DAY, `tope de ${MAX_PER_DAY} por día`))
  );
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

  // Decidir antes de gastar nada en Claude
  const verdict = await guard(message, userId);

  if (verdict?.kind === "wait") {
    // Vuelve a la cola tal cual: el chat lo sigue mostrando "En cola" y se
    // responde solo cuando se destrabe.
    await requeue(message.id);
    pause(verdict.until, verdict.reason);
    return;
  }

  if (verdict?.kind === "permanent") {
    log(`  RECHAZADO: ${verdict.message}`);
    await supabase.from("chat_messages").insert({
      user_id: userId,
      conversation_id: message.conversation_id,
      role: "assistant",
      content: verdict.message,
      status: "error",
    });
    await supabase
      .from("chat_messages")
      .update({ status: "error" })
      .eq("id", message.id);
    attempts.delete(message.id);
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
    const resume = await lastSessionId(userId, message.conversation_id);
    const context = await buildContext(supabase, !resume);
    prompt = `=== CONTEXTO DE NEXUS ===
${context}
=== FIN DEL CONTEXTO ===

Mensaje de Andrés:
${prompt}`;

    // Mientras Claude trabaja, se comprueba cada pocos segundos si el
    // mensaje sigue vivo. Si Andrés lo detuvo, se mata el proceso ahí mismo
    // en vez de esperar a que termine y gastar el turno completo.
    let kill = null;
    const watcher = setInterval(async () => {
      if (kill && !(await stillRunning(message.id))) {
        log("  DETENIDO por Andrés");
        kill();
      }
    }, CANCEL_POLL_MS);

    let result;
    try {
      result = await runClaude(prompt, resume, !!message.image_path, (fn) => {
        kill = fn;
      });
    } finally {
      clearInterval(watcher);
    }

    if (result.aborted) {
      // La app ya dejó el mensaje en "error"; no se escribe respuesta
      attempts.delete(message.id);
      return;
    }

    reply = result.text || "(sin respuesta)";
    sessionId = result.sessionId;
    failed = result.isError;
  } catch (err) {
    // ¿"Todavía no se puede" o "no se va a poder"?
    const until = retryAfter(err);
    const tried = (attempts.get(message.id) ?? 0) + 1;

    if (until && tried <= MAX_RETRIES) {
      attempts.set(message.id, tried);
      if (tmpFile) await rm(tmpFile, { force: true }).catch(() => {});
      await requeue(message.id);
      pause(
        until,
        `${err instanceof Error ? err.message : String(err)} — intento ${tried}/${MAX_RETRIES}`
      );
      return;
    }

    reply = `No pude responder: ${err instanceof Error ? err.message : String(err)}`;
    if (until) {
      reply += `\n\n(Se reintentó ${MAX_RETRIES} veces sin suerte. Mandalo de nuevo cuando quieras.)`;
    }
    failed = true;
  } finally {
    // the copy only exists so Claude could look at it
    if (tmpFile) await rm(tmpFile, { force: true }).catch(() => {});
  }

  attempts.delete(message.id);

  const { error: insertErr } = await supabase.from("chat_messages").insert({
    user_id: userId,
    conversation_id: message.conversation_id,
    role: "assistant",
    content: reply,
    status: failed ? "error" : "done",
    session_id: sessionId,
  });
  if (insertErr) log("  no se pudo guardar la respuesta:", insertErr.message);

  // La conversación se queda con la sesión, para que el próximo mensaje
  // continúe donde este quedó.
  if (message.conversation_id && sessionId) {
    await supabase
      .from("chat_conversations")
      .update({ session_id: sessionId, updated_at: new Date().toISOString() })
      .eq("id", message.conversation_id);
  }

  // Solo si sigue en "running": si Andrés lo detuvo mientras tanto, su
  // "error" manda y no se pisa con un "done".
  await supabase
    .from("chat_messages")
    .update({ status: failed ? "error" : "done" })
    .eq("id", message.id)
    .eq("status", "running");

  log(`← ${failed ? "ERROR: " : ""}${reply.slice(0, 80).replace(/\n/g, " ")}`);
}

async function tick(userId) {
  // Durante la pausa no se consulta nada: el reintento llega solo cuando toca
  if (Date.now() < pausedUntil) return;
  if (pausedReason) {
    log(`Reanudando (se esperó por: ${pausedReason}).`);
    pausedReason = "";
  }

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
