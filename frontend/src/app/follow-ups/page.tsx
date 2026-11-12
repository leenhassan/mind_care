"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck2, CalendarClock, CalendarX2, Check, ClipboardList } from "lucide-react";
import { followUpStatus, useStore } from "@/lib/store";
import { fmtDate } from "@/lib/utils";
import { BookAppointmentModal, CreateTaskModal } from "@/components/forms";
import { Badge, Button, Card, Empty, PageHeader, StatCard, Tabs, useToast, type Tone } from "@/components/ui";

const tone: Record<ReturnType<typeof followUpStatus>, Tone> = {
  Completed: "green",
  Booked: "purple",
  Overdue: "red",
  "Booking required": "amber",
  Upcoming: "blue",
};

export default function FollowUpsPage() {
  const { db, now, patientById, updateFollowUp } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "overdue" | "completed" | "all">("open");
  const [booking, setBooking] = useState<{ fuId: string; patientId: string } | null>(null);
  const [taskFor, setTaskFor] = useState<string | null>(null);

  const rows = db.followUps
    .map((f) => ({ f, s: followUpStatus(f, now, db.appointments) }))
    .sort((a, b) => a.f.dueDate.localeCompare(b.f.dueDate));
  const counts = {
    upcoming: rows.filter((r) => ["Upcoming", "Booking required", "Booked"].includes(r.s)).length,
    overdue: rows.filter((r) => r.s === "Overdue").length,
    completed: rows.filter((r) => r.s === "Completed").length,
  };
  const visible = rows.filter((r) =>
    tab === "open" ? r.s !== "Completed" : tab === "overdue" ? r.s === "Overdue" : tab === "completed" ? r.s === "Completed" : true,
  );

  return (
    <>
      <PageHeader title="Follow-up management" subtitle="Tracks when patients are due for their next appointment so continuity of care isn't disrupted" />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarClock} value={counts.upcoming} label="Upcoming" tone="blue" />
        <StatCard icon={CalendarX2} value={counts.overdue} label="Overdue" tone="red" />
        <StatCard icon={CalendarCheck2} value={counts.completed} label="Completed" tone="green" />
      </div>
      <Card>
        <div className="border-b border-line p-4">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "open", label: "Open" },
              { value: "overdue", label: `Overdue (${counts.overdue})` },
              { value: "completed", label: "Completed" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
        {visible.length === 0 ? (
          <Empty>No follow-ups in this view.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-3 py-3 font-medium">Last consultation</th>
                  <th className="px-3 py-3 font-medium">Interval</th>
                  <th className="px-3 py-3 font-medium">Due</th>
                  <th className="px-3 py-3 font-medium">Professional</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map(({ f, s }) => {
                  const p = patientById(f.patientId);
                  return (
                    <tr key={f.id} className="hover:bg-canvas">
                      <td className="px-5 py-3">
                        <Link href={`/patients/${f.patientId}`} className="font-medium hover:text-brand-700">
                          {p?.firstName} {p?.lastName}
                        </Link>
                        <div className="text-xs text-muted">{f.patientId}</div>
                      </td>
                      <td className="px-3 py-3">{fmtDate(f.lastConsultation)}</td>
                      <td className="px-3 py-3">{f.intervalWeeks} weeks</td>
                      <td className="px-3 py-3 font-medium">{fmtDate(f.dueDate)}</td>
                      <td className="px-3 py-3">{f.role}</td>
                      <td className="px-3 py-3">
                        <Badge tone={tone[s]}>{s}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          {s !== "Completed" && s !== "Booked" && (
                            <Button size="sm" onClick={() => setBooking({ fuId: f.id, patientId: f.patientId })}>
                              Book
                            </Button>
                          )}
                          {s !== "Completed" && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => setTaskFor(f.patientId)} title="Create contact task">
                                <ClipboardList className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                title="Mark completed"
                                onClick={() => {
                                  updateFollowUp(f.id, { completed: true });
                                  toast("Follow-up completed");
                                }}
                              >
                                <Check className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <BookAppointmentModal
        open={!!booking}
        onClose={() => setBooking(null)}
        defaults={booking ? { patientId: booking.patientId, type: "Follow-up" } : undefined}
        onBooked={(apptId) => booking && updateFollowUp(booking.fuId, { appointmentId: apptId })}
      />
      <CreateTaskModal open={!!taskFor} onClose={() => setTaskFor(null)} patientId={taskFor ?? undefined} />
    </>
  );
}
