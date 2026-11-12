"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildSeed, DB_VERSION } from "./seed";
import type {
  Activity,
  Appointment,
  ClinicalAlert,
  DB,
  FollowUp,
  Message,
  Patient,
  SessionNote,
  Staff,
  Task,
  Thread,
  WaitlistEntry,
} from "./types";
import { addDays, isoDate, minutesOfDay, parseDate, sameDay, timeToMinutes, uid } from "./utils";

const KEY = "mindcare-db";

export type BookingInput = Omit<Appointment, "id" | "status" | "confirmation" | "reminder" | "response"> & {
  status?: Appointment["status"];
};

export type Result = { ok: true; id: string } | { ok: false; error: string };

/** Returns an error message if the slot conflicts with the clinician's or patient's existing bookings. */
export function findConflict(db: DB, a: { start: string; durationMin: number; clinicianId: string; patientId: string }, ignoreId?: string): string | null {
  const start = new Date(a.start);
  const end = new Date(start.getTime() + a.durationMin * 60000);
  const clinician = db.staff.find((s) => s.id === a.clinicianId);
  if (clinician) {
    const from = timeToMinutes(clinician.hours[0]);
    const to = timeToMinutes(clinician.hours[1]);
    const s = minutesOfDay(start);
    const e = s + a.durationMin;
    if (s < from || e > to) return `${clinician.name} works ${clinician.hours[0]}–${clinician.hours[1]}. This slot is outside their hours.`;
    if (start.getDay() === 0 || start.getDay() === 6) return "The clinic is closed at weekends.";
  }
  for (const other of db.appointments) {
    if (other.id === ignoreId) continue;
    if (other.status === "cancelled" || other.status === "no-show") continue;
    if (other.clinicianId !== a.clinicianId && other.patientId !== a.patientId) continue;
    const os = new Date(other.start);
    const oe = new Date(os.getTime() + other.durationMin * 60000);
    if (start < oe && os < end) {
      const t = os.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return other.clinicianId === a.clinicianId
        ? `Double booking: ${clinician?.name ?? "This clinician"} already has an appointment at ${t}.`
        : `This patient already has an appointment at ${t} that day.`;
    }
  }
  return null;
}

interface Store {
  ready: boolean;
  db: DB;
  now: Date;
  me: Staff;
  staffById: (id: string) => Staff | undefined;
  patientById: (id: string) => Patient | undefined;
  patientName: (id: string) => string;
  authorName: (authorId: string) => string;

  addPatient: (p: Omit<Patient, "id" | "registeredAt" | "outcomes">) => string;
  updatePatient: (id: string, patch: Partial<Patient>) => void;

  bookAppointment: (input: BookingInput) => Result;
  rescheduleAppointment: (id: string, start: string, clinicianId?: string) => Result;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  cancelAppointment: (id: string) => void;
  offerSlot: (appointmentId: string, waitlistId: string) => Result;

  addWaitlist: (w: Omit<WaitlistEntry, "id" | "addedAt">) => void;
  removeWaitlist: (id: string) => void;

  saveNote: (n: Omit<SessionNote, "id"> & { id?: string }) => string;

  addFollowUp: (f: Omit<FollowUp, "id" | "dueDate" | "completed">) => void;
  updateFollowUp: (id: string, patch: Partial<FollowUp>) => void;

  addTask: (t: Omit<Task, "id" | "createdAt" | "status" | "createdById">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;

  ensureThread: (kind: Thread["kind"], patientId?: string) => string;
  sendMessage: (threadId: string, body: string, urgent: boolean, authorId?: string) => void;

  updateAlert: (id: string, status: ClinicalAlert["status"]) => void;

  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let loaded: DB | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DB;
        if (parsed.version === DB_VERSION) loaded = parsed;
      }
    } catch {
      /* storage unavailable — fall back to seed */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setDb(loaded ?? buildSeed(new Date()));
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!db) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* ignore quota / private mode */
    }
  }, [db]);

  const mutate = useCallback((fn: (d: DB) => DB) => setDb((d) => (d ? fn(d) : d)), []);

  const log = (d: DB, a: Omit<Activity, "id" | "at">): Activity[] => [
    { ...a, id: uid("AC"), at: new Date().toISOString() },
    ...d.activity,
  ].slice(0, 40);

  const store = useMemo<Store | null>(() => {
    if (!db || !now) return null;
    const staffById = (id: string) => db.staff.find((s) => s.id === id);
    const patientById = (id: string) => db.patients.find((p) => p.id === id);
    const patientName = (id: string) => {
      const p = patientById(id);
      return p ? `${p.firstName} ${p.lastName}` : "Unknown patient";
    };
    const me = staffById(db.currentUserId)!;
    const short = (id: string) => {
      const p = patientById(id);
      return p ? `${p.firstName} ${p.lastName[0]}. (${p.id})` : id;
    };

    return {
      ready: true,
      db,
      now,
      me,
      staffById,
      patientById,
      patientName,
      authorName: (authorId) =>
        authorId.startsWith("patient:") ? patientName(authorId.slice(8)) : (staffById(authorId)?.name ?? "Unknown"),

      addPatient: (p) => {
        const nums = db.patients.map((x) => Number(x.id.slice(3)));
        const id = `MC-${String(Math.max(...nums) + 1).padStart(5, "0")}`;
        mutate((d) => ({
          ...d,
          patients: [...d.patients, { ...p, id, registeredAt: isoDate(new Date()), outcomes: [] }],
          activity: log(d, { title: "New patient registered", detail: `${p.firstName} ${p.lastName} (${id}) · by ${me.name}`, kind: "patient" }),
        }));
        return id;
      },
      updatePatient: (id, patch) =>
        mutate((d) => ({
          ...d,
          patients: d.patients.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          activity: patch.record ? log(d, { title: "Clinical record updated", detail: `${short(id)} · by ${me.name}`, kind: "plan" }) : d.activity,
        })),

      bookAppointment: (input) => {
        const current = db;
        const conflict = findConflict(current, input);
        if (conflict) return { ok: false, error: conflict };
        if (new Date(input.start) < new Date()) return { ok: false, error: "That time is in the past." };
        const id = uid("A");
        const hoursUntil = (new Date(input.start).getTime() - Date.now()) / 3600000;
        const appt: Appointment = {
          ...input,
          id,
          status: input.status ?? "scheduled",
          confirmation: input.channels.length ? "delivered" : "not-sent",
          reminder: input.channels.length ? (hoursUntil < 24 ? "delivered" : "scheduled") : "not-sent",
          response: "awaiting",
        };
        mutate((d) => ({
          ...d,
          appointments: [...d.appointments, appt],
          activity: log(d, {
            title: "Appointment booked",
            detail: `${short(input.patientId)} · ${new Date(input.start).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
            kind: "appointment",
          }),
        }));
        return { ok: true, id };
      },
      rescheduleAppointment: (id, start, clinicianId) => {
        const current = db;
        const a = current.appointments.find((x) => x.id === id);
        if (!a) return { ok: false, error: "Appointment not found" };
        const next = { ...a, start, clinicianId: clinicianId ?? a.clinicianId };
        const conflict = findConflict(current, next, id);
        if (conflict) return { ok: false, error: conflict };
        mutate((d) => ({
          ...d,
          appointments: d.appointments.map((x) => (x.id === id ? { ...next, status: "scheduled", response: "awaiting", confirmation: "delivered", reminder: "scheduled" } : x)),
          activity: log(d, { title: "Appointment rescheduled", detail: short(a.patientId), kind: "appointment" }),
        }));
        return { ok: true, id };
      },
      updateAppointment: (id, patch) =>
        mutate((d) => {
          const a = d.appointments.find((x) => x.id === id);
          return {
            ...d,
            appointments: d.appointments.map((x) => (x.id === id ? { ...x, ...patch } : x)),
            activity:
              a && patch.status && patch.status !== a.status
                ? log(d, { title: `Appointment ${patch.status.replace("-", " ")}`, detail: short(a.patientId), kind: "appointment" })
                : d.activity,
          };
        }),
      cancelAppointment: (id) =>
        mutate((d) => {
          const a = d.appointments.find((x) => x.id === id);
          return {
            ...d,
            appointments: d.appointments.map((x) => (x.id === id ? { ...x, status: "cancelled", response: "cancelled" } : x)),
            activity: a ? log(d, { title: "Appointment cancelled", detail: `${short(a.patientId)} · slot released`, kind: "appointment" }) : d.activity,
          };
        }),
      offerSlot: (appointmentId, waitlistId) => {
        const current = db;
        const a = current.appointments.find((x) => x.id === appointmentId);
        const w = current.waitlist.find((x) => x.id === waitlistId);
        if (!a || !w) return { ok: false, error: "Not found" };
        const input = { patientId: w.patientId, clinicianId: a.clinicianId, start: a.start, durationMin: a.durationMin };
        const conflict = findConflict(current, input);
        if (conflict) return { ok: false, error: conflict };
        const id = uid("A");
        mutate((d) => ({
          ...d,
          appointments: [
            ...d.appointments,
            { ...input, id, type: "Therapy", status: "scheduled", channels: ["whatsapp", "sms"], confirmation: "delivered", reminder: "scheduled", response: "awaiting" },
          ],
          waitlist: d.waitlist.filter((x) => x.id !== waitlistId),
          activity: log(d, { title: "Vacant slot offered from waitlist", detail: short(w.patientId), kind: "appointment" }),
        }));
        return { ok: true, id };
      },

      addWaitlist: (w) =>
        mutate((d) => ({ ...d, waitlist: [...d.waitlist, { ...w, id: uid("W"), addedAt: isoDate(new Date()) }] })),
      removeWaitlist: (id) => mutate((d) => ({ ...d, waitlist: d.waitlist.filter((w) => w.id !== id) })),

      saveNote: (n) => {
        const id = n.id ?? uid("N");
        mutate((d) => {
          const exists = d.notes.some((x) => x.id === id);
          const note = { ...n, id } as SessionNote;
          return {
            ...d,
            notes: exists ? d.notes.map((x) => (x.id === id ? note : x)) : [note, ...d.notes],
            activity: log(d, {
              title: n.status === "signed" ? "Clinical note signed" : "Clinical note draft saved",
              detail: `${short(n.patientId)} · by ${staffById(n.clinicianId)?.name ?? ""}`,
              kind: "note",
            }),
          };
        });
        return id;
      },

      addFollowUp: (f) =>
        mutate((d) => ({
          ...d,
          followUps: [
            ...d.followUps,
            { ...f, id: uid("F"), dueDate: isoDate(addDays(parseDate(f.lastConsultation), f.intervalWeeks * 7)), completed: false },
          ],
          activity: log(d, { title: "Follow-up scheduled", detail: `${short(f.patientId)} · in ${f.intervalWeeks} weeks`, kind: "plan" }),
        })),
      updateFollowUp: (id, patch) => mutate((d) => ({ ...d, followUps: d.followUps.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),

      addTask: (t) =>
        mutate((d) => ({
          ...d,
          tasks: [{ ...t, id: uid("T"), createdAt: new Date().toISOString(), status: "pending", createdById: d.currentUserId }, ...d.tasks],
          activity: log(d, { title: "Task assigned", detail: `${t.title} → ${staffById(t.assigneeId)?.name}`, kind: "task" }),
        })),
      updateTask: (id, patch) => mutate((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      ensureThread: (kind, patientId) => {
        const existing = db.threads.find((t) => t.kind === kind && t.patientId === patientId);
        if (existing) return existing.id;
        const id = uid("TH");
        mutate((d) => ({ ...d, threads: [...d.threads, { id, kind, patientId, title: kind === "team" ? "Care team" : "Patient portal" }] }));
        return id;
      },
      sendMessage: (threadId, body, urgent, authorId) =>
        mutate((d) => {
          const thread = d.threads.find((t) => t.id === threadId);
          const msg: Message = { id: uid("M"), threadId, authorId: authorId ?? d.currentUserId, body, at: new Date().toISOString(), urgent };
          let alerts = d.alerts;
          let activity = d.activity;
          if (urgent && thread?.patientId) {
            const p = d.patients.find((x) => x.id === thread.patientId);
            alerts = [
              {
                id: uid("AL"),
                patientId: thread.patientId,
                message: body,
                receivedAt: msg.at,
                severity: "urgent",
                status: "awaiting",
                clinicianId: p?.clinicianId ?? d.currentUserId,
              },
              ...d.alerts,
            ];
            activity = log(d, { title: "Urgent message escalated", detail: `${short(thread.patientId)} · assigned clinician notified`, kind: "alert" });
          }
          return { ...d, messages: [...d.messages, msg], alerts, activity };
        }),

      updateAlert: (id, status) => mutate((d) => ({ ...d, alerts: d.alerts.map((a) => (a.id === id ? { ...a, status } : a)) })),

      resetDemo: () => setDb(buildSeed(new Date())),
    };
  }, [db, now, mutate]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** Use inside the app shell — the shell only renders children once the store is ready. */
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store not ready");
  return s;
}

export function useStoreMaybe() {
  return useContext(Ctx);
}

// ---------- derived helpers ----------

export function followUpStatus(f: FollowUp, now: Date, appts: Appointment[]): "Completed" | "Booked" | "Overdue" | "Booking required" | "Upcoming" {
  if (f.completed) return "Completed";
  const booked = f.appointmentId && appts.find((a) => a.id === f.appointmentId && a.status !== "cancelled");
  if (booked) return "Booked";
  const due = parseDate(f.dueDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (due < today) return "Overdue";
  const days = (due.getTime() - today.getTime()) / 86400000;
  return days <= 7 ? "Booking required" : "Upcoming";
}

export function recordCompleteness(p: Patient) {
  const items = [
    { label: "Patient demographics", ok: !!(p.dob && p.gender) },
    { label: "Contact information", ok: !!(p.phone && p.email) },
    { label: "Emergency contact", ok: !!p.emergencyContact },
    { label: "Psychiatric history", ok: !!p.record.history.trim() },
    { label: "Assessment and diagnosis", ok: !!(p.record.assessment.trim() && p.record.diagnosis.trim()) },
    { label: "Treatment plan", ok: !!p.record.treatmentPlan.trim() },
    { label: "Consent documentation", ok: p.record.consentSigned },
  ];
  const pct = Math.round((items.filter((i) => i.ok).length / items.length) * 100);
  return { items, pct };
}

export function appointmentsOn(appts: Appointment[], day: Date) {
  return appts.filter((a) => sameDay(new Date(a.start), day)).sort((a, b) => a.start.localeCompare(b.start));
}
