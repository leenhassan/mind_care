"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck2, CalendarX2, Download, FileCheck2, ListChecks, Sparkles, TrendingDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, fmtDate, startOfWeek } from "@/lib/utils";
import { CLINICAL_ROLES } from "@/components/forms";
import { Button, Card, CardHeader, PageHeader, StatCard } from "@/components/ui";

export default function AnalyticsPage() {
  const { db, now, patientName, staffById } = useStore();
  const past = db.appointments.filter((a) => new Date(a.start) < now && new Date(a.start) > addDays(now, -28));
  const attended = past.filter((a) => a.status === "completed").length;
  const noShow = past.filter((a) => a.status === "no-show").length;
  const cancelled = past.filter((a) => a.status === "cancelled").length;
  const total = past.length || 1;
  const attendanceRate = Math.round((attended / total) * 100);

  const weeks = Array.from({ length: 4 }, (_, i) => startOfWeek(addDays(now, -7 * (3 - i))));
  const weekly = weeks.map((w) => {
    const inWeek = past.filter((a) => {
      const d = new Date(a.start);
      return d >= w && d < addDays(w, 7);
    });
    return {
      week: `w/c ${fmtDate(w, { day: "numeric", month: "short" })}`,
      Attended: inWeek.filter((a) => a.status === "completed").length,
      "No-show": inWeek.filter((a) => a.status === "no-show").length,
      Cancelled: inWeek.filter((a) => a.status === "cancelled").length,
    };
  });

  const clinicians = db.staff.filter((s) => CLINICAL_ROLES.includes(s.role));
  const byClinician = clinicians.map((c) => {
    const mine = past.filter((a) => a.clinicianId === c.id);
    return {
      name: c.name.replace("Dr. ", "").replace("Nurse ", ""),
      Attended: mine.filter((a) => a.status === "completed").length,
      Missed: mine.filter((a) => a.status !== "completed").length,
    };
  });

  const active = db.patients.filter((p) => p.status === "active" && p.outcomes.length);
  const outcomeTrend = (active[0]?.outcomes ?? []).map((o, i) => {
    const avg = (k: "phq9" | "gad7") => +(active.reduce((s, p) => s + (p.outcomes[i]?.[k] ?? 0), 0) / active.length).toFixed(1);
    return { date: fmtDate(o.date, { day: "numeric", month: "short" }), "PHQ-9": avg("phq9"), "GAD-7": avg("gad7") };
  });
  const phqDrop = outcomeTrend.length > 1 ? Math.round(((outcomeTrend[0]["PHQ-9"] - outcomeTrend.at(-1)!["PHQ-9"]) / outcomeTrend[0]["PHQ-9"]) * 100) : 0;

  const signed = db.notes.filter((n) => n.status === "signed").length;
  const notesPct = Math.round((signed / (db.notes.length || 1)) * 100);
  const tasksDone = db.tasks.filter((t) => t.status === "completed").length;

  const worstNoShow = byClinician.slice().sort((a, b) => b.Missed / (b.Attended + b.Missed || 1) - a.Missed / (a.Attended + a.Missed || 1))[0];
  const reminderAppts = past.filter((a) => a.channels.includes("whatsapp"));
  const reminderAttendance = Math.round((reminderAppts.filter((a) => a.status === "completed").length / (reminderAppts.length || 1)) * 100);
  const insights = [
    `Attendance over the last 4 weeks is ${attendanceRate}% (${attended} of ${past.length} sessions).`,
    `Patients reminded via WhatsApp attended ${reminderAttendance}% of sessions.`,
    `Average PHQ-9 has fallen by ${phqDrop}% across active patients over 15 weeks.`,
    worstNoShow ? `${worstNoShow.name} has the highest share of missed or cancelled sessions — consider extra reminder calls.` : "",
    `${db.notes.length - signed} session note(s) are still unsigned drafts.`,
    `${db.waitlist.length} patient(s) on the waiting list can fill cancelled slots.`,
  ].filter(Boolean);

  const exportCsv = () => {
    const rows = [
      ["Appointment ID", "Date", "Time", "Patient ID", "Patient", "Clinician", "Type", "Status"],
      ...db.appointments
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((a) => {
          const d = new Date(a.start);
          return [a.id, d.toLocaleDateString("en-GB"), d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), a.patientId, patientName(a.patientId), staffById(a.clinicianId)?.name ?? "", a.type, a.status];
        }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `mindcare-appointments-${now.toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        subtitle="Last 4 weeks · attendance, outcomes and documentation"
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="size-4" /> Download CSV
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={CalendarCheck2} value={`${attendanceRate}%`} label="Attendance rate" tone="green" />
        <StatCard icon={CalendarX2} value={noShow} label="No-shows" sub={`${cancelled} cancellations`} tone="red" subTone="muted" />
        <StatCard icon={TrendingDown} value={`${phqDrop}%`} label="PHQ-9 improvement" tone="purple" />
        <StatCard icon={FileCheck2} value={`${notesPct}%`} label="Notes signed" tone="blue" />
        <StatCard icon={ListChecks} value={`${tasksDone}/${db.tasks.length}`} label="Tasks completed" tone="amber" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Attendance by week" />
          <div className="h-72 px-3 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ left: -16, right: 8 }}>
                <CartesianGrid stroke="#eef0f5" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#646a82" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#646a82" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#f3f0ff" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Attended" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                <Bar dataKey="No-show" stackId="a" fill="#f87171" />
                <Bar dataKey="Cancelled" stackId="a" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Sparkles} title="Insights" />
          <ul className="space-y-2.5 px-5 pb-5">
            {insights.map((t) => (
              <li key={t} className="flex gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm leading-relaxed">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-500" /> {t}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Clinical outcomes · average scores" />
          <div className="h-72 px-3 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={outcomeTrend} margin={{ left: -16, right: 16 }}>
                <CartesianGrid stroke="#eef0f5" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#646a82" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#646a82" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="PHQ-9" stroke="#6d4ee8" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey="GAD-7" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Sessions by clinician" />
          <div className="h-72 px-3 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClinician} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="#eef0f5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#646a82" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: "#646a82" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "#f3f0ff" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Attended" stackId="a" fill="#6d4ee8" />
                <Bar dataKey="Missed" stackId="a" fill="#f87171" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  );
}
