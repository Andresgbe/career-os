import type { StarterFolder } from "../../components/ContextLibrary";

// Section key of the Content module's context docs in knowledge_folders /
// knowledge_docs. The MCP server filters by this same value.
export const CONTENT_CONTEXT_SECTION = "content";

// Folders + fill-in templates offered the first time the Contexto tab is
// opened. They're what the AI reads before planning a week or writing a
// script, so each one asks for the things a planner actually needs.
export const CONTENT_CONTEXT_STARTER: StarterFolder[] = [
  {
    name: "Marca y voz",
    color: "#8b5cf6",
    docs: [
      {
        title: "Voz y tono",
        content: `# Voz y tono

## Quién habla
- Nombre / handle:
- En una frase, qué hago y para quién:
- Por qué alguien debería escucharme:

## Cómo sueno
- Tono (ej. directo, cercano, con humor):
- Palabras y muletillas que uso:
- Palabras que NUNCA uso:
- Tuteo / usted:

## Reglas de estilo
- Largo ideal de un guion:
- Cómo abro (hook):
- Cómo cierro (CTA):
- Emojis / hashtags: sí / no
`,
      },
    ],
  },
  {
    name: "Audiencia",
    color: "#ec4899",
    docs: [
      {
        title: "Avatar de audiencia",
        content: `# Avatar de audiencia

## Quién es
- Edad / ocupación:
- Nivel (principiante / intermedio / experto):
- Dónde me sigue (plataformas):

## Qué quiere
- Su objetivo principal:
- Sus dolores / frustraciones:
- Qué ya intentó y no le funcionó:

## Qué le engancha
- Temas que más comenta / guarda:
- Formatos que más consume:
- Objeciones típicas:
`,
      },
    ],
  },
  {
    name: "Pilares de contenido",
    color: "#06b6d4",
    docs: [
      {
        title: "Pilares y temas",
        content: `# Pilares de contenido

## Pilar 1 —
- Objetivo (alcance / confianza / venta):
- Temas:
  -

## Pilar 2 —
- Objetivo:
- Temas:
  -

## Pilar 3 —
- Objetivo:
- Temas:
  -

## Mezcla semanal ideal
- Piezas por semana:
- Reparto entre pilares:
- Días y horas de publicación:
`,
      },
    ],
  },
  {
    name: "Formatos y referencias",
    color: "#f59e0b",
    docs: [
      {
        title: "Formatos que funcionan",
        content: `# Formatos que funcionan

| Formato | Para qué lo uso | Estructura |
| --- | --- | --- |
| Reel | | Hook → desarrollo → CTA |
| Carrusel | | Portada → slides → cierre |
| Historia | | |

## Hooks que me han funcionado
-

## Plantillas de guion
-
`,
      },
      {
        title: "Referencias y creadores",
        content: `# Referencias

## Creadores que admiro
- @… — qué les copio:

## Piezas de referencia
- Link — por qué funciona:
`,
      },
    ],
  },
  {
    name: "Aprendizajes",
    color: "#10b981",
    docs: [
      {
        title: "Qué funcionó y qué no",
        content: `# Aprendizajes

Ve llenando esto cada semana: es lo que más ayuda a la IA a mejorar el plan.

## Lo que funcionó
- (fecha) pieza — métrica — por qué creo que funcionó

## Lo que no funcionó
- (fecha) pieza — métrica — hipótesis

## Ideas para probar
-
`,
      },
    ],
  },
];
