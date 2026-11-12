"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileText, History, Mic, MicOff, Sparkles, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import type { NoteTemplate, SessionNote } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, Field, Select, Textarea, useToast } from "./ui";

export const TEMPLATE_SECTIONS: Record<NoteTemplate, { name: string; hint: string }[]> = {
  SOAP: [
    { name: "Subjective", hint: "What the client reports: mood, symptoms, events since last session" },
    { name: "Objective", hint: "Observations: appearance, behaviour, speech, scores" },
    { name: "Assessment", hint: "Clinical interpretation and progress toward goals" },
    { name: "Plan", hint: "Next steps, homework, next session" },
  ],
  DAP: [
    { name: "Data", hint: "Subjective and objective information from the session" },
    { name: "Assessment", hint: "Clinical interpretation" },
    { name: "Plan", hint: "Interventions and next steps" },
  ],
  BIRP: [
    { name: "Behaviour", hint: "Client presentation and reported behaviour" },
    { name: "Intervention", hint: "Techniques and interventions used" },
    { name: "Response", hint: "How the client responded" },
    { name: "Plan", hint: "Next steps" },
  ],
};

const MODALITIES = [
  "Cognitive Behavioural Therapy (CBT)",
  "Dialectical Behaviour Therapy (DBT)",
  "Trauma-focused CBT",
  "EMDR",
  "Acceptance and Commitment Therapy (ACT)",
  "Psychodynamic",
  "Supportive counselling",
  "Medication management",
];
const AFFECTS = ["Euthymic", "Anxious", "Low", "Flat", "Irritable", "Elevated", "Tearful"];

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
};

export function NoteEditor({ existing, initialPatientId }: { existing?: SessionNote; initialPatientId?: string }) {
  const { db, me, saveNote, patientById } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [patientId, setPatientId] = useState(existing?.patientId ?? initialPatientId ?? "");
  const [sessionType, setSessionType] = useState<SessionNote["sessionType"]>(existing?.sessionType ?? "Individual");
  const [modality, setModality] = useState(existing?.modality ?? MODALITIES[0]);
  const [affect, setAffect] = useState(existing?.affect ?? "");
  const [template, setTemplate] = useState<NoteTemplate>(existing?.template ?? "SOAP");
  const [sections, setSections] = useState<Record<string, string>>(existing?.sections ?? {});
  const [focused, setFocused] = useState<string>(TEMPLATE_SECTIONS[existing?.template ?? "SOAP"][0].name);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<SR | null>(null);
  const focusedRef = useRef(focused);
  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  const signed = existing?.status === "signed";
  const patient = patientById(patientId);
  const lastNote = db.notes
    .filter((n) => n.patientId === patientId && n.id !== existing?.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  useEffect(() => () => recRef.current?.stop(), []);

  const toggleDictation = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast("Voice dictation isn't supported in this browser (try Chrome or Edge).", "error");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-GB";
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text) {
        const key = focusedRef.current;
        setSections((s) => ({ ...s, [key]: `${s[key] ? s[key].trimEnd() + " " : ""}${text.trim()}` }));
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const prefill = () => {
    if (!patient) return setError("Choose a patient first.");
    const o = patient.outcomes.at(-1);
    const prev = patient.outcomes.at(-2);
    const trend = o && prev ? (o.phq9 < prev.phq9 ? "improving" : o.phq9 > prev.phq9 ? "worsening" : "stable") : "not yet measured";
    const base: Record<NoteTemplate, Record<string, string>> = {
      SOAP: {
        Subjective: `${patient.firstName} attended for ${sessionType.toLowerCase()} session. Presenting focus: ${patient.condition.toLowerCase()}.`,
        Objective: `Affect: ${affect || "—"}. ${o ? `PHQ-9: ${o.phq9}, GAD-7: ${o.gad7} (${trend}).` : ""}`,
        Assessment: `Working diagnosis: ${patient.record.diagnosis || "to be confirmed"}.`,
        Plan: patient.record.treatmentPlan || "",
      },
      DAP: {
        Data: `${patient.firstName} attended for ${sessionType.toLowerCase()} session. Affect: ${affect || "—"}. ${o ? `PHQ-9 ${o.phq9}, GAD-7 ${o.gad7}.` : ""}`,
        Assessment: `Working diagnosis: ${patient.record.diagnosis || "to be confirmed"}. Symptom trend ${trend}.`,
        Plan: patient.record.treatmentPlan || "",
      },
      BIRP: {
        Behaviour: `Affect: ${affect || "—"}. ${o ? `PHQ-9 ${o.phq9}, GAD-7 ${o.gad7} (${trend}).` : ""}`,
        Intervention: `${modality}.`,
        Response: "",
        Plan: patient.record.treatmentPlan || "",
      },
    };
    setSections((s) => {
      const next = { ...s };
      for (const [k, v] of Object.entries(base[template])) if (!next[k]?.trim()) next[k] = v;
      return next;
    });
    toast("Pre-filled from the patient record — review before signing");
  };

  const save = (status: SessionNote["status"]) => {
    if (!patientId) return setError("Choose a patient.");
    const names = TEMPLATE_SECTIONS[template].map((s) => s.name);
    const filtered = Object.fromEntries(names.map((n) => [n, sections[n] ?? ""]));
    if (status === "signed" && names.some((n) => !filtered[n].trim())) return setError("All sections must be completed before signing.");
    const id = saveNote({
      id: existing?.id,
      patientId,
      clinicianId: existing?.clinicianId ?? me.id,
      date: existing?.date ?? new Date().toISOString(),
      sessionType,
      modality,
      affect,
      template,
      sections: filtered,
      status,
    });
    toast(status === "signed" ? "Note signed and locked" : "Draft saved");
    router.push(`/notes/${id}`);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={Users} title="Session information" action={existing && <Badge tone={signed ? "green" : "amber"}>{existing.status}</Badge>} />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Patient">
            <Select value={patientId} onChange={(e) => (setPatientId(e.target.value), setError(""))} disabled={!!existing}>
              <option value="">Select patient…</option>
              {db.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.firstName} {p.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Session type">
            <Select value={sessionType} onChange={(e) => setSessionType(e.target.value as SessionNote["sessionType"])} disabled={signed}>
              {["Individual", "Group", "Family", "Couples"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Therapeutic modality">
            <Select value={modality} onChange={(e) => setModality(e.target.value)} disabled={signed}>
              {MODALITIES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Client affect">
            <Select value={affect} onChange={(e) => setAffect(e.target.value)} disabled={signed}>
              <option value="">Select client affect</option>
              {AFFECTS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {!signed && (
        <Card>
          <CardHeader icon={FileText} title="Note template" />
          <div className="px-5 pb-5">
            <Select value={template} onChange={(e) => (setTemplate(e.target.value as NoteTemplate), setFocused(TEMPLATE_SECTIONS[e.target.value as NoteTemplate][0].name))} className="max-w-xs">
              <option value="SOAP">SOAP — Subjective, Objective, Assessment, Plan</option>
              <option value="DAP">DAP — Data, Assessment, Plan</option>
              <option value="BIRP">BIRP — Behaviour, Intervention, Response, Plan</option>
            </Select>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <HelperCard tone="purple" icon={Sparkles} title="Pre-fill note" desc="Start from the patient's record and latest scores" action="Pre-fill from record" onClick={prefill} />
              <HelperCard
                tone="blue"
                icon={listening ? MicOff : Mic}
                title="Voice dictation"
                desc={listening ? `Listening… dictating into “${focused}”` : "Speak your notes into the selected section"}
                action={listening ? "Stop dictation" : "Start dictation"}
                onClick={toggleDictation}
                active={listening}
              />
              <HelperCard
                tone="green"
                icon={History}
                title="Use last note"
                desc={lastNote ? `Import from ${fmtDate(new Date(lastNote.date), { day: "numeric", month: "short" })}` : "No previous note for this patient"}
                action="Load last note"
                disabled={!lastNote}
                onClick={() => {
                  if (!lastNote) return;
                  setTemplate(lastNote.template);
                  setModality(lastNote.modality);
                  setSections(lastNote.sections);
                  toast("Previous note loaded — update for this session");
                }}
              />
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader icon={FileText} title="Note content" />
        <div className="space-y-4 px-5 pb-5">
          {TEMPLATE_SECTIONS[template].map((s) => (
            <div key={s.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{s.name}</h3>
                {focused === s.name && listening && <span className="text-xs font-medium text-sky-600">● dictating here</span>}
              </div>
              {signed ? (
                <p className="whitespace-pre-wrap rounded-xl bg-canvas px-4 py-3 text-sm leading-relaxed">{sections[s.name] || "—"}</p>
              ) : (
                <Textarea
                  value={sections[s.name] ?? ""}
                  onFocus={() => setFocused(s.name)}
                  onChange={(e) => setSections((x) => ({ ...x, [s.name]: e.target.value }))}
                  placeholder={s.hint}
                  className={cn("min-h-28", focused === s.name && listening && "border-sky-400 ring-2 ring-sky-100")}
                />
              )}
            </div>
          ))}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!signed && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => save("draft")}>
                Save draft
              </Button>
              <Button onClick={() => save("signed")}>Sign & lock note</Button>
            </div>
          )}
          {signed && <p className="text-xs text-muted">Signed notes are locked. Add an addendum by creating a new note.</p>}
        </div>
      </Card>
    </div>
  );
}

function HelperCard({
  tone,
  icon: Icon,
  title,
  desc,
  action,
  onClick,
  disabled,
  active,
}: {
  tone: "purple" | "blue" | "green";
  icon: typeof Mic;
  title: string;
  desc: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const c = {
    purple: ["border-brand-200 bg-brand-50/60", "bg-brand-600 hover:bg-brand-700", "text-brand-600"],
    blue: ["border-sky-200 bg-sky-50/60", "bg-sky-600 hover:bg-sky-700", "text-sky-600"],
    green: ["border-emerald-200 bg-emerald-50/60", "bg-emerald-600 hover:bg-emerald-700", "text-emerald-600"],
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-4", c[0], active && "ring-2 ring-sky-300")}>
      <div className="flex items-center gap-2 font-semibold">
        <Icon className={cn("size-4", c[2])} /> {title}
      </div>
      <p className="mt-1 min-h-10 text-xs text-muted">{desc}</p>
      <button disabled={disabled} onClick={onClick} className={cn("mt-2 h-9 w-full rounded-lg text-sm font-medium text-white disabled:opacity-40", c[1])}>
        {action}
      </button>
    </div>
  );
}
