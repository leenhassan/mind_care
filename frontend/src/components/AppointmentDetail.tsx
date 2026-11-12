"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, CalendarCheck2, Clock, MessageCircle, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import type { DeliveryState, PatientResponse } from "@/lib/types";
import { fmtTime, isoDate } from "@/lib/utils";
import { ApptStatus, channelMeta } from "./forms";
import { Badge, Button, Field, Input, Modal, Select, useToast, type Tone } from "./ui";

const deliveryTone: Record<DeliveryState, Tone> = { delivered: "green", scheduled: "amber", "not-sent": "gray" };
const responseMeta: Record<PatientResponse, { tone: Tone; label: string }> = {
  awaiting: { tone: "gray", label: "Awaiting response" },
  confirmed: { tone: "green", label: "Confirmed by patient" },
  "reschedule-requested": { tone: "amber", label: "Reschedule requested" },
  cancelled: { tone: "red", label: "Cancelled" },
};

export function AppointmentDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Modal open={!!id} onClose={onClose} title="Appointment" wide>
      {id && <Detail id={id} onClose={onClose} />}
    </Modal>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const store = useStore();
  const { db, updateAppointment, cancelAppointment, offerSlot, rescheduleAppointment, addFollowUp, staffById, patientById, now } = store;
  const toast = useToast();
  const a = db.appointments.find((x) => x.id === id);
  const [mode, setMode] = useState<"view" | "reschedule" | "complete" | "cancelled">("view");
  const [newDate, setNewDate] = useState(a ? isoDate(new Date(a.start)) : "");
  const [newTime, setNewTime] = useState(a ? fmtTime(a.start) : "");
  const [weeks, setWeeks] = useState(2);
  const [err, setErr] = useState("");

  if (!a) return <p className="text-sm text-muted">Appointment not found.</p>;
  const p = patientById(a.patientId);
  const c = staffById(a.clinicianId);
  const start = new Date(a.start);
  const isPast = new Date(start.getTime() + a.durationMin * 60000) < now;
  const open = a.status !== "cancelled" && a.status !== "completed" && a.status !== "no-show";
  const candidates = db.waitlist.filter((w) => w.role === c?.role);
  const dateLabel = start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/patients/${p?.id}`} className="text-lg font-semibold hover:text-brand-700" onClick={onClose}>
            {p ? `${p.firstName} ${p.lastName}` : "Unknown"} <span className="text-sm font-normal text-muted">({p?.id})</span>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarCheck2 className="size-4" /> {dateLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" /> {fmtTime(start)} · {a.durationMin} min
            </span>
            <span className="flex items-center gap-1.5">
              <UserRound className="size-4" /> {c?.name}
            </span>
          </div>
          <div className="mt-2 text-sm">{a.type}</div>
        </div>
        <ApptStatus status={a.status} />
      </div>

      {/* Attendance / status actions */}
      {mode === "view" && (
        <div className="flex flex-wrap gap-2">
          {open && a.status !== "checked-in" && start.getTime() - now.getTime() < 3 * 3600000 && (
            <Button size="sm" onClick={() => (updateAppointment(a.id, { status: "checked-in" }), toast("Patient checked in"))}>
              Check in
            </Button>
          )}
          {open && (a.status === "checked-in" || isPast) && (
            <Button size="sm" onClick={() => setMode("complete")}>
              Mark attended
            </Button>
          )}
          {open && isPast && (
            <Button size="sm" variant="secondary" onClick={() => (updateAppointment(a.id, { status: "no-show" }), toast("Recorded as missed"))}>
              Mark no-show
            </Button>
          )}
          {open && a.status === "scheduled" && (
            <Button size="sm" variant="secondary" onClick={() => (updateAppointment(a.id, { status: "confirmed", response: "confirmed" }), toast("Appointment confirmed"))}>
              Confirm
            </Button>
          )}
          {open && !isPast && (
            <Button size="sm" variant="secondary" onClick={() => setMode("reschedule")}>
              Reschedule
            </Button>
          )}
          {open && (
            <Button
              size="sm"
              variant="secondary"
              className="text-rose-600"
              onClick={() => {
                cancelAppointment(a.id);
                setMode("cancelled");
              }}
            >
              Cancel appointment
            </Button>
          )}
          <Link href={`/notes/new?patient=${a.patientId}`} onClick={onClose} className="inline-flex h-8 items-center rounded-xl px-3 text-xs font-medium text-brand-600 hover:bg-brand-50">
            Write session note →
          </Link>
        </div>
      )}

      {mode === "complete" && (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="mb-3 text-sm font-semibold">Record attendance & recommend follow-up</div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Recommended follow-up">
              <Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-40">
                <option value={0}>No follow-up</option>
                {[1, 2, 3, 4, 6, 8, 12].map((w) => (
                  <option key={w} value={w}>
                    {w} week{w > 1 ? "s" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              onClick={() => {
                updateAppointment(a.id, { status: "completed" });
                if (weeks > 0 && c) addFollowUp({ patientId: a.patientId, lastConsultation: isoDate(start), intervalWeeks: weeks, role: c.role });
                toast(weeks ? `Attended · follow-up due in ${weeks} weeks` : "Marked as attended");
                setMode("view");
              }}
            >
              Save
            </Button>
            <Button variant="secondary" onClick={() => setMode("view")}>
              Back
            </Button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="mb-3 text-sm font-semibold">Reschedule</div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Date">
              <Input type="date" value={newDate} min={isoDate(now)} onChange={(e) => setNewDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <Input type="time" step={1800} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </Field>
            <Button
              onClick={() => {
                const [y, m, d] = newDate.split("-").map(Number);
                const [h, min] = newTime.split(":").map(Number);
                const r = rescheduleAppointment(a.id, new Date(y, m - 1, d, h, min).toISOString());
                if (!r.ok) return setErr(r.error);
                toast("Rescheduled · patient notified");
                setErr("");
                setMode("view");
              }}
            >
              Save
            </Button>
            <Button variant="secondary" onClick={() => (setMode("view"), setErr(""))}>
              Back
            </Button>
          </div>
          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
        </div>
      )}

      {mode === "cancelled" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">Slot released — offer it to the waiting list?</div>
          {candidates.length === 0 ? (
            <p className="mt-1 text-sm text-amber-800">No patients waiting for a {c?.role.toLowerCase()}.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {candidates.map((w) => {
                const wp = patientById(w.patientId);
                return (
                  <li key={w.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">
                        {wp?.firstName} {wp?.lastName}
                      </span>{" "}
                      <span className="text-muted">· {w.note}</span>
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        const r = offerSlot(a.id, w.id);
                        if (!r.ok) return toast(r.error, "error");
                        toast(`Slot offered to ${wp?.firstName} · notification sent`);
                        onClose();
                      }}
                    >
                      Offer slot
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Notification workflow */}
      <div className="rounded-2xl border border-line p-4">
        <div className="mb-3 text-sm font-semibold">Notification workflow</div>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-full rounded-xl bg-canvas px-4 py-3">
            <div className="text-sm font-semibold">Appointment {a.status === "cancelled" ? "cancelled" : "booked"}</div>
            <div className="text-xs text-muted">
              {start.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · {fmtTime(start)}
            </div>
          </div>
          <ArrowDown className="size-4 text-muted" />
          <div className="grid w-full grid-cols-3 gap-2">
            {(Object.keys(channelMeta) as (keyof typeof channelMeta)[]).map((ch) => {
              const m = channelMeta[ch];
              const on = a.channels.includes(ch);
              return (
                <div key={ch} className={`rounded-xl border px-2 py-3 ${on ? "border-line" : "border-dashed border-line opacity-40"}`}>
                  <m.icon className={`mx-auto size-5 ${m.color}`} />
                  <div className="mt-1 text-sm font-medium">{m.label}</div>
                  <div className="text-[11px] text-muted">{on ? "Enabled" : "Off"}</div>
                </div>
              );
            })}
          </div>
          <ArrowDown className="size-4 text-muted" />
          <div className="w-full space-y-2 rounded-xl border border-line p-3 text-left text-sm">
            <Row label="Appointment confirmation">
              <Badge tone={deliveryTone[a.confirmation]}>{cap(a.confirmation)}</Badge>
            </Row>
            <Row label="24-hour reminder">
              <Badge tone={deliveryTone[a.reminder]}>{cap(a.reminder)}</Badge>
            </Row>
            <Row label="Patient response">
              <Badge tone={responseMeta[a.response].tone}>{responseMeta[a.response].label}</Badge>
            </Row>
          </div>
        </div>
        {open && a.response === "awaiting" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            Simulate patient reply:
            <Button size="sm" variant="secondary" onClick={() => updateAppointment(a.id, { response: "confirmed", status: "confirmed" })}>
              Confirm
            </Button>
            <Button size="sm" variant="secondary" onClick={() => updateAppointment(a.id, { response: "reschedule-requested" })}>
              Request reschedule
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                cancelAppointment(a.id);
                setMode("cancelled");
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {a.channels.includes("whatsapp") && p && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="size-4 text-emerald-600" /> WhatsApp notification preview
          </div>
          <div className="max-w-sm rounded-xl rounded-tl-none bg-white p-3 text-sm leading-relaxed shadow-sm">
            Hello {p.firstName},<br />
            {a.status === "cancelled" ? "Your appointment on" : "Your appointment has been scheduled for:"}
            <br />
            <strong>
              {start.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at{" "}
              {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </strong>
            {a.status === "cancelled" ? " has been cancelled." : ""}
            <br />
            Please contact our reception if you need to reschedule.
            <br />
            Thank you.
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      {children}
    </div>
  );
}

const cap = (s: string) => (s === "not-sent" ? "Not sent" : s[0].toUpperCase() + s.slice(1));
