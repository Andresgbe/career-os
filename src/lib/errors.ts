// Supabase/PostgREST throw plain objects with a `message`, not real Error
// instances. Code written as `err instanceof Error ? err.message : "..."`
// therefore silently swallowed every database error and showed the generic
// fallback instead, which made real problems impossible to diagnose.
//
// This pulls the message out of whatever was actually thrown, and rewrites
// the two schema errors that come up while a migration is still pending
// into something that says what to do about it.
export function errorMessage(err: unknown, fallback = "Algo salió mal"): string {
  let raw = "";
  if (err instanceof Error) {
    raw = err.message;
  } else if (typeof err === "string") {
    raw = err;
  } else if (typeof err === "object" && err !== null && "message" in err) {
    raw = String((err as { message: unknown }).message ?? "");
  }

  if (!raw.trim()) return fallback;

  const missingTable = raw.match(/Could not find the table '(?:public\.)?(\w+)'/);
  if (missingTable) {
    return `Falta la tabla "${missingTable[1]}" en Supabase. Corré PENDIENTE.sql en el SQL editor del proyecto.`;
  }

  const missingColumn = raw.match(/column (?:\S+\.)?(\w+) does not exist/);
  if (missingColumn) {
    return `Falta la columna "${missingColumn[1]}" en Supabase. Corré PENDIENTE.sql en el SQL editor del proyecto.`;
  }

  return raw;
}
