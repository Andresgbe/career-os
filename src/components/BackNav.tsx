import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export interface BackNavCrumb {
  label: string;
  to?: string; // omit for the current page
}

interface BackNavProps {
  to: string; // where the square back button goes
  crumbs: BackNavCrumb[];
  className?: string;
}

// The "‹  PARENT / CURRENT" header used on every nested page (a project, a
// subject's weeks, a single week). Square back button plus an uppercase
// breadcrumb; the last crumb is the current page.
export default function BackNav({ to, crumbs, className = "" }: BackNavProps) {
  return (
    <nav className={`flex items-center gap-4 min-w-0 ${className}`}>
      <Link
        to={to}
        aria-label="Volver"
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-surface-hover border border-border text-foreground hover:border-primary/60 hover:bg-border transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </Link>
      <ol className="flex items-center gap-2.5 min-w-0 text-[13px] font-semibold uppercase tracking-[0.12em]">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <li className="text-muted/60 shrink-0">/</li>}
              <li className={last ? "text-foreground truncate" : "text-muted shrink-0"}>
                {crumb.to && !last ? (
                  <Link to={crumb.to} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  crumb.label
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
