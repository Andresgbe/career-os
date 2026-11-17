import { useState } from "react";
import { MessageCircle, StickyNote } from "lucide-react";
import MessagesView from "./MessagesView";
import NotesView from "./NotesView";

const VIEWS = [
  { id: "messages", label: "Mensajes", icon: MessageCircle },
  { id: "notes", label: "Notas", icon: StickyNote },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

/**
 * Buzón: donde Andrés se comunica con su asistente sin necesidad de que esté
 * conectado en ese momento. Mensajes (hilo) y Notas (recados fijos).
 */
export default function BuzonPanel() {
  const [view, setView] = useState<ViewId>("messages");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Buzón del asistente</h2>
        <p className="text-sm text-muted">
          Déjale mensajes y notas. Él los lee y te responde aquí; en el chat, pídele{" "}
          <span className="text-foreground">"revisa el buzón"</span>.
        </p>
      </div>
      <div className="flex gap-1">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm transition-colors ${
                view === v.id ? "bg-surface-hover text-foreground font-medium" : "text-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {v.label}
            </button>
          );
        })}
      </div>
      {view === "messages" ? <MessagesView /> : <NotesView />}
    </div>
  );
}
