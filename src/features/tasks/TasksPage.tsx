import { useState } from "react";
import { ListTodo, CheckCircle2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { Task, Priority } from "./types";
import { GripVertical, Trash2, CheckCircle, Circle, Pencil, X, Check } from "lucide-react";

const INITIAL_TASKS: Task[] = [
  { id: "1", title: "Review pull requests", priority: "high", completed: false, order: 0 },
  { id: "2", title: "Update documentation", priority: "medium", completed: false, order: 1 },
  { id: "3", title: "Weekly team sync", priority: null, completed: false, order: 2 },
  { id: "4", title: "Fix login bug", priority: "high", completed: true, order: 3 },
];

const PRIORITY_COLORS = {
  high: "text-red-500 bg-red-500/10 border-red-500/20",
  medium: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  low: "text-blue-500 bg-blue-500/10 border-blue-500/20",
};

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  
  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>(null);

  // Edit task state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>(null);

  const pendingTasks = tasks.filter((t) => !t.completed).sort((a, b) => a.order - b.order);
  const doneTasks = tasks.filter((t) => t.completed);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    
    if (startIndex === endIndex) return;

    // We only reorder pending tasks, so we find their original indices
    const newPending = Array.from(pendingTasks);
    const [reorderedItem] = newPending.splice(startIndex, 1);
    newPending.splice(endIndex, 0, reorderedItem);

    // Update the 'order' property of all pending tasks to reflect new order
    const updatedPending = newPending.map((t, index) => ({ ...t, order: index }));
    
    // Merge back with done tasks
    const updatedTasks = [...updatedPending, ...doneTasks];
    setTasks(updatedTasks);
  };

  const handleToggleComplete = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleDelete = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      completed: false,
      order: pendingTasks.length, // Put at the end of pending
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle("");
    setNewTaskPriority(null);
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority);
  };

  const saveEdit = () => {
    if (!editingTaskId || !editTitle.trim()) return;
    setTasks(tasks.map(t => 
      t.id === editingTaskId ? { ...t, title: editTitle.trim(), priority: editPriority } : t
    ));
    setEditingTaskId(null);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Tasks</h1>
        <p className="text-sm text-muted">
          Manage your to-do list, set priorities, and track what's done.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
            activeTab === "pending"
              ? "border-primary text-foreground"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <ListTodo className="w-4 h-4" />
          Pending ({pendingTasks.length})
        </button>
        <button
          onClick={() => setActiveTab("done")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
            activeTab === "done"
              ? "border-primary text-foreground"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface-hover"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          DONE ({doneTasks.length})
        </button>
      </div>

      {activeTab === "pending" && (
        <div className="space-y-6">
          {/* Add Task Form */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <select
                value={newTaskPriority || ""}
                onChange={(e) => setNewTaskPriority((e.target.value as Priority) || null)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary appearance-none min-w-[120px]"
              >
                <option value="">No Priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </div>

          {/* Pending Tasks List (Drag & Drop) */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="pending-tasks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {pendingTasks.length === 0 ? (
                    <div className="text-center p-8 text-muted border border-dashed border-border rounded-xl">
                      No pending tasks! You're all caught up.
                    </div>
                  ) : (
                    pendingTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 p-3 bg-surface border rounded-xl group transition-all ${
                              snapshot.isDragging ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="text-muted/50 hover:text-foreground cursor-grab active:cursor-grabbing p-1"
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>
                            
                            <button
                              onClick={() => handleToggleComplete(task.id)}
                              className="text-muted hover:text-primary transition-colors flex-shrink-0"
                            >
                              <Circle className="w-5 h-5" />
                            </button>

                            {editingTaskId === task.id ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEdit();
                                    if (e.key === "Escape") cancelEdit();
                                  }}
                                />
                                <select
                                  value={editPriority || ""}
                                  onChange={(e) => setEditPriority((e.target.value as Priority) || null)}
                                  className="bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary appearance-none w-[100px]"
                                >
                                  <option value="">No Priority</option>
                                  <option value="high">High</option>
                                  <option value="medium">Medium</option>
                                  <option value="low">Low</option>
                                </select>
                                <button onClick={saveEdit} className="p-1 text-green-500 hover:bg-green-500/10 rounded transition-colors">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={cancelEdit} className="p-1 text-muted hover:bg-surface-hover rounded transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="flex-1 text-sm font-medium">
                                  {task.title}
                                </span>

                                {task.priority && (
                                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}>
                                    {task.priority}
                                  </span>
                                )}

                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => startEditing(task)}
                                    className="text-muted/50 hover:text-primary transition-all p-1"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(task.id)}
                                    className="text-muted/50 hover:text-red-400 transition-all p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      {activeTab === "done" && (
        <div className="space-y-2">
          {doneTasks.length === 0 ? (
            <div className="text-center p-8 text-muted border border-dashed border-border rounded-xl">
              No completed tasks yet.
            </div>
          ) : (
            doneTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 bg-surface/50 border border-border rounded-xl opacity-75"
              >
                <button
                  onClick={() => handleToggleComplete(task.id)}
                  className="text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>

                {editingTaskId === task.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <select
                      value={editPriority || ""}
                      onChange={(e) => setEditPriority((e.target.value as Priority) || null)}
                      className="bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary appearance-none w-[100px]"
                    >
                      <option value="">No Priority</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button onClick={saveEdit} className="p-1 text-green-500 hover:bg-green-500/10 rounded transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEdit} className="p-1 text-muted hover:bg-surface-hover rounded transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium line-through text-muted">
                      {task.title}
                    </span>

                    {task.priority && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border text-muted border-border bg-surface">
                        {task.priority}
                      </span>
                    )}

                    <div className="flex items-center">
                      <button
                        onClick={() => startEditing(task)}
                        className="text-muted hover:text-primary transition-all p-1"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-muted hover:text-red-400 transition-all p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
