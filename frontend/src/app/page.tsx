"use client";

import Link from "next/link";
import { useState } from "react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  MessageSquarePlus,
  ShieldAlert,
  TrendingDown,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { appointmentsOn, followUpStatus, useStore } from "@/lib/store";
import { cn, fmtDate, fmtTime, greeting, relativeTime } from "@/lib/utils";
import { AddPatientModal, ApptStatus, BookAppointmentModal, CLINICAL_ROLES, CreateTaskModal } from "@/components/forms";
import { AppointmentDetailModal } from "@/components/AppointmentDetail";
import { Avatar, Badge, Card, CardHeader, Empty, Progress, StatCard, Tabs } from "@/components/ui";

const CONDITION_COLORS: Record<string, string> = {
  Depression: "#6d4ee8",
  Anxiety: "#38bdf8",
  Bipolar: "#34d399",
  PTSD: "#f59e0b",
  Psychosis: "#f472b6",
  Other: "#cbd5e1",
};

export default function Dashboard() {
  const { db, me, now, patientById, staffById } = useStore();
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [openAppt, setOpenAppt] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "patient" | "book" | "task">(null);

  const today = appointmentsOn(db.appointments, now);
  const todayActive = today.filter((a) => a.status !== "cancelled");
  const mine = todayActive.filter((a) => a.clinicianId === me.id);
  const list = tab === "mine" ? mine : todayActive;
  const activePatients = db.patients.filter((p) => p.status === "active");
  const fuStatuses = db.followUps.map((f) => ({ f, s: followUpStatus(f, now, db.appointments) }));
  const overdue = fuStatuses.filter((x) => x.s === "Overdue");
  const due = fuStatuses.filter((x) => x.s === "Overdue" || x.s === "Booking required");
  const urgentAlerts = db.alerts.filter((a) => a.status !== "resolved" && a.severity === "urgent");
  const myTasks = db.tasks.filter((t) => t.assigneeId === me.id && t.status !== "completed");
  const confirmed = todayActive.filter((a) => ["confirmed", "checked-in", "completed"].includes(a.status)).length;
  const completed = todayActive.filter((a) => a.status === "completed").length;

  const byCondition = Object.entries(
    activePatients.reduce<Record<string, number>>((acc, p) => ((acc[p.condition] = (acc[p.condition] ?? 0) + 1), acc), {}),
  ).map(([name, value]) => ({ name, value }));

  // Average PHQ-9 across patients at each measurement point
  const trend = activePatients[0]?.outcomes.map((o, i) => {
    const vals = activePatients.map((p) => p.outcomes[i]?.phq9).filter((v): v is number => v != null);
    return { date: fmtDate(o.date, { day: "numeric", month: "short" }), phq9: +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) };
  }) ?? [];
  const improvement = trend.length > 1 ? Math.round(((trend[0].phq9 - trend.at(-1)!.phq9) / trend[0].phq9) * 100) : 0;

  const clinicians = db.staff.filter((s) => CLINICAL_ROLES.includes(s.role));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting(now)}, {me.name.split(" ").slice(0, 2).join(" ")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Here&apos;s what&apos;s happening at MindCare today · {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} value={activePatients.length} label="Active patients" sub={`${db.patients.length} on register`} tone="purple" subTone="muted" />
        <StatCard icon={CalendarDays} value={todayActive.length} label="Appointments today" sub={`${confirmed} confirmed · ${completed} completed`} tone="blue" subTone="muted" />
        <StatCard icon={ClipboardCheck} value={due.length} label="Follow-ups due" sub={`${overdue.length} overdue`} tone="green" subTone={overdue.length ? "warn" : "muted"} />
        <StatCard icon={ShieldAlert} value={urgentAlerts.length} label="Urgent alerts" sub="Require attention" tone="red" subTone="warn" />
        <StatCard icon={ClipboardList} value={myTasks.length} label="My open tasks" sub={`${myTasks.filter((t) => t.priority === "urgent").length} urgent`} tone="amber" subTone="muted" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Today's appointments */}
        <Card className="xl:row-span-2">
          <CardHeader
            icon={CalendarDays}
            title="Today's appointments"
            action={
              <Link href="/appointments" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                View schedule <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="px-5 pb-3">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: "mine", label: `My appointments (${mine.length})` },
                { value: "all", label: `All providers (${todayActive.length})` },
              ]}
            />
          </div>
          <ul className="scroll-thin max-h-[440px] divide-y divide-line overflow-y-auto">
            {list.length === 0 && <Empty>No appointments today.</Empty>}
            {list.map((a) => {
              const p = patientById(a.patientId);
              return (
                <li key={a.id}>
                  <button onClick={() => setOpenAppt(a.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-canvas">
                    <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{fmtTime(a.start)}</span>
                    <span
                      className={cn("h-9 w-1 shrink-0 rounded-full", {
                        "bg-brand-500": a.type === "Therapy",
                        "bg-amber-400": a.type === "Medication Review",
                        "bg-sky-400": a.type === "Follow-up",
                        "bg-emerald-400": a.type === "Care Plan Review",
                        "bg-rose-400": a.type === "Initial Assessment",
                      })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p?.firstName} {p?.lastName[0]}. <span className="text-xs font-normal text-muted">({p?.id})</span>
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {a.type}
                        {tab === "all" && ` · ${staffById(a.clinicianId)?.name}`}
                      </span>
                    </span>
                    <ApptStatus status={a.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Patient population */}
        <Card>
          <CardHeader icon={Users} title="Patient population" />
          <div className="flex items-center gap-4 px-5 pb-5">
            <div className="relative size-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCondition} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none">
                    {byCondition.map((d) => (
                      <Cell key={d.name} fill={CONDITION_COLORS[d.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-2xl font-bold">{activePatients.length}</div>
                  <div className="text-[11px] text-muted">Active</div>
                </div>
              </div>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {byCondition
                .sort((a, b) => b.value - a.value)
                .map((d) => (
                  <li key={d.name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: CONDITION_COLORS[d.name] }} />
                    <span className="flex-1">{d.name}</span>
                    <span className="tabular-nums text-muted">{Math.round((d.value / activePatients.length) * 100)}%</span>
                  </li>
                ))}
            </ul>
          </div>
        </Card>

        {/* Clinical outcomes */}
        <Card>
          <CardHeader icon={TrendingDown} title="Clinical outcomes" action={<span className="text-xs text-muted">Avg PHQ-9 · 15 weeks</span>} />
          <div className="flex items-center gap-4 px-5 pb-4">
            <div className="shrink-0">
              <div className="text-3xl font-bold text-emerald-600">↓ {improvement}%</div>
              <div className="text-xs text-muted">symptom score
                <br />
                reduction
              </div>
            </div>
            <div className="h-32 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#646a82" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#646a82" }} axisLine={false} tickLine={false} domain={[0, "dataMax + 2"]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="phq9" name="Avg PHQ-9" stroke="#6d4ee8" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Clinician schedules */}
        <Card>
          <CardHeader icon={ActivityIcon} title="Clinician schedules" action={<Badge tone="green">Live</Badge>} />
          <ul className="space-y-4 px-5 pb-5">
            {clinicians.map((c) => {
              const count = todayActive.filter((a) => a.clinicianId === c.id).length;
              const capacity = (parseInt(c.hours[1]) - parseInt(c.hours[0])) - 1;
              return (
                <li key={c.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted">
                      {count}/{capacity} · {c.hours[0]}–{c.hours[1]}
                    </span>
                  </div>
                  <Progress value={(count / capacity) * 100} tone={count / capacity > 0.85 ? "amber" : "green"} />
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Alerts & follow-ups */}
        <Card>
          <CardHeader
            icon={AlertTriangle}
            title="Alerts & follow-ups"
            action={
              <Link href="/alerts" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <ul className="space-y-2 px-5 pb-5">
            {urgentAlerts.slice(0, 2).map((al) => {
              const p = patientById(al.patientId);
              return (
                <li key={al.id}>
                  <Link href="/alerts" className="flex items-center gap-3 rounded-xl bg-rose-50 px-3 py-2.5 text-sm hover:bg-rose-100">
                    <ShieldAlert className="size-4 shrink-0 text-rose-600" />
                    <span className="flex-1 truncate">
                      <span className="font-medium">Urgent</span> — {p?.firstName} {p?.lastName[0]}. ({p?.id})
                    </span>
                    <span className="text-xs text-rose-600">{relativeTime(al.receivedAt, now)}</span>
                  </Link>
                </li>
              );
            })}
            {overdue.slice(0, 3).map(({ f }) => {
              const p = patientById(f.patientId);
              return (
                <li key={f.id}>
                  <Link href="/follow-ups" className="flex items-center gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm hover:bg-amber-100">
                    <CalendarDays className="size-4 shrink-0 text-amber-600" />
                    <span className="flex-1 truncate">
                      Follow-up overdue — {p?.firstName} {p?.lastName[0]}.
                    </span>
                    <span className="text-xs text-amber-700">Due {fmtDate(f.dueDate, { day: "numeric", month: "short" })}</span>
                  </Link>
                </li>
              );
            })}
            {urgentAlerts.length === 0 && overdue.length === 0 && <Empty>Nothing needs attention.</Empty>}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader icon={Zap} title="Quick actions" />
          <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Add new patient", icon: UserPlus, onClick: () => setModal("patient"), cls: "bg-brand-50 text-brand-700" },
              { label: "Book appointment", icon: CalendarPlus, onClick: () => setModal("book"), cls: "bg-sky-50 text-sky-700" },
              { label: "Create clinical note", icon: FilePlus2, href: "/notes/new", cls: "bg-emerald-50 text-emerald-700" },
              { label: "Assign task", icon: ClipboardList, onClick: () => setModal("task"), cls: "bg-amber-50 text-amber-700" },
              { label: "Send message", icon: MessageSquarePlus, href: "/messages", cls: "bg-indigo-50 text-indigo-700" },
              { label: "Follow-ups", icon: CalendarDays, href: "/follow-ups", cls: "bg-pink-50 text-pink-700" },
            ].map((q) => {
              const inner = (
                <>
                  <q.icon className="size-6" />
                  <span className="text-sm font-medium text-ink">{q.label}</span>
                </>
              );
              const cls = cn("flex flex-col items-center justify-center gap-2 rounded-2xl px-3 py-5 text-center transition hover:-translate-y-0.5 hover:shadow-md", q.cls);
              return q.href ? (
                <Link key={q.label} href={q.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button key={q.label} onClick={q.onClick} className={cls}>
                  {inner}
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader icon={ActivityIcon} title="Recent activity" />
          <ul className="scroll-thin max-h-72 space-y-4 overflow-y-auto px-5 pb-5">
            {db.activity.slice(0, 8).map((a) => (
              <li key={a.id} className="flex gap-3">
                <Avatar
                  initials={a.title[0]}
                  className={cn("size-7 text-[11px]", a.kind === "alert" && "bg-rose-100 text-rose-700", a.kind === "appointment" && "bg-sky-100 text-sky-700")}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="truncate text-xs text-muted">{a.detail}</div>
                </div>
                <span className="shrink-0 text-xs text-muted">{relativeTime(a.at, now)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <AppointmentDetailModal id={openAppt} onClose={() => setOpenAppt(null)} />
      <AddPatientModal open={modal === "patient"} onClose={() => setModal(null)} />
      <BookAppointmentModal open={modal === "book"} onClose={() => setModal(null)} />
      <CreateTaskModal open={modal === "task"} onClose={() => setModal(null)} />
    </>
  );
}
