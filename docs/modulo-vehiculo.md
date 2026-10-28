# Módulo de Vehículo — especificación para replicarlo

Este documento describe el módulo **Motorcycle** de NEXUS (React 19 + TypeScript + Vite + Tailwind v4 + Supabase) con el detalle suficiente para reconstruirlo idéntico en otro proyecto. En el proyecto destino el módulo se llama **"Vehículo"**: sirve igual para una moto o un carro, y el comportamiento es el mismo.

Si el proyecto destino usa otro stack, conserva el modelo de datos y el comportamiento de la UI; adapta solo la capa de acceso a datos y los estilos a lo que ya exista allí.

---

## 1. Qué es y para qué sirve

La ficha completa de un vehículo personal, en un solo lugar:

| Pestaña | Ícono (lucide) | Para qué |
|---|---|---|
| **Info** (abre por defecto) | `Bike` (o `Car`) | Datos del vehículo (marca, modelo, placa, serial, factura...) y documentos adjuntos (manual, título, seguro). |
| **Oil Change** | `Droplet` | Lista de hitos de cambio de aceite por kilometraje, con casilla de "hecho", fecha automática y foto del recibo. |
| **To Buy** | `ShoppingCart` | Lista de repuestos o accesorios por comprar, con enlace de referencia y estado Pendiente/Comprado. |
| **Audit Log** | `History` | Bitácora de todo lo que se le hizo: mantenimiento, taller, mejoras, con fecha, km y lugar. |

Hay **un solo vehículo por usuario**: la tabla de info tiene como máximo una fila por usuario.

Encabezado de la página: título **"Vehículo"** (`text-2xl font-bold`) y debajo una barra de pestañas con ícono + texto. La pestaña activa tiene borde inferior de color primario, y la barra se desplaza en horizontal en móvil sin mostrar el scrollbar.

Las cuatro pestañas son independientes: cada una carga sus propios datos al montarse.

### Nombres en la UI

En NEXUS la UI de este módulo está en inglés. Si el proyecto destino está en español, usa esta tabla:

| Original | Español |
|---|---|
| Info / Oil Change / To Buy / Audit Log | Info / Cambio de aceite / Por comprar / Bitácora |
| Specifications | Especificaciones |
| Make / Model / Year / License plate | Marca / Modelo / Año / Placa |
| VIN / Chassis / Engine serial / Invoice number | Serial de carrocería / Serial de motor / N.º de factura |
| Color / Purchase date / Notes | Color / Fecha de compra / Notas |
| Documents & Manual | Documentos y manual |
| Pending / Purchased | Pendiente / Comprado |
| Maintenance / Workshop / Upgrade / Other | Mantenimiento / Taller / Mejora / Otro |

---

## 2. Modelo de datos (Supabase / Postgres)

En NEXUS las tablas se llaman `motorcycle_*` y `oil_changes`. En el proyecto destino usa el prefijo `vehicle_`.

Todas las tablas llevan `user_id uuid not null references auth.users(id) on delete cascade` y tienen RLS activado. Política base: cada usuario ve y modifica solo sus filas (`auth.uid() = user_id` en select/insert/update/delete). Si el proyecto destino tiene su propio sistema de permisos, aplica el mismo patrón que usen sus otras tablas.

Los campos de texto opcionales tienen `default ''`, no `null`.

### 2.1 `vehicle_info` — la ficha (una fila por usuario)

```sql
create table if not exists vehicle_info (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  make text not null default '',
  model text not null default '',
  year integer,
  plate text not null default '',
  vin text not null default '',             -- serial de carrocería / chasis
  engine_serial text not null default '',
  invoice_number text not null default '',
  color text not null default '',
  purchase_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

La lectura usa `.maybeSingle()`: devuelve `null` si el usuario todavía no tiene ficha.

### 2.2 `vehicle_attachments` — documentos

```sql
create table if not exists vehicle_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default '',
  file_name text not null,        -- nombre original del archivo
  file_path text not null,        -- ruta dentro del bucket, NO una URL
  created_at timestamptz not null default now()
);
```

### 2.3 `vehicle_oil_changes` — hitos de cambio de aceite

```sql
create table if not exists vehicle_oil_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  km integer not null,
  done boolean not null default false,
  date date,                      -- día en que se marcó como hecho
  receipt_url text,               -- guarda la RUTA en el bucket, no una URL completa
  created_at timestamptz not null default now()
);
```

### 2.4 `vehicle_to_buy` — por comprar

```sql
create table if not exists vehicle_to_buy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  reference_url text not null default '',
  status text not null default 'pending' check (status in ('pending', 'purchased')),
  created_at timestamptz not null default now()
);
```

### 2.5 `vehicle_audit_log` — bitácora

```sql
create table if not exists vehicle_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  category text not null default 'maintenance'
    check (category in ('maintenance', 'workshop', 'upgrade', 'other')),
  description text not null,
  location text not null default '',
  km integer,
  created_at timestamptz not null default now()
);
```

### 2.6 Storage: bucket `vehicle-files` (PRIVADO)

A diferencia de otros buckets del proyecto, este es **privado**: son documentos del vehículo (título, factura, seguro). Los archivos se abren con **URLs firmadas de 1 hora** (`createSignedUrl(path, 3600)`), nunca con URL pública.

- Documentos: `{user_id}/{Date.now()}-{nombre}`
- Recibos de aceite: `{user_id}/oil-receipts/{oil_change_id}-{Date.now()}-{nombre}`

La primera carpeta de la ruta **tiene que ser el `user_id`**, porque las políticas del bucket lo exigen:

```sql
insert into storage.buckets (id, name, public) values ('vehicle-files', 'vehicle-files', false)
on conflict (id) do nothing;

create policy "vehicle files read own" on storage.objects for select
  using (bucket_id = 'vehicle-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vehicle files insert own" on storage.objects for insert
  with check (bucket_id = 'vehicle-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "vehicle files delete own" on storage.objects for delete
  using (bucket_id = 'vehicle-files' and (storage.foldername(name))[1] = auth.uid()::text);
```

### 2.7 Compresión de imágenes antes de subir

Todo archivo pasa por `compressImage(file)` antes de subirse. Copia esta función si el proyecto destino no tiene una equivalente:

- Solo comprime `image/jpeg`, `image/jpg` e `image/png` de **más de 300 KB**. Lo demás (PDF, HEIC, imágenes chicas) pasa sin tocar.
- Redimensiona a un máximo de 1600×1600 manteniendo la proporción, con un canvas de fondo blanco, y re-codifica a JPEG con calidad 0.82. El nombre resultante termina en `.jpg`.
- Si el resultado no es más chico, o si algo falla al decodificar, devuelve el archivo original. **Nunca bloquea la subida.**

```ts
const MAX_WIDTH = 1600, MAX_HEIGHT = 1600, QUALITY = 0.82;
const MIN_SIZE_TO_COMPRESS = 300 * 1024;
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type) || file.size <= MIN_SIZE_TO_COMPRESS) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.(jpe?g|png)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
```

---

## 3. Pestaña "Info"

Dos tarjetas apiladas (`bg-surface border rounded-xl p-5`, separadas por `space-y-6`).

### 3.1 Tarjeta "Specifications"

- **Modo bloqueado / modo edición.** Los campos están deshabilitados (`opacity-60`, cursor no permitido) hasta pulsar **"Edit"** (ícono `Pencil`, botón gris). En modo edición, el botón cambia a **"Save"** (ícono `Save`, botón primario; muestra "Saving..." mientras guarda).
- Al guardar con éxito: el botón muestra **"✓ Saved"** durante 2 segundos y los campos vuelven a bloquearse.
- **Si el usuario no tiene ficha todavía**, la pestaña arranca directo en modo edición.
- Guardar hace un *upsert* manual: si ya hay `id`, actualiza esa fila; si no, inserta y guarda el `id` devuelto. Siempre manda `updated_at = now()`. Una fecha de compra vacía se guarda como `null`.
- La API usa snake_case y la UI usa camelCase (`engine_serial` ↔ `engineSerial`, `invoice_number` ↔ `invoiceNumber`, `purchase_date` ↔ `purchaseDate`). La traducción se hace en la API y al cargar.

Campos, en una grilla de 1 / 2 / 3 columnas (móvil / sm / lg), cada uno con etiqueta pequeña atenuada arriba:

| Etiqueta | Campo | Tipo |
|---|---|---|
| Make | make | text |
| Model | model | text |
| Year | year | number (vacío o 0 → `null`) |
| License plate | plate | text |
| VIN / Chassis | vin | text |
| Engine serial | engineSerial | text |
| Invoice number | invoiceNumber | text |
| Color | color | text |
| Purchase date | purchaseDate | date |

Debajo de la grilla, a todo el ancho: **Notes** (textarea de 3 filas, sin resize).

Los errores se muestran en rojo arriba de la grilla.

### 3.2 Tarjeta "Documents & Manual"

- Lista de archivos subidos, del más nuevo al más viejo. Cada uno ocupa una fila (`bg-background border rounded-lg p-3`):
  - Ícono `FileText` en color primario.
  - Nombre del archivo como botón: al hacer clic lo abre en una pestaña nueva con la URL firmada. Si tiene más de **30 caracteres** se corta con "..." y aparece un enlace **"Show more" / "Show less"** para expandirlo. El estado de expansión es por archivo.
  - Botones: **Preview** (`Eye`, abre en pestaña nueva), **Download** (`Download`) y **Delete** (`Trash2`).
- **Download** fuerza la descarga con el nombre original: pide la URL firmada, hace `fetch` → `blob` → `URL.createObjectURL` → `<a download={nombre}>`.click() → `revokeObjectURL`. Así se descarga en vez de abrirse en el navegador.
- **Delete** borra el objeto del bucket y luego la fila de la tabla, sin confirmación.
- Estados: "Loading..." y "No files uploaded yet."
- Al final, el botón primario **"Upload file"** (ícono `Upload`; dice "Uploading..." mientras sube) dispara un `<input type="file">` oculto. Acepta cualquier tipo de archivo. Se sube **un archivo a la vez**, con `label = nombre del archivo`, y después se recarga la lista. El input se limpia después de cada subida para poder subir el mismo archivo otra vez.

---

## 4. Pestaña "Oil Change"

Lista de hitos de kilometraje para el cambio de aceite, ordenados por `km` ascendente.

- **Siembra automática:** la primera vez que se abre la pestaña y la tabla está vacía para el usuario, se insertan 9 hitos por defecto y se recarga:
  ```
  500, 2000, 3500, 5000, 6500, 8000, 9500, 11000, 12000
  ```
- Una tarjeta con una fila por hito (`divide-y`, `p-4`):
  - **Casilla** cuadrada de 24×24 px. Marcada: fondo primario con `Check` blanco. Sin marcar: solo borde, que se pone primario al pasar el mouse.
    - Marcarla pone `done = true` y `date = hoy (yyyy-mm-dd)`. Desmarcarla pone `done = false` y `date = null`.
    - La actualización es optimista; si falla, se recarga todo.
  - **"{km} km"** con separador de miles (`toLocaleString()`). Si está hecho: tachado y atenuado.
  - La **fecha** en que se hizo (texto pequeño atenuado), si existe.
  - A la derecha:
    - **Ver recibo** (`Eye`, en color primario): solo aparece si hay recibo. Abre la URL firmada en una pestaña nueva.
    - **Subir/reemplazar recibo** (`Camera`): su tooltip dice "Add receipt" o "Replace receipt". Hay **un único** `<input type="file" accept="image/*,application/pdf">` oculto para todas las filas, y una ref guarda qué fila pidió la subida. El archivo se comprime, se sube y se guarda su **ruta** en `receipt_url`. Mientras sube, el botón de esa fila queda deshabilitado.
    - **Borrar** (`Trash2`): optimista, sin confirmación. Si falla, recarga.
- Debajo de la tarjeta: input numérico "Add km milestone" (ancho `w-48`) + botón primario **"+ Add"**. Enter también agrega. Se ignora si no es un número válido o si es 0. Después de agregar se recarga la lista, así el hito nuevo queda en su lugar por orden de km.

---

## 5. Pestaña "To Buy"

Lista simple de cosas por comprar para el vehículo, ordenada por `created_at` ascendente.

- Una tarjeta con una fila por ítem (`p-4`):
  - **Chip de estado** que se alterna con un clic: "Pending" (gris, `bg-surface-hover text-muted`) ↔ "Purchased" (`bg-primary/20 text-primary`). La actualización es optimista.
  - **Nombre**: tachado y atenuado si ya se compró.
  - A la derecha: ícono `ExternalLink` (solo si hay `reference_url`; abre en pestaña nueva con `rel="noreferrer"`) y **borrar** (`Trash2`, optimista, sin confirmación).
  - Vacío: "No items yet."
- Debajo: **"Item name"** + **"Reference link (optional)"** + botón **"+ Add"**, en fila en escritorio y apilados en móvil. Enter en cualquiera de los dos inputs agrega. Se ignora si el nombre está vacío. El ítem nuevo se agrega al final y los inputs se limpian.

---

## 6. Pestaña "Audit Log"

Bitácora del vehículo, ordenada por `entry_date` **descendente** (lo más reciente arriba).

Categorías y sus colores de chip:

| Valor | Etiqueta | Chip |
|---|---|---|
| maintenance | Maintenance | `bg-blue-500/20 text-blue-400` |
| workshop | Workshop | `bg-amber-500/20 text-amber-400` |
| upgrade | Upgrade | `bg-primary/20 text-primary` |
| other | Other | `bg-surface-hover text-muted` |

### 6.1 Formulario para agregar (arriba)

Una tarjeta con una grilla de 1 / 2 / 6 columnas (móvil / sm / lg):

1. Fecha (input date)
2. Categoría (select; por defecto Maintenance)
3. **Description** (ocupa 2 columnas en lg)
4. **Km** (number)
5. **Location** + botón primario cuadrado con solo `Plus`, en la misma celda

Fecha y descripción son obligatorias; si falta alguna, el botón no hace nada. Km vacío se guarda como `null`. Después de agregar, la lista se reordena por fecha descendente y se limpian fecha, descripción, lugar y km. La categoría se queda como estaba.

### 6.2 Línea de tiempo

Una tarjeta con una fila por entrada (`flex items-start gap-3 p-4`):

- Fecha (`yyyy-mm-dd`, texto pequeño atenuado, columna fija de ancho `w-24`)
- Chip de categoría con su color
- Descripción y, debajo en pequeño, `"{lugar} · {km} km"` (cada parte solo si existe; el `·` solo si están las dos)
- Botones **editar** (`Pencil`) y **borrar** (`Trash2`, optimista, sin confirmación)

**Editar** reemplaza la fila por la misma grilla de 6 columnas del formulario, ya rellenada, con fondo `bg-surface-hover/30` y botones ✓ (guardar, verde) y ✕ (cancelar). Al guardar se aplican las mismas validaciones y se reordena.

Vacío: "No entries yet."

---

## 7. Organización de archivos

```
features/vehicle/
  VehiclePage.tsx                 página + barra de pestañas
  types.ts                        VehicleInfo (camelCase), Attachment, OilChange
  api.ts                          todas las consultas + Storage, con mapeo snake_case ↔ camelCase
  components/AttachmentsSection.tsx
  tabs/InfoTab.tsx, OilChangeTab.tsx, ToBuyTab.tsx, AuditTab.tsx
lib/compressImage.ts              (compartido, ver §2.7)
```

Convenciones de la capa API:
- Cada función obtiene el usuario con `supabase.auth.getUser()` cuando necesita `user_id` para un insert, y lanza `"Not authenticated"` si no hay sesión.
- Toda consulta lanza el `error` de Supabase si lo hay; los componentes lo atrapan y lo muestran en rojo.
- Inserts y updates devuelven la fila con `.select("*").single()` cuando la UI la necesita.

Registra el módulo donde el proyecto destino declare sus módulos y rutas: nombre "Vehículo", ruta `/vehicle` o `/vehiculo`, ícono `Bike` o `Car`.

---

## 8. Estilo

Tema oscuro con tokens de diseño (`bg-surface`, `bg-background`, `border-border`, `text-muted`, `text-foreground`, `bg-primary`, `hover:bg-primary-hover`, `bg-surface-hover`). Si el proyecto destino tiene sus propios tokens, usa esos.

- Tarjetas: `bg-surface border border-border rounded-xl`, con `divide-y divide-border` en las listas.
- Inputs: `bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none`.
- Botón primario: `bg-primary hover:bg-primary-hover text-white rounded text-sm font-medium`.
- Botones de ícono: `p-1.5 rounded text-muted hover:bg-surface-hover`, con ícono de `w-4 h-4`.
- Errores: `text-sm text-red-400`. Confirmar edición: `text-emerald-400`.
- Íconos: `lucide-react`.

---

## 9. Checklist de "quedó igualito"

- [ ] Las 5 tablas creadas con RLS, más el bucket privado `vehicle-files` con sus políticas por carpeta de usuario.
- [ ] Info: un usuario sin ficha entra directo en modo edición; Save bloquea los campos y muestra "✓ Saved" 2 segundos; Edit los desbloquea.
- [ ] Info: guardar dos veces actualiza la misma fila (no crea otra).
- [ ] Documentos: subir, ver (URL firmada en pestaña nueva), descargar con el nombre original y borrar (del bucket y de la tabla). Nombres de más de 30 caracteres con "Show more".
- [ ] Las fotos JPEG/PNG de más de 300 KB llegan comprimidas al bucket; los PDF llegan intactos.
- [ ] Oil Change: la primera vez aparecen los 9 hitos por defecto; marcar uno pone la fecha de hoy y desmarcarlo la borra.
- [ ] Oil Change: se puede subir, reemplazar y ver el recibo de cada hito; los hitos nuevos quedan ordenados por km.
- [ ] To Buy: el chip alterna Pending ↔ Purchased, los comprados se ven tachados y el enlace de referencia abre en pestaña nueva.
- [ ] Audit Log: no deja agregar sin fecha y descripción, ordena lo más reciente arriba, muestra los chips con su color, y la edición es inline con ✓/✕.
