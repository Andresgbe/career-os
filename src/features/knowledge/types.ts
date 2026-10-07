// Knowledge module types.
// Folders of markdown documents that describe the user — who he is, health
// numbers, agency context — so Claude can read them over MCP and answer
// with real context instead of asking every time.

export interface KnowledgeFolderRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface KnowledgeDocRow {
  id: string;
  user_id: string;
  folder_id: string | null; // null = loose doc, shown under "Sin carpeta"
  title: string;
  content: string; // markdown
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Folders suggested on first load, so the module isn't an empty page.
export const STARTER_FOLDERS: { name: string; color: string }[] = [
  { name: "Sobre mí", color: "#8b5cf6" },
  { name: "Salud", color: "#ef4444" },
  { name: "Agencia", color: "#06b6d4" },
  { name: "Universidad", color: "#f59e0b" },
];

// The one document Claude is told to read before doing personal work.
// Seeded as a fill-in template so the module starts useful instead of blank.
export const PROFILE_DOC_TITLE = "Perfil";

export const PROFILE_TEMPLATE = `# Perfil

Este documento es el contexto que Claude lee antes de hacerme cualquier tarea.
Borra lo que no aplique y llena el resto. Puedes pedirle a Claude que lo
actualice por ti.

## Identidad
- Nombre completo:
- Cómo prefiero que me llamen:
- Fecha de nacimiento:
- Ciudad / país:
- Idiomas:

## Contacto
- Correo:
- Teléfono / WhatsApp:
- Sitio web / portafolio:
- Redes:

## Salud
- Peso:
- Altura:
- Tipo de sangre:
- Alergias:
- Condiciones o tratamientos:
- Medicamentos que tomo:

## Agencia / freelance
- Nombre de la agencia:
- Qué servicios ofrezco:
- Rango de tarifas:
- Datos de facturación (razón social, RIF, dirección):
- Forma de pago preferida:

## Universidad
- Universidad y carrera:
- Semestre actual:

## Cómo quiero que trabajes conmigo
- Tono:
- Cosas que siempre debes tener en cuenta:
- Cosas que nunca debes hacer:
`;

// First line of a doc, used as a preview in the list.
export function docSnippet(content: string, max = 90): string {
  const text = content
    .replace(/^#+\s*/gm, "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}
