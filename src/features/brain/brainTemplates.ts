// BRAIN lives in knowledge_folders / knowledge_docs under this section key.
// The MCP server's `brain` / `brain_write` tools filter by the same value.
export const BRAIN_SECTION = "brain";

export interface BrainStarterFolder {
  name: string;
  color: string;
  docs: { title: string; content: string }[];
}

// Offered when BRAIN is empty. The content is Andrés's own context, so it is
// written in Spanish; only the app's UI is English.
export const BRAIN_STARTER: BrainStarterFolder[] = [
  {
    name: "00 · Empieza aquí",
    color: "#8b5cf6",
    docs: [
      {
        title: "README — cómo usar BRAIN",
        content: `# README — cómo usar BRAIN

BRAIN es la fuente única de contexto de Andrés. Cualquier agente o herramienta conectada por MCP debe leer de aquí antes de trabajar, en vez de preguntarle lo que ya está escrito.

## Para los agentes
1. Lee el índice con la herramienta \`brain\` (sin argumentos).
2. Abre solo los documentos que necesites para la tarea (\`brain\` con \`doc\` o \`folder\`), o busca con \`search\`.
3. Si aprendes algo que vale la pena recordar, propón guardarlo con \`brain_write\` y dile a Andrés qué cambiaste.
4. Si un documento contradice una instrucción directa de Andrés, manda la instrucción de Andrés.

## Orden de las carpetas
- **00 · Empieza aquí**: este README y las reglas generales.
- **01 · Identidad**: quién es Andrés y cómo quiere que se trabaje con él.
- **02 · Negocio**: AG Software Agency, servicios, precios, marca.
- **03 · Clientes y proyectos**: un documento por cliente o proyecto activo.
- **04 · Procesos**: cómo se hacen las cosas paso a paso.
`,
      },
      {
        title: "Reglas para agentes",
        content: `# Reglas para agentes

- Responder en español neutro, tuteando.
- Entregar el resultado, no un informe del proceso.
- No inventar datos (cifras, nombres, fechas). Si algo es estimación, decirlo.
- Decir con claridad lo que no se pudo verificar.
- Antes de gastar dinero o créditos, consultar el costo y pedir confirmación.
- No revelar herramientas, stack ni flujo de trabajo con clientes en contenido público.
`,
      },
    ],
  },
  {
    name: "01 · Identidad",
    color: "#ec4899",
    docs: [
      {
        title: "Quién es Andrés",
        content: `# Quién es Andrés

## Datos básicos
- Nombre:
- Ciudad / país:
- Estudios:
- Idiomas:

## Cómo trabaja
- Horario:
- Cómo prefiere recibir avances:
- Cosas que siempre hay que tener en cuenta:
`,
      },
    ],
  },
  {
    name: "02 · Negocio",
    color: "#06b6d4",
    docs: [
      {
        title: "AG Software Agency",
        content: `# AG Software Agency

## Qué hace
-

## Servicios y precios
| Servicio | Qué incluye | Precio |
|---|---|---|
| | | |

## Clientes ideales
-

## Marca
- Paleta, tipografía y tono: ver el contexto de Content.
`,
      },
    ],
  },
  {
    name: "03 · Clientes y proyectos",
    color: "#f59e0b",
    docs: [
      {
        title: "Plantilla — cliente",
        content: `# Cliente: (nombre)

## Resumen
- Qué hace el negocio:
- Contacto principal:
- Qué le estamos construyendo:

## Estado actual
-

## Decisiones tomadas
-

## Pendientes
- [ ]
`,
      },
    ],
  },
  {
    name: "04 · Procesos",
    color: "#10b981",
    docs: [
      {
        title: "Plantilla — proceso",
        content: `# Proceso: (nombre)

## Cuándo se usa
-

## Pasos
1.
2.
3.

## Errores comunes
-
`,
      },
    ],
  },
];
