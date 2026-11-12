"use client";

import Link from "next/link";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  FileHeart,
  FilePen,
  Files,
  ClipboardPlus,
  LineChart as LineIcon,
  MessagesSquare,
  NotebookPen,
  Pencil,
  Stethoscope,
  Target,
} from "lucide-react";
import { followUpStatus, recordCompleteness, useStore } from "@/lib/store";
import type { ClinicalRecord, Patient } from "@/lib/types";
import { ageFrom, cn, fmtDate, fmtTime, isoDate } from "@/lib/utils";
import { ApptStatus, BookAppointmentModal, CLINICAL_ROLES, CreateTaskModal } from "@/components/forms";
import { AppointmentDetailModal } from "@/components/AppointmentDetail";
import { Badge, Button, Card, CardHeader, Empty, Field, Input, Modal, Progress, Select, Textarea, useToast } from "@/components/ui";

export function PatientProfile({ id }: { id: string }) {
  const { db, now, patientById, staffById, updateFollowUp } = useStore();
  const p = patientById(id);
  const [modal, setModal] = useState<null | "book" | "task" | "edit" | "measure">(null);
  const [openAppt, setOpenAppt] = useState<string | null>(null);

  if (!p) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted">No patient with ID {id}.</p>
        <Link href="/patients" className="mt-3 inline-block text-sm font-medium text-brand-600">
          Back to patients
        </Link>
      </Card>
    );
  }

  const clinician = staffById(p.clinicianId);
  const appts = db.appointments.filter((a) => a.patientId === p.id).sort((a, b) => b.start.localeCompare(a.start));
  const next = [...appts].reverse().find((a) => new Date(a.start) > now && a.status !== "cancelled");
  const followUps = db.followUps.filter((f) => f.patientId === p.id);
  const openFollowUp = followUps.find((f) => !f.completed);
  const completeness = recordCompleteness(p);
  const notes = db.notes.filter((n) => n.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const past = appts.filter((a) => new Date(a.start) < now);
  const attended = past.filter((a) => a.status === "completed").length;
  const missed = past.filter((a) => a.status === "no-show").length;
  const cancelled = past.filter((a) => a.status === "cancelled").length;

  return (
    <>
      <Link href="/patients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Patients
      </Link>

      <div className="overflow-hidden rounded-2xl bg-navy-800 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-white/60">Patient profile / {p.id}</div>
            <h1 className="mt-1 text-3xl font-bold">
              {p.firstName} {p.lastName}
            </h1>
            <div className="mt-1 text-sm text-white/70">
              {ageFrom(p.dob) != null ? `Age ${ageFrom(p.dob)} · ` : ""}Patient since {fmtDate(p.registeredAt, { month: "long", year: "numeric" })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={cn("rounded-full px-3 py-1 text-xs font-medium", p.status === "active" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/70")}>
                {p.status[0].toUpperCase() + p.status.slice(1)} patient
              </span>
              {openFollowUp && <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-medium text-sky-300">Follow-up {followUpStatus(openFollowUp, now, db.appointments).toLowerCase()}</span>}
              {p.risk === "high" && <span className="rounded-full bg-rose-400/20 px-3 py-1 text-xs font-medium text-rose-200">High risk</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal("book")} className="border-transparent">
              <CalendarPlus className="size-4" /> Book
            </Button>
            <Link href={`/notes/new?patient=${p.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-4 text-sm font-medium hover:bg-white/20">
              <NotebookPen className="size-4" /> Session note
            </Link>
            <Button onClick={() => setModal("task")} className="bg-white/10 hover:bg-white/20">
              <ClipboardList className="size-4" /> Task
            </Button>
          </div>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-3">
          <Tile label="Assigned clinician" value={clinician?.name ?? "—"} />
          <Tile label="Next appointment" value={next ? `${fmtDate(new Date(next.start), { day: "numeric", month: "short" })} · ${fmtTime(next.start)}` : "Not booked"} />
          <Tile label="Attendance" value={`${attended} attended · ${missed} missed · ${cancelled} cancelled`} small />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader
              title="Patient information"
              action={
                <Button size="sm" variant="ghost" onClick={() => setModal("edit")}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              }
            />
            <dl className="grid gap-x-8 px-5 pb-5 text-sm sm:grid-cols-2">
              {[
                ["Patient ID", p.id],
                ["Date of birth", p.dob ? fmtDate(p.dob) : "—"],
                ["Gender", p.gender || "—"],
                ["Phone", p.phone || "—"],
                ["Email", p.email || "—"],
                ["Emergency contact", p.emergencyContact || "Missing"],
                ["Registration", fmtDate(p.registeredAt)],
                ["Primary concern", p.condition],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className={cn("text-right font-medium", v === "Missing" && "text-rose-600")}>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <ClinicalRecordCard patient={p} />

          <Card>
            <CardHeader
              icon={LineIcon}
              title="Progress and outcomes"
              action={
                <Button size="sm" variant="ghost" onClick={() => setModal("measure")}>
                  + Add measure
                </Button>
              }
            />
            {p.outcomes.length === 0 ? (
              <Empty>No symptom measures recorded yet.</Empty>
            ) : (
              <div className="h-64 px-3 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={p.outcomes.map((o) => ({ ...o, label: fmtDate(o.date, { day: "numeric", month: "short" }) }))} margin={{ top: 8, right: 16, left: -16 }}>
                    <CartesianGrid stroke="#eef0f5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#646a82" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#646a82" }} axisLine={false} tickLine={false} domain={[0, 27]} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line dataKey="phq9" name="PHQ-9 (depression)" stroke="#6d4ee8" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line dataKey="gad7" name="GAD-7 (anxiety)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={FilePen} title="Session notes" action={<Link href={`/notes/new?patient=${p.id}`} className="text-xs font-medium text-brand-600 hover:underline">+ New note</Link>} />
            {notes.length === 0 ? (
              <Empty>No session notes yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {notes.slice(0, 6).map((n) => (
                  <li key={n.id}>
                    <Link href={`/notes/${n.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {n.template} note · {n.modality}
                        </div>
                        <div className="truncate text-xs text-muted">{Object.values(n.sections)[0]}</div>
                      </div>
                      <span className="text-xs text-muted">{fmtDate(new Date(n.date), { day: "numeric", month: "short" })}</span>
                      <Badge tone={n.status === "signed" ? "green" : "amber"}>{n.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Record completeness" action={<Badge tone={completeness.pct === 100 ? "green" : "amber"}>{completeness.pct === 100 ? "Complete" : "Incomplete"}</Badge>} />
            <div className="px-5 pb-5">
              <Progress value={completeness.pct} tone={completeness.pct === 100 ? "green" : "amber"} />
              <div className="mt-1.5 text-xs text-muted">{completeness.pct}% complete</div>
              <ul className="mt-3 space-y-2 text-sm">
                {completeness.items.map((i) => (
                  <li key={i.label} className="flex items-center gap-2">
                    {i.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertCircle className="size-4 text-amber-600" />}
                    <span className={i.ok ? "" : "text-amber-800"}>
                      {i.label}
                      {!i.ok && " — missing"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Follow-up management" action={<Link href="/follow-ups" className="text-xs font-medium text-brand-600 hover:underline">All follow-ups</Link>} />
            <div className="px-5 pb-5 text-sm">
              {openFollowUp ? (
                <FollowUpSummary fuId={openFollowUp.id} onBook={() => setModal("book")} />
              ) : (
                <p className="text-muted">No open follow-up. One is created when an appointment is marked as attended.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Appointments" />
            <ul className="scroll-thin max-h-80 divide-y divide-line overflow-y-auto">
              {appts.length === 0 && <Empty>No appointments.</Empty>}
              {appts.slice(0, 20).map((a) => (
                <li key={a.id}>
                  <button className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-canvas" onClick={() => setOpenAppt(a.id)}>
                    <span className="w-24 shrink-0 tabular-nums text-muted">{fmtDate(new Date(a.start), { day: "numeric", month: "short" })} {fmtTime(a.start)}</span>
                    <span className="flex-1 truncate">{a.type}</span>
                    <ApptStatus status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader icon={MessagesSquare} title="Care team" action={<Link href={`/messages?patient=${p.id}`} className="text-xs font-medium text-brand-600 hover:underline">Open thread</Link>} />
            <ul className="space-y-3 px-5 pb-5">
              {db.messages
                .filter((m) => db.threads.find((t) => t.id === m.threadId && t.patientId === p.id && t.kind === "team"))
                .slice(-3)
                .map((m) => (
                  <li key={m.id} className="text-sm">
                    <div className="text-xs font-semibold">{staffById(m.authorId)?.role ?? "Staff"}</div>
                    <div className="mt-0.5 rounded-xl bg-canvas px-3 py-2">{m.body}</div>
                  </li>
                ))}
              <li className="text-xs text-muted">
                Team: {[...new Set([p.clinicianId, ...appts.map((a) => a.clinicianId)])].map((id) => staffById(id)?.name).join(", ")}
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <BookAppointmentModal
        open={modal === "book"}
        onClose={() => setModal(null)}
        defaults={{ patientId: p.id, type: openFollowUp ? "Follow-up" : "Therapy" }}
        onBooked={(apptId) => openFollowUp && !openFollowUp.appointmentId && updateFollowUp(openFollowUp.id, { appointmentId: apptId })}
      />
      <CreateTaskModal open={modal === "task"} onClose={() => setModal(null)} patientId={p.id} />
      <EditPatientModal open={modal === "edit"} onClose={() => setModal(null)} patient={p} />
      <AddMeasureModal open={modal === "measure"} onClose={() => setModal(null)} patient={p} />
      <AppointmentDetailModal id={openAppt} onClose={() => setOpenAppt(null)} />
    </>
  );
}

function Tile({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-navy-800 px-6 py-4">
      <div className="text-xs text-white/60">{label}</div>
      <div className={cn("mt-0.5 font-semibold", small ? "text-sm" : "text-lg")}>{value}</div>
    </div>
  );
}

function FollowUpSummary({ fuId, onBook }: { fuId: string; onBook: () => void }) {
  const { db, now } = useStore();
  const f = db.followUps.find((x) => x.id === fuId)!;
  const s = followUpStatus(f, now, db.appointments);
  return (
    <div className="space-y-2">
      <Row k="Last consultation" v={fmtDate(f.lastConsultation, { day: "numeric", month: "long", year: "numeric" })} />
      <Row k="Recommended follow-up" v={`${f.intervalWeeks} weeks`} />
      <div className="flex items-center justify-between">
        <span className="text-muted">Due</span>
        <span className="flex items-center gap-2 font-medium">
          {fmtDate(f.dueDate, { day: "numeric", month: "long" })}
          <Badge tone={s === "Overdue" ? "red" : s === "Booking required" ? "amber" : s === "Booked" ? "green" : "blue"}>{s}</Badge>
        </span>
      </div>
      <Row k="Assigned professional" v={f.role} />
      {(s === "Overdue" || s === "Booking required" || s === "Upcoming") && (
        <Button size="sm" className="mt-2 w-full" onClick={onBook}>
          Book follow-up
        </Button>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

const SECTIONS: { key: keyof ClinicalRecord | "documents"; title: string; desc: string; icon: typeof Target; fields: (keyof ClinicalRecord)[] }[] = [
  { key: "presentingConcerns", title: "Presenting concerns", desc: "Initial complaints, symptoms and reason for seeking care", icon: ClipboardPlus, fields: ["presentingConcerns"] },
  { key: "history", title: "Psychiatric / clinical history", desc: "Previous treatment, relevant history and medication", icon: FileHeart, fields: ["history", "medications"] },
  { key: "assessment", title: "Assessment and diagnosis", desc: "Clinician-authored assessment and diagnosis", icon: Stethoscope, fields: ["assessment", "diagnosis"] },
  { key: "treatmentPlan", title: "Treatment plan", desc: "Therapeutic interventions and treatment objectives", icon: Target, fields: ["treatmentPlan"] },
  { key: "documents", title: "Documents and forms", desc: "Consent, assessments and uploaded reports", icon: Files, fields: [] },
];

const fieldLabel: Record<keyof ClinicalRecord, string> = {
  presentingConcerns: "Presenting concerns",
  history: "Psychiatric history",
  medications: "Current medication",
  assessment: "Assessment",
  diagnosis: "Diagnosis",
  treatmentPlan: "Treatment plan",
  consentSigned: "Consent",
};

function ClinicalRecordCard({ patient }: { patient: Patient }) {
  const { updatePatient } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ClinicalRecord>>({});

  return (
    <Card>
      <CardHeader title="Clinical record" />
      <ul className="divide-y divide-line border-t border-line">
        {SECTIONS.map((s) => {
          const isOpen = open === s.key;
          const isEditing = editing === s.key;
          const missing = s.key === "documents" ? !patient.record.consentSigned : s.fields.some((f) => !String(patient.record[f]).trim());
          return (
            <li key={s.key}>
              <button className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-canvas" onClick={() => setOpen(isOpen ? null : s.key)}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas">
                  <s.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {s.title} {missing && <Badge tone="amber">Incomplete</Badge>}
                  </span>
                  <span className="block text-sm text-muted">{s.desc}</span>
                </span>
                <ChevronDown className={cn("size-5 text-muted transition", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pl-[76px] text-sm">
                  {s.key === "documents" ? (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-brand-600"
                          checked={patient.record.consentSigned}
                          onChange={(e) => {
                            updatePatient(patient.id, { record: { ...patient.record, consentSigned: e.target.checked } });
                            toast(e.target.checked ? "Consent recorded" : "Consent removed");
                          }}
                        />
                        Treatment consent form signed and on file
                      </label>
                      <p className="text-muted">PHQ-9 and GAD-7 assessments: {patient.outcomes.length} recorded.</p>
                    </div>
                  ) : isEditing ? (
                    <div className="space-y-3">
                      {s.fields.map((f) => (
                        <Field key={f} label={fieldLabel[f]}>
                          <Textarea value={String(draft[f] ?? patient.record[f])} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} />
                        </Field>
                      ))}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            updatePatient(patient.id, { record: { ...patient.record, ...draft } });
                            setEditing(null);
                            setDraft({});
                            toast("Clinical record updated");
                          }}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => (setEditing(null), setDraft({}))}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {s.fields.map((f) => (
                        <div key={f}>
                          {s.fields.length > 1 && <div className="text-xs font-medium text-muted">{fieldLabel[f]}</div>}
                          <p className={cn("leading-relaxed", !String(patient.record[f]).trim() && "italic text-muted")}>
                            {String(patient.record[f]).trim() || "Not yet documented."}
                          </p>
                        </div>
                      ))}
                      <Button size="sm" variant="secondary" onClick={() => setEditing(s.key)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function EditPatientModal({ open, onClose, patient }: { open: boolean; onClose: () => void; patient: Patient }) {
  return (
    <Modal open={open} onClose={onClose} title="Edit patient information" wide>
      {open && <EditPatientForm patient={patient} onClose={onClose} />}
    </Modal>
  );
}

function EditPatientForm({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { db, updatePatient } = useStore();
  const toast = useToast();
  const [f, setF] = useState(patient);
  const set = <K extends keyof Patient>(k: K, v: Patient[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Last name">
          <Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <Field label="Date of birth">
          <Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
        </Field>
        <Field label="Gender">
          <Select value={f.gender} onChange={(e) => set("gender", e.target.value as Patient["gender"])}>
            <option value="">Prefer not to say</option>
            <option>Female</option>
            <option>Male</option>
            <option>Non-binary</option>
          </Select>
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Emergency contact">
          <Input value={f.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} />
        </Field>
        <Field label="Assigned clinician">
          <Select value={f.clinicianId} onChange={(e) => set("clinicianId", e.target.value)}>
            {db.staff
              .filter((s) => CLINICAL_ROLES.includes(s.role))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={(e) => set("status", e.target.value as Patient["status"])}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discharged">Discharged</option>
          </Select>
        </Field>
        <Field label="Risk level">
          <Select value={f.risk} onChange={(e) => set("risk", e.target.value as Patient["risk"])}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            updatePatient(patient.id, f);
            toast("Patient information saved");
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function AddMeasureModal({ open, onClose, patient }: { open: boolean; onClose: () => void; patient: Patient }) {
  const { updatePatient, now } = useStore();
  const toast = useToast();
  const [date, setDate] = useState(isoDate(now));
  const [phq9, setPhq9] = useState(10);
  const [gad7, setGad7] = useState(8);
  return (
    <Modal open={open} onClose={onClose} title="Record symptom measures">
      <div className="space-y-4">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="PHQ-9 (0–27)">
            <Input type="number" min={0} max={27} value={phq9} onChange={(e) => setPhq9(Math.min(27, Math.max(0, Number(e.target.value))))} />
          </Field>
          <Field label="GAD-7 (0–21)">
            <Input type="number" min={0} max={21} value={gad7} onChange={(e) => setGad7(Math.min(21, Math.max(0, Number(e.target.value))))} />
          </Field>
        </div>
        <Button
          className="w-full"
          onClick={() => {
            const outcomes = [...patient.outcomes, { date, phq9, gad7 }].sort((a, b) => a.date.localeCompare(b.date));
            updatePatient(patient.id, { outcomes });
            toast("Measures recorded");
            onClose();
          }}
        >
          Save measures
        </Button>
      </div>
    </Modal>
  );
}
