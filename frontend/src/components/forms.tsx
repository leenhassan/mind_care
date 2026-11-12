"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, MessageCircle, Smartphone } from "lucide-react";
import { findConflict, useStore } from "@/lib/store";
import type { AppointmentStatus, AppointmentType, Channel, Condition, StaffRole, TaskPriority } from "@/lib/types";
import { addDays, cn, isoDate, timeToMinutes } from "@/lib/utils";
import { Badge, Button, Field, Input, Modal, Select, Textarea, useToast, type Tone } from "./ui";

export const CLINICAL_ROLES: StaffRole[] = ["Psychiatrist", "Psychologist", "Clinical nurse"];
export const APPT_TYPES: AppointmentType[] = ["Initial Assessment", "Therapy", "Follow-up", "Medication Review", "Care Plan Review"];

export const statusTone: Record<AppointmentStatus, Tone> = {
  scheduled: "amber",
  confirmed: "green",
  "checked-in": "blue",
  completed: "gray",
  cancelled: "red",
  "no-show": "red",
};
export const statusLabel: Record<AppointmentStatus, string> = {
  scheduled: "Pending",
  confirmed: "Confirmed",
  "checked-in": "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  "no-show": "No-show",
};

export function ApptStatus({ status }: { status: AppointmentStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}

export const channelMeta: Record<Channel, { label: string; icon: typeof Mail; color: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600" },
  email: { label: "Email", icon: Mail, color: "text-sky-600" },
  sms: { label: "SMS", icon: Smartphone, color: "text-brand-600" },
};

function slotsFor(hours: [string, string], duration: number) {
  const out: string[] = [];
  for (let m = timeToMinutes(hours[0]); m + duration <= timeToMinutes(hours[1]); m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

function nextWeekday(d: Date) {
  let r = d;
  while (r.getDay() === 0 || r.getDay() === 6) r = addDays(r, 1);
  return r;
}

export type BookingDefaults = { patientId?: string; clinicianId?: string; date?: string; time?: string; type?: AppointmentType };

export function BookAppointmentModal({
  open,
  onClose,
  defaults,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  defaults?: BookingDefaults;
  onBooked?: (id: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Book appointment" wide>
      {open && <BookingForm defaults={defaults} onDone={(id) => (onBooked?.(id), onClose())} onCancel={onClose} />}
    </Modal>
  );
}

function BookingForm({ defaults, onDone, onCancel }: { defaults?: BookingDefaults; onDone: (id: string) => void; onCancel: () => void }) {
  const { db, bookAppointment, now, patientById } = useStore();
  const toast = useToast();
  const clinicians = db.staff.filter((s) => CLINICAL_ROLES.includes(s.role));
  const initialPatient = defaults?.patientId ?? "";
  const [patientId, setPatientId] = useState(initialPatient);
  const [clinicianId, setClinicianId] = useState(
    defaults?.clinicianId ?? (initialPatient ? patientById(initialPatient)?.clinicianId : undefined) ?? clinicians[0].id,
  );
  const [type, setType] = useState<AppointmentType>(defaults?.type ?? "Therapy");
  const [date, setDate] = useState(defaults?.date ?? isoDate(nextWeekday(addDays(now, 1))));
  const [duration, setDuration] = useState(50);
  const [time, setTime] = useState(defaults?.time ?? "");
  const [channels, setChannels] = useState<Channel[]>(["whatsapp", "email"]);
  const [error, setError] = useState<string | null>(null);

  const clinician = clinicians.find((c) => c.id === clinicianId)!;
  const slots = slotsFor(clinician.hours, duration);

  const toStart = (t: string) => {
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = t.split(":").map(Number);
    return new Date(y, m - 1, d, h, min).toISOString();
  };

  const slotState = (t: string) => {
    const start = toStart(t);
    if (new Date(start) < now) return "past";
    const c = findConflict(db, { start, durationMin: duration, clinicianId, patientId: patientId || "__none__" });
    return c ? "taken" : "free";
  };

  const conflict = time && patientId ? findConflict(db, { start: toStart(time), durationMin: duration, clinicianId, patientId }) : null;

  const submit = () => {
    if (!patientId) return setError("Choose a patient.");
    if (!time) return setError("Choose a time slot.");
    const r = bookAppointment({ patientId, clinicianId, start: toStart(time), durationMin: duration, type, channels });
    if (!r.ok) return setError(r.error);
    toast(`Appointment booked${channels.length ? " · confirmation sent" : ""}`);
    onDone(r.id);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Patient">
          <Select
            value={patientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              const p = patientById(e.target.value);
              if (p && !defaults?.clinicianId) setClinicianId(p.clinicianId);
              setError(null);
            }}
          >
            <option value="">Select patient…</option>
            {db.patients
              .filter((p) => p.status !== "discharged")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.firstName} {p.lastName}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Clinician">
          <Select value={clinicianId} onChange={(e) => (setClinicianId(e.target.value), setTime(""), setError(null))}>
            {clinicians.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.role}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Appointment type">
          <Select value={type} onChange={(e) => setType(e.target.value as AppointmentType)}>
            {APPT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} min={isoDate(now)} onChange={(e) => (setDate(e.target.value), setTime(""), setError(null))} />
          </Field>
          <Field label="Duration">
            <Select value={duration} onChange={(e) => (setDuration(Number(e.target.value)), setTime(""))}>
              {[30, 50, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
          <span>
            Available times · {clinician.name} ({clinician.hours[0]}–{clinician.hours[1]})
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm border border-line bg-white" /> free
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-slate-200" /> blocked
            </span>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {slots.map((t) => {
            const st = slotState(t);
            return (
              <button
                key={t}
                type="button"
                disabled={st !== "free"}
                onClick={() => (setTime(t), setError(null))}
                title={st === "taken" ? "Already booked — double booking prevented" : st === "past" ? "In the past" : "Available"}
                className={cn(
                  "h-9 rounded-lg border text-xs font-medium tabular-nums transition",
                  time === t
                    ? "border-brand-600 bg-brand-600 text-white"
                    : st === "free"
                      ? "border-line bg-white hover:border-brand-500 hover:text-brand-700"
                      : "cursor-not-allowed border-transparent bg-slate-100 text-slate-400 line-through",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">Send confirmation & reminders via</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(channelMeta) as Channel[]).map((c) => {
            const m = channelMeta[c];
            const on = channels.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => setChannels((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm",
                  on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-muted",
                )}
              >
                <m.icon className={cn("size-4", m.color)} /> {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {(error || conflict) && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error ?? conflict}
        </div>
      )}
      {!error && !conflict && time && patientId && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" /> Slot is free for both clinician and patient.
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit}>Book appointment</Button>
      </div>
    </div>
  );
}

const CONDITIONS: Condition[] = ["Depression", "Anxiety", "Bipolar", "PTSD", "Psychosis", "Other"];

export function AddPatientModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Register new patient" wide>
      {open && <PatientForm onDone={(id) => (onCreated?.(id), onClose())} onCancel={onClose} />}
    </Modal>
  );
}

function PatientForm({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const { db, addPatient, me } = useStore();
  const toast = useToast();
  const clinicians = db.staff.filter((s) => CLINICAL_ROLES.includes(s.role));
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    gender: "" as "" | "Female" | "Male" | "Non-binary",
    phone: "",
    email: "",
    emergencyContact: "",
    clinicianId: CLINICAL_ROLES.includes(me.role) ? me.id : clinicians[0].id,
    condition: "Other" as Condition,
    presentingConcerns: "",
    consentSigned: false,
  });
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = () => {
    if (!f.firstName.trim() || !f.lastName.trim()) return setError("First and last name are required.");
    if (!f.phone.trim() && !f.email.trim()) return setError("Add at least one contact method.");
    const id = addPatient({
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      dob: f.dob,
      gender: f.gender,
      phone: f.phone,
      email: f.email,
      emergencyContact: f.emergencyContact,
      clinicianId: f.clinicianId,
      status: "active",
      condition: f.condition,
      risk: "low",
      record: {
        presentingConcerns: f.presentingConcerns,
        history: "",
        medications: "",
        assessment: "",
        diagnosis: "",
        treatmentPlan: "",
        consentSigned: f.consentSigned,
      },
    });
    toast(`Patient ${id} registered`);
    onDone(id);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} autoFocus />
        </Field>
        <Field label="Last name">
          <Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <Field label="Date of birth">
          <Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
        </Field>
        <Field label="Gender">
          <Select value={f.gender} onChange={(e) => set("gender", e.target.value as typeof f.gender)}>
            <option value="">Prefer not to say</option>
            <option>Female</option>
            <option>Male</option>
            <option>Non-binary</option>
          </Select>
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+44 …" />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Emergency contact">
          <Input value={f.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name and phone" />
        </Field>
        <Field label="Assigned clinician">
          <Select value={f.clinicianId} onChange={(e) => set("clinicianId", e.target.value)}>
            {clinicians.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.role}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Primary concern">
          <Select value={f.condition} onChange={(e) => set("condition", e.target.value as Condition)}>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={f.consentSigned} onChange={(e) => set("consentSigned", e.target.checked)} />
          Consent form signed
        </label>
      </div>
      <Field label="Presenting concerns">
        <Textarea value={f.presentingConcerns} onChange={(e) => set("presentingConcerns", e.target.value)} placeholder="Initial complaints, symptoms and reason for seeking care" />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit}>Register patient</Button>
      </div>
    </div>
  );
}

export const priorityTone: Record<TaskPriority, Tone> = { low: "gray", normal: "amber", urgent: "red" };

export function CreateTaskModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId?: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Create a task">
      {open && <TaskForm patientId={patientId} onDone={onClose} />}
    </Modal>
  );
}

function TaskForm({ patientId, onDone }: { patientId?: string; onDone: () => void }) {
  const { db, addTask, now } = useStore();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [pid, setPid] = useState(patientId ?? "");
  const [assigneeId, setAssigneeId] = useState(db.staff.find((s) => s.role === "Receptionist")?.id ?? db.staff[0].id);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [due, setDue] = useState(isoDate(addDays(now, 1)));
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!title.trim()) return setError("Give the task a title.");
    addTask({ title: title.trim(), patientId: pid || undefined, assigneeId, priority, due, instructions });
    toast(`Task assigned to ${db.staff.find((s) => s.id === assigneeId)?.name}`);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="Task title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Contact patient for follow-up" autoFocus />
      </Field>
      <Field label="Related patient">
        <Select value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">None</option>
          {db.patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} — {p.firstName} {p.lastName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Assign to">
        <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          {db.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.role}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">Priority</span>
        <div className="flex gap-2">
          {(["low", "normal", "urgent"] as TaskPriority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium capitalize ring-2 transition",
                priority === p ? "ring-brand-500" : "ring-transparent",
                p === "low" ? "bg-slate-100 text-slate-700" : p === "normal" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <Field label="Due date">
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="Instructions">
        <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What needs to be done?" />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button className="w-full" onClick={submit}>
        Assign task
      </Button>
    </div>
  );
}
