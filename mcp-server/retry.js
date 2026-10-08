// Cuándo volver a intentar un mensaje del chat que no se pudo responder.
//
// Vive aparte de worker.js porque son funciones puras y así se pueden
// probar solas:  node retry.js
//
// Los formatos que reconoce salieron de errores reales de Claude Code, no
// de suposiciones. El de referencia es:
//   "You've hit your session limit · resets 6:10pm (America/Caracas)"
// con api_error_status 429. Ojo: dice "resets 6:10pm", sin "at", y habla de
// "session limit", no de "usage limit".

// Lee la hora a la que se levanta el límite. Acepta "resets 6:10pm",
// "reset at 3pm", "resets at 14:30".
//
// Es best-effort: el formato lo decide Claude Code, no nosotros. Si cambia,
// esto devuelve null y el que llama usa su espera por defecto — nunca se
// depende solo de esto.
export function parseResetTime(text, now = Date.now()) {
  const match = String(text).match(
    /reset(?:s|ting)?\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;

  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  // Si esa hora ya pasó hoy, es la de mañana
  if (target.getTime() <= now) target.setDate(target.getDate() + 1);
  // Un minuto de colchón, para no caer justo en el borde
  return target.getTime() + 60000;
}

const MINUTE = 60 * 1000;

// Hasta cuándo esperar si el error es pasajero, o null si el mensaje no se
// va a poder responder por más que se reintente.
export function retryAfter(err, now = Date.now()) {
  const text = String(err instanceof Error ? err.message : err).toLowerCase();

  // Cualquier tope de uso: de sesión, diario, semanal. Si trae la hora a la
  // que se levanta, se espera exactamente hasta ahí; puede ser dentro de
  // horas, y esperar de a 10 minutos sería rendirse antes de tiempo.
  const isLimit =
    text.includes("session limit") ||
    text.includes("usage limit") ||
    text.includes("límite de uso") ||
    (text.includes("limit") && text.includes("reset"));

  if (isLimit) return parseResetTime(text, now) ?? now + 30 * MINUTE;

  if (text.includes("rate limit") || text.includes("429")) return now + 10 * MINUTE;
  if (text.includes("overloaded") || text.includes("529") || text.includes("503"))
    return now + 5 * MINUTE;

  if (
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("enotfound") ||
    text.includes("socket hang up") ||
    text.includes("network") ||
    text.includes("fetch failed") ||
    text.includes("no respondió en")
  ) {
    return now + 2 * MINUTE;
  }

  return null;
}

// Claude Code devuelve un JSON enorme cuando falla. Lo que le sirve a
// Andrés es el campo `result`, que trae la frase en claro; el resto son
// métricas de tokens que no le dicen nada en el chat.
export function readableError(stdout, stderr, code) {
  try {
    const parsed = JSON.parse(stdout);
    if (parsed?.result) {
      const status = parsed.api_error_status
        ? ` (HTTP ${parsed.api_error_status})`
        : "";
      return `${parsed.result}${status}`;
    }
  } catch {
    // no era JSON; sigue con el texto crudo
  }
  return stderr.trim() || stdout.trim() || `claude salió con código ${code}`;
}

// Probar a mano:  node retry.js
if (import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  // Miércoles 7 de octubre de 2026, 14:52 — la hora del error real
  const now = new Date(2026, 9, 7, 14, 52, 0).getTime();
  const at = (ms) => new Date(ms).toLocaleTimeString("es-VE");

  const cases = [
    // El real, tal cual vino de Claude Code
    [
      "You've hit your session limit · resets 6:10pm (America/Caracas)",
      "hoy 18:11",
      new Date(2026, 9, 7, 18, 11).getTime(),
    ],
    // A las 14:52 las 3pm todavía no pasaron: es hoy, no mañana
    ["Claude usage limit reached. Your limit will reset at 3pm.", "hoy 15:01", new Date(2026, 9, 7, 15, 1).getTime()],
    ["usage limit reached, resets at 9am", "mañana 09:01", new Date(2026, 9, 8, 9, 1).getTime()],
    ["usage limit reached, resets at 23:30", "hoy 23:31", new Date(2026, 9, 7, 23, 31).getTime()],
    ["You've hit your session limit", "sin hora → +30 min", now + 30 * MINUTE],
    ["Error: 429 rate limit exceeded", "+10 min", now + 10 * MINUTE],
    ["API Error 529 overloaded_error", "+5 min", now + 5 * MINUTE],
    ["socket hang up", "+2 min", now + 2 * MINUTE],
    ["Claude no respondió en 180s", "+2 min", now + 2 * MINUTE],
    ["Invalid API key", "no reintenta", null],
    ["command not found: claude", "no reintenta", null],
  ];

  let failures = 0;
  for (const [input, expectation, expected] of cases) {
    const result = retryAfter(input, now);
    const ok = result === expected;
    if (!ok) failures++;
    console.log(
      `${ok ? "ok   " : "FALLA"} ${JSON.stringify(input).slice(0, 50).padEnd(52)} ` +
        `${result === null ? "no reintenta" : at(result)}  (esperado: ${expectation})`
    );
  }

  // readableError sobre el JSON real
  const realJson = JSON.stringify({
    is_error: true,
    api_error_status: 429,
    result: "You've hit your session limit · resets 6:10pm (America/Caracas)",
    usage: { input_tokens: 4 },
  });
  const readable = readableError(realJson, "", 1);
  const expectedReadable =
    "You've hit your session limit · resets 6:10pm (America/Caracas) (HTTP 429)";
  const okReadable = readable === expectedReadable;
  if (!okReadable) failures++;
  console.log(`${okReadable ? "ok   " : "FALLA"} readableError → ${readable}`);

  console.log(failures === 0 ? "\nTodo bien." : `\n${failures} fallas.`);
  if (failures > 0) process.exitCode = 1;
}
