# Módulo de Finanzas — especificación para replicarlo

Este documento describe el módulo **Finance** de NEXUS (React 19 + TypeScript + Vite + Tailwind v4 + Supabase) con el detalle suficiente para reconstruirlo idéntico en otro proyecto. Si el proyecto destino usa otro stack, conserva el modelo de datos, las reglas de conversión y el comportamiento de la UI; adapta solo la capa de acceso a datos y los estilos a lo que ya exista allí.

---

## 1. Qué es y para qué sirve

Un registro personal de plata pensado para Venezuela, donde se paga con varias monedas y "formas de pago" que valen distinto: bolívares, dólar BCV, dólar en efectivo, USDT y euro. **Todo se lleva a una sola unidad de medida: el dólar BCV**, para poder sumar y comparar.

La página tiene **tres pestañas**:

| Pestaña | Para qué |
|---|---|
| **Ingresos y gastos** (la principal, abre por defecto) | Registro de movimientos del mes, convertidos a USD BCV, con totales, gráfica diaria, desglose por categoría, tasas de cambio y categorías editables. |
| **Bills** | Lista de deudas/cuentas por pagar con monto, fecha de vencimiento y casilla de pagado. |
| **Monthly Budget** | Presupuesto estimado del mes: gastos recurrentes (todos los meses) más gastos puntuales de un mes concreto. |

Las tres pestañas son independientes entre sí: Bills y Monthly Budget **no** se cruzan con los movimientos.

Encabezado de la página: título **"Finance"**, subtítulo *"Ingresos, gastos, deudas y presupuesto mensual."*, y debajo una barra de pestañas con ícono + texto (íconos lucide: `ArrowLeftRight`, `Receipt`, `CalendarRange`). La pestaña activa tiene borde inferior de color primario.

---

## 2. La regla de conversión (lo más importante)

Una sola regla para todas las monedas:

```
rate_per_usd = cuántas unidades de esa forma de pago equivalen a 1 USD BCV
amount_usd   = amount / rate_per_usd
```

Ejemplos:

| Pago | rate_per_usd | Equivale a |
|---|---|---|
| 5 USD BCV | 1 | 5,00 $ |
| 500 Bs con BCV en 873,87 | 873.87 | 0,57 $ |
| 50 $ en efectivo (paralelo 1007, BCV 873,87) | 0.8672 | 57,66 $ |
| 50 USDT | 0.8672 | 57,66 $ |
| 10 € con euro a 0,888 € por dólar | 0.8878 | 11,26 $ |

Claves:

- **El dólar BCV es la referencia.** Su tasa es siempre 1 y no se edita.
- **Una forma de pago no es lo mismo que una moneda.** 50 $ en efectivo o en USDT valen **más** que 50 $ BCV, porque se cambian a la tasa paralela. Por eso cada forma de pago tiene su propia tasa, incluso las que están en dólares. Una tasa menor que 1 significa "vale más que el dólar BCV".
- **El equivalente en dólares se GUARDA** (`amount_usd`) junto al movimiento, junto con la tasa usada (`rate_per_usd`) y su nombre (`rate_label`). Nunca se recalcula al leer: un gasto de hace tres meses no puede cambiar de valor porque hoy se movió la tasa. Cambiar una tasa guardada solo afecta a los movimientos futuros.
- **Nunca se inventa una tasa.** Las tasas nuevas se crean con `per_usd = null` ("sin cargar") hasta que se carguen a mano o desde la API. Mientras falte una tasa, no se puede guardar un movimiento en esa forma de pago (salvo que el usuario escriba una tasa puntual para ese movimiento).

---

## 3. Modelo de datos (Supabase / Postgres)

Todas las tablas llevan `user_id uuid not null references auth.users(id) on delete cascade` y tienen RLS activado. Política base: cada usuario ve y modifica solo sus filas (`auth.uid() = user_id` en select/insert/update/delete). Si el proyecto destino tiene su propio sistema de permisos, aplica el mismo patrón que usen sus otras tablas.

Los campos de texto opcionales tienen `default ''`, no `null`.

### 3.1 `finance_categories`

```sql
create table if not exists finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('income', 'expense', 'both')),
  color text not null default '#8b5cf6',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
```

### 3.2 `finance_rates` — tasas guardadas (una por forma de pago)

```sql
create table if not exists finance_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,              -- BCV, EUR, CASH, USDT
  label text not null default '',  -- nombre visible
  currency text not null default 'VES',  -- moneda real: VES, EUR, USD
  per_usd numeric check (per_usd is null or per_usd > 0),  -- null = sin cargar
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, code)
);
```

### 3.3 `finance_transactions` — los movimientos

```sql
create table if not exists finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  occurred_on date not null default current_date,
  description text not null default '',
  place text not null default '',
  category_id uuid references finance_categories(id) on delete set null,
  amount numeric not null check (amount > 0),
  currency text not null default 'USD',
  rate_per_usd numeric not null default 1 check (rate_per_usd > 0),
  rate_label text not null default '',  -- "BCV", "CASH", "USDT", "EUR"...
  amount_usd numeric not null,          -- guardado, no recalculado
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists finance_transactions_month_idx
  on finance_transactions (user_id, occurred_on desc);
```

`on delete set null` en `category_id`: si se borra una categoría, sus movimientos **no** se borran, quedan como "Sin categoría".

### 3.4 `finance_bills`

```sql
create table if not exists finance_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  amount numeric not null default 0,
  interest_rate numeric,         -- existe en la tabla pero la UI siempre manda null
  due_date date,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);
```

### 3.5 `finance_monthly_budget`

```sql
create table if not exists finance_monthly_budget (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,           -- 'yyyy-mm' (mes del gasto, o en que empezó si es recurrente)
  category text not null default '',  -- texto libre, NO es FK a finance_categories
  description text not null default '',
  amount numeric not null default 0,
  recurring boolean not null default false,  -- true = se repite todos los meses
  created_at timestamptz not null default now()
);
```

### 3.6 Datos iniciales para cada usuario

Categorías (nombre, tipo, color, orden):

```
Supermercado    expense #10b981 0
Comida fuera    expense #f59e0b 1
Transporte      expense #06b6d4 2
Gasolina        expense #ef4444 3
Moto            expense #f97316 4
Universidad     expense #8b5cf6 5
Salud           expense #ec4899 6
Servicios       expense #3b82f6 7
Suscripciones   expense #a855f7 8
Casa            expense #14b8a6 9
Ocio            expense #eab308 10
Otros gastos    expense #64748b 11
Agencia         income  #22c55e 12
Freelance       income  #84cc16 13
Otros ingresos  income  #64748b 14
```

Tasas, todas con `per_usd = null`:

```
code  label             currency
BCV   Bolívares (Bs)    VES
EUR   Euro              EUR
CASH  Dólar efectivo    USD
USDT  USDT              USD
```

(Hubo una tasa `PARALELO` que se eliminó: no se usa como forma de pago. El paralelo solo sirve para calcular CASH y USDT.)

Si el usuario de destino no es una cuenta fija, siembra estas filas al crear la cuenta o la primera vez que abra el módulo con las tablas vacías.

> Supabase devuelve `numeric` como **string**. Convierte `amount`, `rate_per_usd` y `amount_usd` con `Number(...)` al leer movimientos (función `normalize` en la API).

---

## 4. Tasas automáticas: DolarAPI

API pública de tasas oficiales de Venezuela: `https://ve.dolarapi.com/v1`. No pide llave, no declara límite y manda `Access-Control-Allow-Origin: *`, así que se llama directo desde el navegador, sin proxy.

- `GET /dolares` → arreglo de cotizaciones `{ moneda, fuente, nombre, promedio, fechaActualizacion }`. Se usan `fuente === "oficial"` (BCV, Bs por $) y `fuente === "paralelo"` (Bs por $).
- `GET /euros/oficial` → Bs por €. Si falla, no se pierden las demás tasas (`.catch(() => [])`).

DolarAPI devuelve **bolívares por unidad**, así que casi todo se deriva:

```ts
bcv  = promedio de "oficial"           // Bs por $ BCV
eur  = bcv / bsPorEuro                 // € por $ BCV (¡no al revés!)
cash = bcv / paralelo                  // < 1: el efectivo vale más
```

Mapa código → valor traído (CASH y USDT comparten cálculo):

```ts
export const RATE_CODE_MAP = { BCV: "bcv", EUR: "eur", CASH: "cash", USDT: "cash" };
```

`syncRates(rates)`: trae las tasas, actualiza en la base solo las filas cuyo `code` (en mayúsculas) esté en el mapa y tenga valor > 0, y pone `updated_at = now()`. Las tasas creadas a mano con otros códigos no se tocan. Si no hay nada usable, lanza `"DolarAPI respondió, pero sin tasas que pueda usar."`. Devuelve la lista de tasas actualizada para meterla en el estado.

---

## 5. Pestaña "Ingresos y gastos"

Toda la pestaña trabaja sobre **un mes** a la vez. Al entrar, carga categorías y tasas una sola vez, y los movimientos cada vez que cambia el mes. La consulta va por rango de fechas: `occurred_on` entre el día 1 y el último día del mes, en orden `occurred_on desc, created_at desc`. Se filtra por fecha y no por texto para que use el índice.

### 5.1 Layout, de arriba a abajo

1. **Barra superior**
   - Izquierda: `<` · nombre del mes ("Octubre de 2026", con mayúscula inicial, locale `es-VE`) · `>`. Si no es el mes actual, aparece un botón **"Hoy"** que vuelve al mes actual.
   - Derecha: botón de alternar **"Tasas y categorías"** (ícono `SlidersHorizontal`; el texto se oculta en móvil) y botón primario **"+ Movimiento"**.
2. **Mensaje de error** (texto rojo) si algo falla.
3. **Aviso de tasas faltantes** (`MissingRatesBanner`): solo aparece si hay tasas y alguna tiene `per_usd === null`. Es una caja ámbar que dice *"Faltan las tasas de **BCV, EUR…**. Hasta cargarlas no puedo convertir a dólares nada que registres en esas monedas."* y tiene un botón **"Cargar las tasas de hoy"** que llama a `syncRates` (mientras carga dice "Trayendo..."). Va arriba de todo porque sin tasas el módulo queda a medias.
4. **Panel de ajustes** (solo si "Tasas y categorías" está activo): dos columnas en escritorio, una en móvil, con `RatesCard` y `CategoryManager`. Va arriba y no al final porque abajo de la gráfica no se encontraba.
5. **Tres tarjetas de totales** (en USD BCV, con la leyenda "USD BCV" debajo):
   - Ingresos (verde, `TrendingUp`)
   - Gastos (rojo, `TrendingDown`)
   - Balance = ingresos − gastos (verde si ≥ 0, rojo si < 0, con signo `+`/`-`; ícono `Wallet`)
6. **Gráfica "Día a día — {mes}"** (`MonthChart`).
7. **Desglose por categoría**, dos tarjetas lado a lado: "Gastos por categoría" e "Ingresos por categoría".
8. **Lista "Movimientos (N)"**, colapsable (abierta por defecto).

### 5.2 Gráfica mensual (`MonthChart`)

SVG hecho a mano, **sin librería de gráficas** (son dos series y un eje; no vale 100 kB de dependencia).

- `viewBox="0 0 1000 220"`, `preserveAspectRatio="none"`, clase `w-full h-[200px]`, así escala sola al ancho disponible.
- Padding: top 12, right 8, bottom 22, left 8.
- Un hueco por día del mes (`slot = anchoÚtil / díasDelMes`). Ancho de barra: `max(2, min(10, slot/2 - 1.5))`.
- Por día, dos barras pegadas al centro del hueco: ingreso a la izquierda (`fill-emerald-400`) y gasto a la derecha (`fill-red-400`), `rx=1.5`. Solo se dibuja la barra si el valor es mayor que 0. Cada barra tiene `<title>` con "Día N: +$X" o "Día N: -$X".
- Escala: `max = max(1, mayor ingreso o gasto diario)`. Líneas guía horizontales al 25, 50, 75 y 100 % del máximo, en color del borde.
- Etiquetas del eje X: el día 1 y los múltiplos de 5, `fontSize 11`, color atenuado.
- Leyenda arriba a la derecha: cuadrito verde "Ingresos" y cuadrito rojo "Gastos".
- Si no hay datos: "Sin movimientos este mes."

### 5.3 Desglose por categoría

`byCategory(transactions, categories, kind)` suma `amount_usd` por `category_id` para un tipo. El grupo `null` se llama "Sin categoría" y lleva el color `#64748b`. Calcula `share = total / totalDelTipo` y ordena de mayor a menor.

Cada fila muestra: nombre · `$total` · porcentaje redondeado, y debajo una barra de progreso del color de la categoría (ancho `max(2, share*100)%`). Si no hay filas: "Nada este mes."

### 5.4 Lista de movimientos

- Agrupados por día, el más reciente primero.
- Cabecera de cada día: fecha larga ("Martes, 21 de octubre") y el **neto del día** (ingresos − gastos) en $.
- Cada movimiento ocupa una fila:
  - Punto del color de la categoría (con tooltip del nombre).
  - Línea 1: `description` → si está vacío, `place` → nombre de la categoría → "Movimiento".
  - Línea 2 (atenuada): `categoría · lugar`, o "Sin categoría".
  - A la derecha: `+$X,XX` en verde o `-$X,XX` en rojo (el `amount_usd`). Debajo, si hubo conversión (`rate_per_usd !== 1`): `"Bs 500,00 · BCV 873.87"` (monto original + forma de pago + tasa). Si no hubo conversión, solo el nombre de la forma de pago ("BCV").
  - Botones de editar (lápiz) y eliminar (papelera).
- Eliminar pide confirmación con un diálogo: *"Se elimina "{descripción o lugar o 'este movimiento'}" de $X."*, botón "Eliminar". El borrado es optimista y, si falla, se restaura la lista.
- Estado vacío: *"Sin movimientos en octubre de 2026."* más una pista: *"Podés cargarlos desde acá, o decirle al chat de NEXUS algo como "gasté 5$ en el Gama en supermercado"."* (quita la segunda frase si el proyecto destino no tiene chat).

Después de guardar desde el modal: si la fecha del movimiento cae en otro mes, se quita de la vista. Si no, se reemplaza o inserta y se reordena por fecha descendente.

### 5.5 Modal de movimiento (`TransactionModal`)

Modal centrado (fondo `bg-black/60`; se cierra al hacer clic fuera o con la X). Título: "Nuevo movimiento" o "Editar movimiento".

Campos, en orden:

1. **Gasto / Ingreso**: dos botones grandes. El activo se pinta en rojo o verde (borde, texto y fondo suaves). Cambiar el tipo **limpia la categoría elegida**.
2. **Monto \*** (input `inputMode="decimal"`, autofocus, texto grande; acepta coma o punto) y **"Cómo se pagó"** (select). Opciones:
   - `Dólar BCV ($)` → código `USD_BCV`, moneda USD, tasa 1, rate_label "BCV". Siempre va primero.
   - Una opción por cada fila de `finance_rates`: etiqueta `label || code`, moneda `currency`, tasa `per_usd`, rate_label `code`.
   - Cambiar la forma de pago borra la tasa escrita a mano.
3. **Tasa** (solo si no es Dólar BCV): etiqueta *"Tasa — cuántos {Bs | € | nombre} equivalen a 1 $ BCV"*. El placeholder muestra la tasa guardada ("873.87 (la guardada)") o "sin tasa guardada". Ayuda: *"Dejalo vacío para usar la tasa guardada. Lo que pongas acá vale solo para este movimiento."*
4. **Caja de equivalencia en vivo**: *"Equivale a **-$0,57** USD BCV · tasa Bolívares (Bs) 873.87"* (rojo si es gasto, verde si es ingreso). Si falta la tasa, la caja se pone ámbar con el aviso *"Falta la tasa de {forma de pago}: sin eso no puedo calcular el equivalente."*
5. **Categoría** (select con "Sin categoría" + solo las categorías cuyo `kind` coincide con el tipo o es `both`) y **Lugar** (placeholder "El Gama, Farmatodo...").
6. **Descripción** (placeholder "Compra de la semana") y **Fecha** (input date, por defecto hoy).
7. **Nota** (textarea de 2 filas).

Pie: "Cancelar" y "Guardar" (ícono `Save`; mientras guarda dice "Guardando...").

Lógica al guardar:

```ts
effectiveRate = rateOverride !== "" ? Number(rateOverride.replace(",", ".")) : selected.perUsd ?? NaN
missingRate   = !isReference && (!isFinite(effectiveRate) || effectiveRate <= 0)
```

- Monto ≤ 0 o inválido → error *"Poné un monto mayor que cero."*
- `missingRate` → error *"No hay tasa para {label}. Cargala abajo en "Tasas" o escribila acá."*
- Se guardan: `kind, occurred_on, description.trim(), place.trim(), category_id || null, amount, currency = selected.currency, rate_per_usd = isReference ? 1 : effectiveRate, rate_label = selected.rateLabel, note.trim()`. El `amount_usd = amount / rate_per_usd` se calcula **en la capa de API** al insertar o actualizar, no en el componente.

Al editar un movimiento existente, la forma de pago elegida se deduce así: si `rate_per_usd === 1` y `rate_label` está vacío → Dólar BCV; si no → `rate_label`. La tasa escrita a mano se rellena con `rate_per_usd` cuando es distinta de 1.

### 5.6 Tarjeta de tasas (`RatesCard`)

- Título "Tasas" (ícono `RefreshCw`) y botón **"Actualizar del BCV"** (ícono `Download`; dice "Trayendo..." mientras carga) que llama a `syncRates`. Si sale bien, muestra en verde *"Actualizadas a las {hora}."*
- Si hay tasas sin cargar: aviso ámbar *"Falta cargar {lista}. Sin eso no puedo convertir lo que gastes en esa moneda."*
- Una fila por tasa: nombre · valor (`873,87 / $` en formato es-VE, o "sin cargar" en ámbar) · lápiz. Al editar aparece un input inline (Enter guarda, Escape cancela) con un botón ✓. Vacío = `null`. El valor tiene que ser > 0 o sale el error *"La tasa tiene que ser un número mayor que cero."*. El guardado es optimista con rollback.
- Texto al pie: *"Cuántas unidades de esa moneda equivalen a **1 dólar BCV**. Cambiarla no toca lo ya registrado: cada movimiento se guarda con la tasa que usaste ese día. "Actualizar del BCV" las trae de DolarAPI."* (con enlace a https://ve.dolarapi.com).
- No hay UI para crear ni borrar tasas, aunque la API expone `addRate` y `deleteRate`.

### 5.7 Gestor de categorías (`CategoryManager`)

- Título "Categorías (N)" (ícono `Tags`) y botón "+ Nueva".
- "Nueva" abre una fila inline: nombre + select Gasto/Ingreso/Ambos + ✓/✕ (Enter crea, Escape cancela). Al crear se asigna color automático de la paleta, rotando por `categories.length`, y `sort_order = categories.length`:
  ```
  #10b981 #f59e0b #06b6d4 #ef4444 #f97316 #8b5cf6
  #ec4899 #3b82f6 #a855f7 #14b8a6 #eab308 #64748b
  ```
- Cada fila: selector de color nativo (`<input type="color">` de 16×16, cambia al instante) · nombre (lápiz → input inline; se guarda al perder foco o con Enter) · etiqueta del tipo · lápiz · papelera.
- Eliminar pide confirmación: *"Se elimina "{nombre}". Los movimientos que la tengan NO se borran: quedan como "Sin categoría"."*
- Todas las operaciones son optimistas con rollback. Cada categoría se edita sola; no hay un formulario compartido.

---

## 6. Pestaña "Bills"

Tabla simple de deudas o cuentas por pagar. Esta pestaña es más antigua y su UI está en inglés.

- Arriba, dos chips: **Total** (suma de todos los montos) y **Unpaid** (suma de las no pagadas, en rojo). Montos con `toFixed(2)`, sin conversión de moneda.
- Columnas: Name · Description · Amount · Due date · Paid (checkbox que alterna `paid` al instante) · Actions (editar / eliminar).
- Editar convierte la fila en inputs, con ✓ y ✕.
- La **última fila** sirve para agregar: Name (placeholder "e.g. Car loan"), Description, Amount (number, step 0.01), Due date, y un botón "+ Add". Valida nombre y monto ("Enter a name and amount.", "Amount must be a positive number.").
- `interest_rate` siempre se manda como `null` (la columna existe, pero no se usa).
- Eliminar borra directo, sin confirmación.
- Orden: `created_at` ascendente. Vacío: "No bills yet. Add one above."

---

## 7. Pestaña "Monthly Budget"

Presupuesto estimado por mes. La UI también está en inglés.

- Arriba: "Viewing:" + selector de mes (componente `MonthPicker`: un botón que abre un popover con año ‹ › y una grilla de 12 meses, y devuelve `yyyy-mm`). Al lado, dos chips:
  - **Estimated total** = suma de todos los recurrentes + suma de los puntuales del mes visto.
  - **Recurring monthly** = suma de todos los recurrentes.
- Filas visibles: las recurrentes (siempre) y las no recurrentes cuyo `month` sea el mes visto.
- Columnas: Category (texto libre, placeholder "e.g. Groceries") · Description · Amount · Recurring (checkbox; en modo lectura muestra el ícono `Repeat` o "-") · Month (MonthPicker, **deshabilitado si es recurrente**; en lectura muestra "Every month" o el nombre del mes) · Actions.
- La fila para **agregar va arriba** de la tabla (al revés que en Bills). Cambiar el mes visto también cambia el mes por defecto de la fila nueva.
- Editar es inline, con ✓/✕. Eliminar borra directo, sin confirmación.
- Orden: `month desc, created_at desc`. Vacío: "No expenses for {mes} yet. Add one above."

---

## 8. Funciones auxiliares (copiar tal cual)

```ts
export const USD_BCV = "USD_BCV";

export function toUsd(amount: number, ratePerUsd: number): number {
  if (!Number.isFinite(ratePerUsd) || ratePerUsd <= 0) return 0;
  return amount / ratePerUsd;
}

export function money(usd: number): string {
  return usd.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Monto original con símbolo de su moneda
export function amountLabel(tx: TransactionRow): string {
  const n = tx.amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (tx.currency === "USD") return `${n}`;
  if (tx.currency === "VES") return `Bs ${n}`;
  if (tx.currency === "EUR") return `€${n}`;
  return `${n} ${tx.currency}`;
}

export const rateName = (tx: TransactionRow) => tx.rate_label || "BCV";
export const wasConverted = (tx: TransactionRow) => tx.rate_per_usd !== 1;

// Meses: siempre como string 'yyyy-mm'. Las fechas ISO se parsean como
// `${iso}T00:00:00` (hora local) para que no se corran un día por zona horaria.
export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export const currentMonth = () => monthKey(new Date());
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("es-VE", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
export function dayLabel(iso: string): string {
  const s = new Date(`${iso}T00:00:00`).toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Totales del mes, por categoría y por día: suman siempre amount_usd.
export function totals(txs) { /* income, expense, balance = income - expense */ }
export function byCategory(txs, categories, kind) { /* ver §5.3 */ }
export function byDay(txs, month) {
  // un registro {day, income, expense} por cada día del mes;
  // el día sale de Number(t.occurred_on.slice(8, 10))
}
```

Organización de archivos usada (orientativa):

```
features/finance/
  FinancePage.tsx          página + barra de pestañas
  types.ts / api.ts        Bills y Monthly Budget
  flow.ts                  tipos y funciones puras de Ingresos y gastos
  flowApi.ts               consultas de categorías, tasas, movimientos + syncRates
  dolarApi.ts              fetchRates + RATE_CODE_MAP
  tabs/FlowTab.tsx, BillsTab.tsx, MonthlyBudgetTab.tsx
  components/TransactionModal.tsx, RatesCard.tsx, CategoryManager.tsx,
             MissingRatesBanner.tsx, MonthChart.tsx
```

`syncRates` vive en la capa de API y no en un componente porque la usan dos sitios: `RatesCard` y `MissingRatesBanner`.

---

## 9. Estilo

Tema oscuro con tokens de diseño (`bg-surface`, `bg-background`, `border-border`, `text-muted`, `text-foreground`, `bg-primary`, `bg-surface-hover`). Si el proyecto destino tiene sus propios tokens, usa esos en lugar de colores sueltos. Los colores con significado sí son fijos:

- Ingreso / positivo: `emerald-400`
- Gasto / negativo / error: `red-400`
- Aviso de tasa faltante: `amber-400` (fondo `amber-400/10`)
- Tarjetas: `rounded-xl`, borde de 1px, padding `p-4 sm:p-5`.
- Números: `tabular-nums`.
- Íconos: `lucide-react`.
- Todo es responsive: las grillas pasan a una columna en móvil y las tablas tienen scroll horizontal (`overflow-x-auto` + `min-w-[760px]`/`[820px]`).

Textos de la pestaña principal en español rioplatense/venezolano ("Poné", "Cargala", "Dejalo", "Podés"). Bills y Monthly Budget están en inglés.

---

## 10. Opcional: registrar movimientos desde un chat (herramientas MCP)

En NEXUS, un servidor MCP deja que el asistente registre gastos con lenguaje natural ("gasté 5$ en el Gama en supermercado"). Si el proyecto destino tiene algo parecido, estas son las herramientas:

- **`finance_summary({ month? })`**: ingresos, gastos y balance del mes en USD BCV, gastos por categoría, tasas cargadas y los últimos 25 movimientos.
- **`add_transaction({ kind, amount, currency?, rate_code?, rate_per_usd?, category?, place?, description?, date?, note? })`**
  - Hace falta tasa si `currency !== "USD"` o si viene `rate_code` (CASH/USDT son dólares, pero no valen 1:1).
  - Si viene `rate_per_usd` explícito, se usa ese. Si no: código = `rate_code` o, si la moneda es VES, `BCV`; si no, la moneda. Se busca en `finance_rates`. Si la tasa no existe o está en null, se trae de DolarAPI en el momento y **se guarda** para el siguiente movimiento. Si DolarAPI tampoco responde, falla con un mensaje claro. **Nunca se inventa.**
  - La categoría se busca por nombre sin distinguir mayúsculas; si no existe, se crea con el `kind` del movimiento.
  - Fecha por defecto: hoy en zona America/Caracas.
  - La descripción para el modelo insiste en que "efectivo", "cash" o "USDT" ⇒ `rate_code = "CASH"`/`"USDT"` aunque la moneda sea USD.
- **`refresh_rates()`**: trae de DolarAPI y guarda (upsert por `code`).
- **`set_finance_rate({ code, per_usd })`**: actualiza o crea una tasa.

---

## 11. Checklist de "quedó igualito"

- [ ] Las 5 tablas creadas, con RLS, el índice y los datos iniciales (categorías + 4 tasas en null).
- [ ] Abre en "Ingresos y gastos" en el mes actual; ‹ › cambian de mes y "Hoy" aparece fuera del mes actual.
- [ ] Con tasas en null aparece el aviso ámbar, y "Cargar las tasas de hoy" las llena desde DolarAPI.
- [ ] 500 Bs con BCV en 873,87 se guarda como `amount_usd ≈ 0.57`; 50 CASH con tasa 0.8672 → ≈ 57.66.
- [ ] Cambiar una tasa después **no** cambia los movimientos ya guardados.
- [ ] Una tasa escrita en el modal vale solo para ese movimiento.
- [ ] Cambiar Gasto↔Ingreso limpia la categoría, y el select solo muestra las categorías del tipo + "Ambos".
- [ ] Borrar una categoría deja sus movimientos como "Sin categoría".
- [ ] Gráfica SVG sin librerías, con barras verde/rojo por día y etiquetas cada 5 días.
- [ ] Lista agrupada por día con el neto diario, y el monto original + tasa solo cuando hubo conversión.
- [ ] Bills: totales Total/Unpaid, checkbox de pagado y fila para agregar al final.
- [ ] Monthly Budget: los recurrentes aparecen en todos los meses, el mes se deshabilita al marcar recurrente y la fila para agregar va arriba.
