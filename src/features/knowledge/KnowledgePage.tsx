import ContextLibrary from "../../components/ContextLibrary";
import type { StarterFolder } from "../../components/ContextLibrary";
import { STARTER_FOLDERS, PROFILE_DOC_TITLE, PROFILE_TEMPLATE } from "./types";

// The general base gets the suggested folders, with the profile template
// seeded in the first one so Claude always has a known document to read.
const STARTER: StarterFolder[] = STARTER_FOLDERS.map((f, i) => ({
  ...f,
  docs: i === 0 ? [{ title: PROFILE_DOC_TITLE, content: PROFILE_TEMPLATE }] : [],
}));

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">Knowledge</h1>
        <p className="text-sm text-muted mt-1">
          Documentos markdown con tu contexto. Claude los lee por MCP para saber
          quién eres sin que se lo expliques cada vez.
        </p>
      </div>
      <ContextLibrary
        section=""
        starter={STARTER}
        emptyText="Todavía no hay carpetas."
        aiHint={
          <>
            Claude lee estos documentos con la herramienta <code className="font-mono text-primary-hover">knowledge</code> del
            servidor NEXUS. El documento <strong>{PROFILE_DOC_TITLE}</strong> es el que revisa antes de cualquier tarea personal.
          </>
        }
      />
    </div>
  );
}
