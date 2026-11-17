import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { MODULES } from "../../../lib/modules";
import { usePermissions } from "../../../hooks/usePermissions";

// The two modules opened most from the dashboard, as big cards in the left
// column. Icon and route come from MODULES so they never drift from the nav.
const CARDS = [
  {
    moduleId: "projects",
    title: "Projects",
    description: "Clientes, tableros, mensajes y entregas.",
    color: "#06b6d4",
  },
  {
    moduleId: "content",
    title: "Content",
    description: "Planner semanal, ideas y contexto para la IA.",
    color: "#d946ef",
  },
];

export default function QuickModuleCards() {
  const { canView } = usePermissions();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-4 h-full">
      {CARDS.map((card) => {
        const mod = MODULES.find((m) => m.id === card.moduleId);
        if (!mod || !canView(mod.id)) return null;
        const Icon = mod.icon;
        return (
          <Link
            key={card.moduleId}
            to={mod.path}
            className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-5 sm:p-6 flex flex-col justify-between gap-6 min-h-[180px] lg:min-h-0 transition-all hover:-translate-y-0.5 hover:border-[var(--card)]"
            style={{ ["--card" as string]: card.color }}
          >
            {/* glow + grid texture */}
            <span
              className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-25 group-hover:opacity-45 transition-opacity pointer-events-none"
              style={{ backgroundColor: card.color }}
            />
            <span
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage: "radial-gradient(ellipse at 100% 0%, black 15%, transparent 70%)",
              }}
            />

            <div className="relative flex items-start justify-between">
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${card.color}22`, color: card.color }}
              >
                <Icon className="w-6 h-6" />
              </span>
              <span className="w-9 h-9 rounded-full border border-border bg-background/50 flex items-center justify-center text-muted group-hover:text-foreground group-hover:bg-[var(--card)] group-hover:border-transparent transition-all">
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>

            <div className="relative space-y-1.5">
              <h2 className="text-[26px] sm:text-[32px] font-extrabold uppercase tracking-tight leading-none">
                {card.title}
              </h2>
              <p className="text-[13px] text-muted leading-snug">{card.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
