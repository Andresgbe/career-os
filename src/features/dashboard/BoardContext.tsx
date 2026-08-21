import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { MODULES } from "../../lib/modules";
import {
  getColumns,
  addColumn,
  getModulePositions,
  addModulePosition,
} from "./api";
import type { ColumnRow, ModulePositionRow } from "./types";

const DEFAULT_COLUMN_NAME = "Módulos";

interface BoardContextValue {
  columns: ColumnRow[];
  positions: ModulePositionRow[];
  loading: boolean;
  loadError: string;
  setColumns: Dispatch<SetStateAction<ColumnRow[]>>;
  setPositions: Dispatch<SetStateAction<ModulePositionRow[]>>;
}

const BoardContext = createContext<BoardContextValue | null>(null);

// Single source of truth for the dashboard's module board (columns + which
// module sits in which column), shared between ModuleBoard (the draggable
// board itself) and ModuleNavGroups (the grouped topbar/drawer nav) so a
// rename, add, delete, or drag in one place is instantly reflected in the
// other — they're reading and writing the same React state, not two
// independent fetches.
export function BoardProvider({ children }: { children: ReactNode }) {
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [positions, setPositions] = useState<ModulePositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([getColumns(), getModulePositions()])
      .then(async ([cols, poss]) => {
        let nextColumns = cols;
        let nextPositions = poss;

        if (nextColumns.length === 0) {
          const col = await addColumn(DEFAULT_COLUMN_NAME, 0);
          nextColumns = [col];
          nextPositions = await Promise.all(
            MODULES.map((m, i) => addModulePosition(m.id, col.id, i))
          );
        } else {
          const missing = MODULES.filter(
            (m) => !nextPositions.some((p) => p.module_id === m.id)
          );
          if (missing.length > 0) {
            const firstCol = nextColumns[0];
            const base = nextPositions.filter((p) => p.column_id === firstCol.id).length;
            const added = await Promise.all(
              missing.map((m, i) => addModulePosition(m.id, firstCol.id, base + i))
            );
            nextPositions = [...nextPositions, ...added];
          }
        }

        setColumns(nextColumns);
        setPositions(nextPositions);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Error loading board"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <BoardContext.Provider
      value={{ columns, positions, loading, loadError, setColumns, setPositions }}
    >
      {children}
    </BoardContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBoardContext(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoardContext must be used within BoardProvider");
  return ctx;
}
