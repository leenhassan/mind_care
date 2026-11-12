"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, CheckCircle2, Circle, Flag, PlayCircle, Plus, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, fmtDate, isoDate } from "@/lib/utils";
import { CreateTaskModal, priorityTone } from "@/components/forms";
import { Badge, Button, Empty, PageHeader, Select, Tabs } from "@/components/ui";

const COLUMNS: { status: TaskStatus; label: string; icon: typeof Circle; cls: string }[] = [
  { status: "pending", label: "Pending", icon: Circle, cls: "text-slate-500" },
  { status: "in-progress", label: "In progress", icon: PlayCircle, cls: "text-sky-600" },
  { status: "completed", label: "Completed", icon: CheckCircle2, cls: "text-emerald-600" },
];

export default function TasksPage() {
  const { db, me } = useStore();
  const [scope, setScope] = useState<"mine" | "created" | "all">("mine");
  const [assignee, setAssignee] = useState("");
  const [creating, setCreating] = useState(false);

  const tasks = db.tasks.filter((t) =>
    scope === "mine" ? t.assigneeId === me.id : scope === "created" ? t.createdById === me.id : !assignee || t.assigneeId === assignee,
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Instead of sending a message and hoping somebody acts on it, assign clear, trackable tasks"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create task
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={scope}
          onChange={setScope}
          items={[
            { value: "mine", label: "Assigned to me" },
            { value: "created", label: "Created by me" },
            { value: "all", label: "Whole team" },
          ]}
        />
        {scope === "all" && (
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-9 w-56 text-xs">
            <option value="">Everyone</option>
            {db.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.role}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks
            .filter((t) => t.status === col.status)
            .sort((a, b) => (a.priority === "urgent" ? -1 : 0) - (b.priority === "urgent" ? -1 : 0) || a.due.localeCompare(b.due));
          return (
            <div key={col.status} className="rounded-2xl bg-slate-100/70 p-3">
              <div className="mb-3 flex items-center gap-2 px-2 pt-1 text-sm font-semibold">
                <col.icon className={cn("size-4", col.cls)} /> {col.label}
                <span className="ml-auto rounded-full bg-white px-2 text-xs text-muted">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.length === 0 && <Empty>Nothing here.</Empty>}
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <CreateTaskModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function TaskCard({ task: t }: { task: Task }) {
  const { staffById, patientName, updateTask, now } = useStore();
  const overdue = t.status !== "completed" && t.due < isoDate(now);
  const assignee = staffById(t.assigneeId);
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 font-medium leading-snug">{t.title}</div>
        <Badge tone={priorityTone[t.priority]}>
          <Flag className="size-3" /> {t.priority}
        </Badge>
      </div>
      {t.patientId && (
        <Link href={`/patients/${t.patientId}`} className="mt-1 block text-xs text-brand-600 hover:underline">
          {t.patientId} — {patientName(t.patientId)}
        </Link>
      )}
      {t.instructions && <p className="mt-2 text-sm text-muted">{t.instructions}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className={cn("flex items-center gap-1", overdue && "font-medium text-rose-600")}>
          <CalendarDays className="size-3.5" /> {overdue ? "Overdue · " : "Due "}
          {fmtDate(t.due, { day: "numeric", month: "short" })}
        </span>
        <span className="flex items-center gap-1">
          <UserRound className="size-3.5" /> {assignee?.name} ({assignee?.role})
        </span>
      </div>
      <div className="mt-3 flex gap-2 border-t border-line pt-3">
        {t.status === "pending" && (
          <Button size="sm" variant="secondary" onClick={() => updateTask(t.id, { status: "in-progress" })}>
            Start
          </Button>
        )}
        {t.status !== "completed" && (
          <Button size="sm" onClick={() => updateTask(t.id, { status: "completed" })}>
            Complete
          </Button>
        )}
        {t.status === "completed" && (
          <Button size="sm" variant="ghost" onClick={() => updateTask(t.id, { status: "pending" })}>
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
