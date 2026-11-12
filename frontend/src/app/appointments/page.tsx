"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ListPlus, Plus, Trash2 } from "lucide-react";
import { appointmentsOn, useStore } from "@/lib/store";
import type { StaffRole } from "@/lib/types";
import { addDays, cn, fmtTime, isoDate, sameDay, startOfWeek } from "@/lib/utils";
import { AppointmentDetailModal } from "@/components/AppointmentDetail";
import { BookAppointmentModal, CLINICAL_ROLES, statusLabel, type BookingDefaults } from "@/components/forms";
import { Badge, Button, Card, CardHeader, Empty, Field, Input, Modal, PageHeader, Select, StatCard, useToast } from "@/components/ui";
import { CalendarCheck2, CalendarClock, CalendarDays, CalendarX2 } from "lucide-react";

const START_H = 8;
const END_H = 18;
const HOUR_PX = 64;

const CLIN_COLORS = [
  "bg-brand-50 border-brand-200 text-brand-800",
  "bg-sky-50 border-sky-200 text-sky-900",
  "bg-emerald-50 border-emerald-200 text-emerald-900",
  "bg-amber-50 border-amber-200 text-amber-900",
];

export default function AppointmentsPage() {
  const { db, now, patientById, staffById } = useStore();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [clinician, setClinician] = useState<string>("");
  const [booking, setBooking] = useState<BookingDefaults | null>(null);
  const [openAppt, setOpenAppt] = useState<string | null>(null);
  const [addingWait, setAddingWait] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const { removeWaitlist } = useStore();

  const clinicians = db.staff.filter((s) => CLINICAL_ROLES.includes(s.role));
  const lanes = clinician ? [clinician] : clinicians.map((c) => c.id);
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const today = appointmentsOn(db.appointments, now);

  const weekAppts = useMemo(
    () =>
      db.appointments.filter((a) => {
        const d = new Date(a.start);
        return d >= weekStart && d < addDays(weekStart, 7) && (!clinician || a.clinicianId === clinician) && (showCancelled || a.status !== "cancelled");
      }),
    [db.appointments, weekStart, clinician, showCancelled],
  );

  const nowTop = ((now.getHours() + now.getMinutes() / 60 - START_H) * HOUR_PX);

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Centralised calendar across practitioners · double bookings are blocked automatically"
        actions={
          <Button onClick={() => setBooking({})}>
            <Plus className="size-4" /> Book appointment
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} value={today.filter((a) => a.status !== "cancelled").length} label="Total bookings today" tone="purple" />
        <StatCard icon={CalendarCheck2} value={today.filter((a) => a.status === "completed").length} label="Completed" tone="green" />
        <StatCard icon={CalendarClock} value={today.filter((a) => a.status === "scheduled").length} label="Pending confirmation" tone="amber" />
        <StatCard icon={CalendarX2} value={today.filter((a) => a.status === "cancelled" || a.status === "no-show").length} label="Cancelled / missed" tone="red" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <div className="text-base font-semibold">{weekStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
            <div className="flex items-center gap-1">
              <button className="rounded-lg p-1.5 hover:bg-slate-100" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
                <ChevronLeft className="size-4" />
              </button>
              <Button size="sm" variant="secondary" onClick={() => setWeekStart(startOfWeek(now))}>
                Today
              </Button>
              <button className="rounded-lg p-1.5 hover:bg-slate-100" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" className="accent-brand-600" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Show cancelled
              </label>
              <Select value={clinician} onChange={(e) => setClinician(e.target.value)} className="h-9 w-52 text-xs">
                <option value="">All practitioners</option>
                {clinicians.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {!clinician && (
            <div className="flex flex-wrap gap-3 border-b border-line px-4 py-2 text-xs">
              {clinicians.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span className={cn("size-3 rounded border", CLIN_COLORS[i])} /> {c.name}
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[56px_repeat(5,1fr)] border-b border-line bg-canvas">
                <div />
                {days.map((d) => (
                  <div key={d.toISOString()} className="border-l border-line py-2 text-center">
                    <div className={cn("mx-auto grid size-8 place-items-center rounded-full text-sm font-semibold", sameDay(d, now) && "bg-brand-600 text-white")}>{d.getDate()}</div>
                    <div className="text-xs text-muted">{d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                  </div>
                ))}
              </div>
              <div className="scroll-thin relative grid max-h-[680px] grid-cols-[56px_repeat(5,1fr)] overflow-y-auto">
                <div>
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <div key={i} style={{ height: HOUR_PX }} className="pr-2 pt-1 text-right text-[11px] text-muted">
                      {String(START_H + i).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {days.map((d) => {
                  const dayAppts = weekAppts.filter((a) => sameDay(new Date(a.start), d));
                  return (
                    <div key={d.toISOString()} className="relative border-l border-line" style={{ height: (END_H - START_H) * HOUR_PX }}>
                      {Array.from({ length: (END_H - START_H) * 2 }, (_, i) => {
                        const h = START_H + Math.floor(i / 2);
                        const m = i % 2 ? 30 : 0;
                        const slot = new Date(d);
                        slot.setHours(h, m, 0, 0);
                        const past = slot < now;
                        return (
                          <button
                            key={i}
                            disabled={past}
                            onClick={() =>
                              setBooking({ date: isoDate(d), time: `${String(h).padStart(2, "0")}:${m ? "30" : "00"}`, clinicianId: clinician || undefined })
                            }
                            className={cn(
                              "absolute inset-x-0 border-line",
                              i % 2 ? "border-b" : "border-b border-dashed border-b-slate-100",
                              past ? "bg-slate-50/60" : "hover:bg-brand-50/60",
                            )}
                            style={{ top: i * (HOUR_PX / 2), height: HOUR_PX / 2 }}
                            aria-label={`Book ${d.toDateString()} ${h}:${m || "00"}`}
                          />
                        );
                      })}
                      {sameDay(d, now) && nowTop > 0 && nowTop < (END_H - START_H) * HOUR_PX && (
                        <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-rose-500" style={{ top: nowTop }}>
                          <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-rose-500" />
                        </div>
                      )}
                      {dayAppts.map((a) => {
                        const s = new Date(a.start);
                        const top = (s.getHours() + s.getMinutes() / 60 - START_H) * HOUR_PX;
                        const height = (a.durationMin / 60) * HOUR_PX - 2;
                        const lane = lanes.indexOf(a.clinicianId);
                        const width = 100 / lanes.length;
                        const p = patientById(a.patientId);
                        const colorIdx = clinicians.findIndex((c) => c.id === a.clinicianId);
                        const dim = a.status === "cancelled" || a.status === "no-show";
                        return (
                          <button
                            key={a.id}
                            onClick={() => setOpenAppt(a.id)}
                            title={`${p?.firstName} ${p?.lastName} · ${a.type} · ${staffById(a.clinicianId)?.name} · ${statusLabel[a.status]}`}
                            className={cn(
                              "absolute z-[5] overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition hover:z-20 hover:shadow-md",
                              CLIN_COLORS[colorIdx % CLIN_COLORS.length],
                              dim && "opacity-45 line-through",
                              a.status === "scheduled" && "border-dashed",
                            )}
                            style={{ top, height, left: `calc(${lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                          >
                            <div className="truncate font-semibold">
                              {p?.firstName} {lanes.length === 1 ? p?.lastName : `${p?.lastName[0]}.`}
                            </div>
                            <div className="truncate opacity-75">{fmtTime(s)}</div>
                            {lanes.length === 1 && <div className="truncate opacity-75">{a.type}</div>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-line px-4 py-2 text-xs text-muted">Click an empty slot to book · dashed border = awaiting confirmation</div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Waiting list"
              action={
                <Button size="sm" variant="ghost" onClick={() => setAddingWait(true)}>
                  <ListPlus className="size-4" /> Add
                </Button>
              }
            />
            {db.waitlist.length === 0 ? (
              <Empty>Nobody is waiting.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {db.waitlist.map((w) => {
                  const p = patientById(w.patientId);
                  return (
                    <li key={w.id} className="flex items-start gap-2 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {p?.firstName} {p?.lastName}
                        </div>
                        <div className="text-xs text-muted">
                          {w.role} · {w.note || "No preference"}
                        </div>
                      </div>
                      <button className="rounded p-1 text-muted hover:bg-rose-50 hover:text-rose-600" onClick={() => removeWaitlist(w.id)} aria-label="Remove">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="border-t border-line px-5 py-3 text-xs text-muted">When an appointment is cancelled, the freed slot is offered to matching patients here.</p>
          </Card>

          <Card>
            <CardHeader title="Clinician schedules · today" />
            <ul className="space-y-3 px-5 pb-5">
              {clinicians.map((c) => {
                const n = today.filter((a) => a.clinicianId === c.id && a.status !== "cancelled").length;
                return (
                  <li key={c.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{c.name}</span>
                      <Badge tone={c.role === "Psychiatrist" ? "purple" : c.role === "Psychologist" ? "blue" : "gray"}>{c.role}</Badge>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted">
                      <span>
                        {c.hours[0]}–{c.hours[1]}
                      </span>
                      <span className="font-semibold text-ink">{n} appointments</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <BookAppointmentModal open={!!booking} onClose={() => setBooking(null)} defaults={booking ?? undefined} />
      <AppointmentDetailModal id={openAppt} onClose={() => setOpenAppt(null)} />
      <AddWaitlistModal open={addingWait} onClose={() => setAddingWait(false)} />
    </>
  );
}

function AddWaitlistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, addWaitlist } = useStore();
  const toast = useToast();
  const [patientId, setPatientId] = useState("");
  const [role, setRole] = useState<StaffRole>("Psychologist");
  const [note, setNote] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Add to waiting list">
      <div className="space-y-4">
        <Field label="Patient">
          <Select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Select patient…</option>
            {db.patients
              .filter((p) => p.status === "active")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.firstName} {p.lastName}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Waiting for">
          <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            {CLINICAL_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Preference / note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. mornings only" />
        </Field>
        <Button
          className="w-full"
          disabled={!patientId}
          onClick={() => {
            addWaitlist({ patientId, role, note });
            toast("Added to waiting list");
            setPatientId("");
            setNote("");
            onClose();
          }}
        >
          Add to waiting list
        </Button>
      </div>
    </Modal>
  );
}
