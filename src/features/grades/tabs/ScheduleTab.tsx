import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ScheduleGrid from "../components/ScheduleGrid";
import ScheduleBlockModal from "../components/ScheduleBlockModal";
import {
  getSchedulePeople,
  addSchedulePerson,
  deleteSchedulePerson,
  getScheduleBlocks,
  addScheduleBlock,
  updateScheduleBlock,
  deleteScheduleBlock,
} from "../api";
import type { SchedulePersonRow, ScheduleBlockRow, ScheduleDay } from "../types";

const DEFAULT_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#3b82f6",
  "#f97316",
];

interface ModalState {
  personId: string | null; // null = my own schedule
  block: ScheduleBlockRow | null; // null = adding a new class
  day?: ScheduleDay;
}

export default function ScheduleTab() {
  const [people, setPeople] = useState<SchedulePersonRow[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [deletingPerson, setDeletingPerson] = useState<SchedulePersonRow | null>(
    null
  );
  const [modalState, setModalState] = useState<ModalState | null>(null);

  useEffect(() => {
    Promise.all([getSchedulePeople(), getScheduleBlocks()])
      .then(([ppl, blks]) => {
        setPeople(ppl);
        setBlocks(blks);
      })
      .catch(reportError)
      .finally(() => setLoading(false));
  }, []);

  function reportError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong");
  }

  async function submitAddPerson() {
    const name = newPersonName.trim();
    setAddingPerson(false);
    setNewPersonName("");
    if (!name) return;
    const sortOrder = people.length
      ? Math.max(...people.map((p) => p.sort_order)) + 1
      : 0;
    const color = DEFAULT_COLORS[people.length % DEFAULT_COLORS.length];
    try {
      const row = await addSchedulePerson(name, color, sortOrder);
      setPeople((prev) => [...prev, row]);
    } catch (err) {
      reportError(err);
    }
  }

  async function confirmDeletePerson() {
    const person = deletingPerson;
    setDeletingPerson(null);
    if (!person) return;
    setPeople((prev) => prev.filter((p) => p.id !== person.id));
    setBlocks((prev) => prev.filter((b) => b.person_id !== person.id));
    if (selectedPersonId === person.id) setSelectedPersonId(null);
    try {
      await deleteSchedulePerson(person.id);
    } catch (err) {
      reportError(err);
    }
  }

  function openModal(personId: string | null, block?: ScheduleBlockRow, day?: ScheduleDay) {
    setModalState({ personId, block: block ?? null, day });
  }

  async function handleSaveBlock(fields: {
    subject: string;
    day: ScheduleDay;
    start_time: string;
    end_time: string;
    color: string;
  }) {
    const state = modalState;
    if (!state) return;
    try {
      if (state.block) {
        const updated = await updateScheduleBlock(state.block.id, fields);
        setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      } else {
        const row = await addScheduleBlock({ person_id: state.personId, ...fields });
        setBlocks((prev) => [...prev, row]);
      }
      setModalState(null);
    } catch (err) {
      reportError(err);
    }
  }

  async function handleDeleteBlock(id: string) {
    try {
      await deleteScheduleBlock(id);
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      setModalState(null);
    } catch (err) {
      reportError(err);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  const myBlocks = blocks.filter((b) => !b.person_id);
  const selectedPerson = people.find((p) => p.id === selectedPersonId) ?? null;
  const friendBlocks = selectedPerson
    ? blocks.filter((b) => b.person_id === selectedPerson.id)
    : [];

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Friends bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted mr-1">Amigos:</span>
        {people.map((p) => {
          const isSelected = selectedPersonId === p.id;
          return (
            <div key={p.id} className="relative group">
              <button
                onClick={() =>
                  setSelectedPersonId((prev) => (prev === p.id ? null : p.id))
                }
                className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  isSelected
                    ? "bg-surface-hover border-primary/50"
                    : "border-border hover:bg-surface-hover"
                }`}
                style={isSelected ? { color: p.color } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingPerson(p);
                }}
                className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-surface border border-border text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                title="Eliminar amigo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {addingPerson ? (
          <input
            autoFocus
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onBlur={submitAddPerson}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAddPerson();
              if (e.key === "Escape") setAddingPerson(false);
            }}
            placeholder="Nombre del amigo"
            className="bg-background border border-primary rounded-full px-3 py-1.5 text-sm focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setAddingPerson(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar amigo
          </button>
        )}
      </div>

      {/* Grids */}
      <div
        className={`grid grid-cols-1 gap-6 ${
          selectedPerson ? "xl:grid-cols-2" : ""
        }`}
      >
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Mi horario</h3>
            <button
              onClick={() => openModal(null)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted hover:text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar clase
            </button>
          </div>
          <ScheduleGrid
            blocks={myBlocks}
            onBlockClick={(block) => openModal(null, block)}
            onDayClick={(day) => openModal(null, undefined, day)}
          />
        </section>

        {selectedPerson && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">
                Horario de {selectedPerson.name}
              </h3>
              <button
                onClick={() => openModal(selectedPerson.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted hover:text-primary transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar clase
              </button>
            </div>
            <ScheduleGrid
              blocks={friendBlocks}
              onBlockClick={(block) => openModal(selectedPerson.id, block)}
              onDayClick={(day) => openModal(selectedPerson.id, undefined, day)}
            />
          </section>
        )}
      </div>

      {modalState && (
        <ScheduleBlockModal
          block={modalState.block}
          defaultDay={modalState.day}
          personLabel={
            modalState.personId
              ? people.find((p) => p.id === modalState.personId)?.name ?? ""
              : "mi horario"
          }
          onClose={() => setModalState(null)}
          onSave={handleSaveBlock}
          onDelete={
            modalState.block
              ? () => handleDeleteBlock(modalState.block!.id)
              : undefined
          }
        />
      )}

      {deletingPerson && (
        <ConfirmDialog
          title="Eliminar amigo"
          message={`Eliminar a "${deletingPerson.name}" y todo su horario?`}
          onConfirm={confirmDeletePerson}
          onCancel={() => setDeletingPerson(null)}
        />
      )}
    </div>
  );
}
