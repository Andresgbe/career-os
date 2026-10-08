// Tasas oficiales de Venezuela, desde DolarAPI (https://ve.dolarapi.com).
//
// Pública, sin llave y sin límite declarado. Manda
// `Access-Control-Allow-Origin: *`, así que la puede llamar el navegador
// directo: no hace falta proxy ni función de servidor.
//
// Devuelve `promedio` = cuántos bolívares vale 1 unidad de esa moneda, que
// es exactamente el `per_usd` que usa NEXUS para el bolívar. OJO: para el
// euro NO: ahí el promedio son bolívares por euro, no euros por dólar, y
// hay que convertirlo (ver eurPerUsd más abajo).

const BASE = "https://ve.dolarapi.com/v1";

interface DolarApiQuote {
  moneda: string;
  fuente: string;
  nombre: string;
  promedio: number | null;
  fechaActualizacion: string;
}

export interface FetchedRates {
  // Bolívares por dólar
  bcv: number | null;
  paralelo: number | null;
  // Euros por dólar (derivado: Bs/€ ÷ Bs/$)
  eur: number | null;
  updatedAt: string | null;
}

async function get(path: string): Promise<DolarApiQuote[]> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`DolarAPI respondió ${response.status}`);
  }
  const body = await response.json();
  return Array.isArray(body) ? body : [body];
}

export async function fetchRates(): Promise<FetchedRates> {
  const [dolares, euro] = await Promise.all([
    get("/dolares"),
    // Si el euro falla, no se pierden las dos tasas que importan
    get("/euros/oficial").catch(() => [] as DolarApiQuote[]),
  ]);

  const pick = (fuente: string) =>
    dolares.find((q) => q.fuente === fuente)?.promedio ?? null;

  const bcv = pick("oficial");
  const bsPorEuro = euro[0]?.promedio ?? null;

  return {
    bcv,
    paralelo: pick("paralelo"),
    // Bs/€ ÷ Bs/$ = € por dólar, que es lo que guarda NEXUS
    eur: bcv && bsPorEuro ? bsPorEuro / bcv : null,
    updatedAt:
      dolares.find((q) => q.fuente === "oficial")?.fechaActualizacion ?? null,
  };
}

// Qué código de finance_rates corresponde a cada valor traído
export const RATE_CODE_MAP: Record<string, keyof FetchedRates> = {
  BCV: "bcv",
  PARALELO: "paralelo",
  EUR: "eur",
};
