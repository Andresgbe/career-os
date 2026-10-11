// Tasas oficiales de Venezuela, desde DolarAPI (https://ve.dolarapi.com).
//
// Pública, sin llave y sin límite declarado. Manda
// `Access-Control-Allow-Origin: *`, así que la puede llamar el navegador
// directo: no hace falta proxy ni función de servidor.
//
// NEXUS guarda cada tasa como "cuántas unidades de esa forma de pago
// equivalen a 1 USD BCV" (per_usd). DolarAPI devuelve bolívares por unidad,
// así que casi todo hay que derivarlo, nunca copiarlo directo.

const BASE = "https://ve.dolarapi.com/v1";

interface DolarApiQuote {
  moneda: string;
  fuente: string;
  nombre: string;
  promedio: number | null;
  fechaActualizacion: string;
}

export interface FetchedRates {
  // Bolívares por dólar, tasa BCV. Es la referencia: el resto se mide
  // contra esta.
  bcv: number | null;
  // Euros por dólar BCV (derivado: Bs/$ ÷ Bs/€)
  eur: number | null;
  // Dólar efectivo y USDT: Andrés los cambia a la tasa paralela, así que
  // valen MÁS que 1 dólar BCV. per_usd = BCV ÷ paralelo (menos de 1).
  cash: number | null;
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
    // Si el euro falla, no se pierden las demás tasas
    get("/euros/oficial").catch(() => [] as DolarApiQuote[]),
  ]);

  const pick = (fuente: string) =>
    dolares.find((q) => q.fuente === fuente)?.promedio ?? null;

  const bcv = pick("oficial");
  const paralelo = pick("paralelo");
  const bsPorEuro = euro[0]?.promedio ?? null;

  return {
    bcv,
    // NEXUS guarda "cuántas unidades son 1 dólar BCV", así que para el
    // euro es Bs/$ ÷ Bs/€. Al revés daría dólares por euro, que es el
    // número que todo el mundo cita y justo el que NO va acá.
    eur: bcv && bsPorEuro ? bcv / bsPorEuro : null,
    // 1 $ efectivo/USDT se cambia a la tasa paralela: BCV ÷ paralelo
    cash: bcv && paralelo ? bcv / paralelo : null,
    updatedAt:
      dolares.find((q) => q.fuente === "oficial")?.fechaActualizacion ?? null,
  };
}

// Qué código de finance_rates corresponde a cada valor traído. CASH y USDT
// comparten el mismo cálculo: los dos se cambian a la tasa paralela.
export const RATE_CODE_MAP: Record<string, keyof FetchedRates> = {
  BCV: "bcv",
  EUR: "eur",
  CASH: "cash",
  USDT: "cash",
};
