import type {
  Activity,
  Appointment,
  AppointmentType,
  ClinicalAlert,
  Condition,
  DB,
  FollowUp,
  Message,
  Patient,
  SessionNote,
  Staff,
  Task,
  Thread,
} from "./types";
import { addDays, isoDate, startOfDay, timeToMinutes } from "./utils";

export const DB_VERSION = 3;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const staff: Staff[] = [
  { id: "s1", name: "Dr. Emily Carter", role: "Psychologist", hours: ["09:00", "17:00"], initials: "EC" },
  { id: "s2", name: "Dr. James Wilson", role: "Psychiatrist", hours: ["10:00", "18:00"], initials: "JW" },
  { id: "s3", name: "Nurse Sarah Mitchell", role: "Clinical nurse", hours: ["09:00", "15:00"], initials: "SM" },
  { id: "s4", name: "Dr. Aisha Perera", role: "Psychiatrist", hours: ["09:00", "17:00"], initials: "AP" },
  { id: "s5", name: "Tom Reyes", role: "Receptionist", hours: ["08:00", "18:00"], initials: "TR" },
  { id: "s6", name: "Lina Haddad", role: "Coordinator", hours: ["09:00", "17:00"], initials: "LH" },
];

const clinicians = ["s1", "s2", "s3", "s4"];

type P = [string, string, string, Patient["gender"], Condition, Patient["risk"], string, Patient["status"]];
const rawPatients: P[] = [
  ["Alex", "Morgan", "1997-04-18", "Non-binary", "Anxiety", "medium", "s1", "active"],
  ["Sarah", "Johnson", "1988-09-02", "Female", "Depression", "high", "s1", "active"],
  ["Michael", "Brown", "1975-01-27", "Male", "Bipolar", "medium", "s2", "active"],
  ["Daniel", "Lee", "2001-06-11", "Male", "Anxiety", "low", "s1", "active"],
  ["Samira", "Khalil", "1993-12-05", "Female", "PTSD", "medium", "s4", "active"],
  ["Rohan", "Patel", "1984-03-14", "Male", "Depression", "low", "s2", "active"],
  ["Ayesha", "Malik", "1999-08-23", "Female", "Anxiety", "low", "s1", "active"],
  ["Nethmi", "Dias", "1991-11-30", "Female", "Depression", "medium", "s4", "active"],
  ["Kavindu", "Silva", "1986-02-08", "Male", "Psychosis", "high", "s2", "active"],
  ["Ishara", "Kumar", "2003-05-19", "Female", "Other", "low", "s3", "active"],
  ["Lucas", "Martin", "1979-07-07", "Male", "Depression", "medium", "s4", "active"],
  ["Emma", "Fischer", "1995-10-12", "Female", "Anxiety", "low", "s1", "active"],
  ["Omar", "Haddad", "1982-04-03", "Male", "PTSD", "medium", "s4", "active"],
  ["Chloe", "Nguyen", "2000-01-21", "Female", "Bipolar", "medium", "s2", "active"],
  ["Ruwan", "Mendis", "1970-09-15", "Male", "Depression", "low", "s3", "inactive"],
  ["Grace", "O'Neill", "1990-03-28", "Female", "Other", "low", "s1", "discharged"],
];

const concerns: Record<Condition, string> = {
  Depression: "Persistent low mood, reduced energy and loss of interest in usual activities for over 3 months. Reports poor sleep and difficulty concentrating at work.",
  Anxiety: "Excessive worry about work and relationships, restlessness, palpitations in social situations. Avoidance is beginning to affect daily functioning.",
  Bipolar: "History of mood episodes; recent period of elevated mood with reduced need for sleep followed by a depressive phase.",
  PTSD: "Intrusive memories and nightmares following a traumatic event, hypervigilance and avoidance of reminders.",
  Psychosis: "Referred after a period of disorganised thinking and perceptual disturbances. Currently stabilising on medication.",
  Other: "Adjustment difficulties following a major life change; stress affecting sleep and studies.",
};

const plans: Record<Condition, string> = {
  Depression: "Weekly CBT for 12 sessions focusing on behavioural activation and cognitive restructuring. Review antidepressant response at 6 weeks. PHQ-9 every 2 weeks.",
  Anxiety: "CBT with graded exposure, relaxation and breathing skills. GAD-7 monitoring fortnightly. Consider SSRI if limited response after 8 sessions.",
  Bipolar: "Mood stabiliser with regular level monitoring; psychoeducation and relapse-prevention plan; sleep hygiene.",
  PTSD: "Trauma-focused CBT / EMDR, 12–16 sessions. Grounding techniques; safety plan reviewed.",
  Psychosis: "Antipsychotic medication with monthly psychiatric review; family psychoeducation; early-warning-signs plan.",
  Other: "Short-term supportive counselling, problem-solving therapy and stress management (6 sessions).",
};

const diagnoses: Record<Condition, string> = {
  Depression: "Major depressive disorder, single episode, moderate (F32.1)",
  Anxiety: "Generalised anxiety disorder (F41.1)",
  Bipolar: "Bipolar affective disorder, current episode depressed (F31.3)",
  PTSD: "Post-traumatic stress disorder (F43.1)",
  Psychosis: "Acute and transient psychotic disorder (F23)",
  Other: "Adjustment disorder (F43.2)",
};

const meds: Record<Condition, string> = {
  Depression: "Sertraline 100 mg once daily",
  Anxiety: "None currently",
  Bipolar: "Lithium carbonate 800 mg nightly; Quetiapine 50 mg PRN",
  PTSD: "Prazosin 2 mg at night",
  Psychosis: "Aripiprazole 10 mg once daily",
  Other: "None",
};

export function buildSeed(now: Date = new Date()): DB {
  const r = rng(42);
  const today = startOfDay(now);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];

  const patients: Patient[] = rawPatients.map(([first, last, dob, gender, condition, risk, clinicianId, status], i) => {
    const regOffset = 30 + Math.floor(r() * 300);
    const base = condition === "Anxiety" ? 9 : 16;
    const outcomes = Array.from({ length: 6 }, (_, k) => {
      const improvement = k * (1.4 + r() * 0.8);
      return {
        date: isoDate(addDays(today, -(5 - k) * 21)),
        phq9: Math.max(2, Math.round(base + 2 - improvement + (r() - 0.5) * 2)),
        gad7: Math.max(2, Math.round((condition === "Anxiety" ? 16 : 11) - improvement + (r() - 0.5) * 2)),
      };
    });
    // Leave a few records deliberately incomplete
    const incomplete = i % 4 === 0;
    return {
      id: `MC-${String(124 + i * 7).padStart(5, "0")}`,
      firstName: first,
      lastName: last,
      dob,
      gender,
      phone: `+44 7700 9${String(10000 + i * 731).slice(-5)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase().replace(/'/g, "")}@example.com`,
      emergencyContact: i % 5 === 2 ? "" : "Authorised contact on file",
      registeredAt: isoDate(addDays(today, -regOffset)),
      clinicianId,
      status,
      condition,
      risk,
      record: {
        presentingConcerns: concerns[condition],
        history: incomplete ? "" : "Previous episode treated in primary care. No inpatient admissions. Family history of mood disorder.",
        medications: meds[condition],
        assessment: "Engaged, good rapport. Insight present. No current intent or plan to self-harm.",
        diagnosis: diagnoses[condition],
        treatmentPlan: plans[condition],
        consentSigned: !incomplete,
      },
      outcomes,
    };
  });

  const active = patients.filter((p) => p.status === "active");
  const staffById = Object.fromEntries(staff.map((s) => [s.id, s]));

  // ---- Appointments: 3 weeks back, 2 weeks forward ----
  const appointments: Appointment[] = [];
  const types: AppointmentType[] = ["Therapy", "Therapy", "Follow-up", "Medication Review", "Care Plan Review"];
  let n = 1;
  for (let d = -21; d <= 14; d++) {
    const day = addDays(today, d);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    for (const cid of clinicians) {
      const s = staffById[cid];
      const startH = timeToMinutes(s.hours[0]) / 60;
      const endH = timeToMinutes(s.hours[1]) / 60;
      for (let h = startH; h < endH; h++) {
        if (h === 13) continue; // lunch
        const density = d === 0 ? 0.62 : 0.45;
        if (r() > density) continue;
        const own = active.filter((p) => p.clinicianId === cid);
        const patient = r() < 0.75 && own.length ? pick(own) : pick(active);
        const start = new Date(day);
        start.setHours(h, r() < 0.25 ? 30 : 0, 0, 0);
        if (start.getMinutes() === 30 && h + 1 >= endH) start.setMinutes(0);
        const end = new Date(start.getTime() + 50 * 60000);
        let status: Appointment["status"];
        const x = r();
        if (end < now) status = x < 0.84 ? "completed" : x < 0.93 ? "no-show" : "cancelled";
        else if (start <= now) status = "checked-in";
        else status = x < 0.6 ? "confirmed" : x < 0.95 ? "scheduled" : "cancelled";
        const hoursUntil = (start.getTime() - now.getTime()) / 3600000;
        appointments.push({
          id: `A-${n++}`,
          patientId: patient.id,
          clinicianId: cid,
          start: start.toISOString(),
          durationMin: 50,
          type: patient.outcomes && d < -14 && r() < 0.1 ? "Initial Assessment" : pick(types),
          status,
          channels: r() < 0.5 ? ["whatsapp", "email"] : r() < 0.5 ? ["sms", "email"] : ["whatsapp", "email", "sms"],
          confirmation: "delivered",
          reminder: hoursUntil < 24 ? "delivered" : "scheduled",
          response:
            status === "confirmed" || status === "completed" || status === "checked-in"
              ? "confirmed"
              : status === "cancelled"
                ? "cancelled"
                : status === "no-show"
                  ? "confirmed"
                  : r() < 0.2
                    ? "reschedule-requested"
                    : "awaiting",
        });
      }
    }
  }
  // Remove patient double-bookings created by the random generator
  const seen = new Set<string>();
  const deduped = appointments.filter((a) => {
    const key = `${a.patientId}|${a.start.slice(0, 13)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ---- Session notes for completed sessions in last 14 days ----
  const notes: SessionNote[] = [];
  deduped
    .filter((a) => a.status === "completed" && new Date(a.start) > addDays(today, -14))
    .forEach((a, i) => {
      const p = patients.find((x) => x.id === a.patientId)!;
      notes.push({
        id: `N-${i + 1}`,
        patientId: a.patientId,
        clinicianId: a.clinicianId,
        date: a.start,
        sessionType: "Individual",
        modality: p.condition === "PTSD" ? "Trauma-focused CBT" : "Cognitive Behavioural Therapy (CBT)",
        affect: pick(["Anxious", "Euthymic", "Low", "Flat", "Irritable"]),
        template: "SOAP",
        sections: {
          Subjective: `Client reports ${pick(["slightly improved mood", "ongoing worry about work", "better sleep this week", "increased stress at home"])}. Completed most of the agreed homework.`,
          Objective: `Appeared ${pick(["calm and engaged", "visibly tense", "tired but cooperative"])}. Speech normal in rate and volume. PHQ-9: ${p.outcomes.at(-1)!.phq9}, GAD-7: ${p.outcomes.at(-1)!.gad7}.`,
          Assessment: "Gradual progress toward treatment goals. No acute risk identified.",
          Plan: "Continue current plan. Practise thought records daily. Next session in one week.",
        },
        status: i % 7 === 3 ? "draft" : "signed",
      });
    });

  // ---- Follow-ups ----
  const fuSpec: [number, number, number, boolean][] = [
    // patientIdx, lastConsultation offset, interval weeks, completed
    [0, -12, 2, false],
    [1, -16, 2, false],
    [2, -24, 3, false],
    [3, -6, 3, false],
    [4, -20, 2, false],
    [5, -3, 4, false],
    [7, -10, 2, false],
    [8, -15, 2, false],
    [10, -30, 4, true],
    [11, -21, 2, true],
    [12, -7, 2, false],
    [13, -40, 4, true],
  ];
  const followUps: FollowUp[] = fuSpec.map(([pi, off, w, done], i) => {
    const p = patients[pi];
    const last = addDays(today, off);
    return {
      id: `F-${i + 1}`,
      patientId: p.id,
      lastConsultation: isoDate(last),
      intervalWeeks: w,
      dueDate: isoDate(addDays(last, w * 7)),
      role: staffById[p.clinicianId].role,
      completed: done,
    };
  });

  const P = (i: number) => patients[i].id;
  const at = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000).toISOString();

  // ---- Tasks ----
  const tasks: Task[] = [
    { id: "T-1", title: "Contact patient for follow-up", patientId: P(0), assigneeId: "s3", createdById: "s1", priority: "normal", due: isoDate(addDays(today, 1)), instructions: "Contact the patient regarding the agreed follow-up arrangements.", status: "pending", createdAt: at(300) },
    { id: "T-2", title: "Contact patient to confirm appointment", patientId: P(3), assigneeId: "s5", createdById: "s1", priority: "urgent", due: isoDate(today), instructions: "Patient has not responded to the reminder. Call to confirm.", status: "in-progress", createdAt: at(800) },
    { id: "T-3", title: "Update patient observations", patientId: P(8), assigneeId: "s3", createdById: "s2", priority: "normal", due: isoDate(addDays(today, 2)), instructions: "Record weight, BP and side-effect checklist at next visit.", status: "pending", createdAt: at(1500) },
    { id: "T-4", title: "Complete progress notes", patientId: P(1), assigneeId: "s1", createdById: "s6", priority: "normal", due: isoDate(today), instructions: "Two session notes are still in draft.", status: "pending", createdAt: at(200) },
    { id: "T-5", title: "Review flagged clinical information", patientId: P(1), assigneeId: "s2", createdById: "s1", priority: "urgent", due: isoDate(today), instructions: "PHQ-9 item 9 scored positive at last review. Please review care plan.", status: "pending", createdAt: at(90) },
    { id: "T-6", title: "Arrange multidisciplinary case review", patientId: P(2), assigneeId: "s6", createdById: "s2", priority: "low", due: isoDate(addDays(today, 6)), instructions: "Invite psychiatry, psychology and nursing.", status: "in-progress", createdAt: at(4000) },
    { id: "T-7", title: "Upload signed consent form", patientId: P(4), assigneeId: "s5", createdById: "s4", priority: "normal", due: isoDate(addDays(today, -1)), instructions: "Consent documentation missing from record.", status: "pending", createdAt: at(3000) },
    { id: "T-8", title: "Send lab request", patientId: P(2), assigneeId: "s3", createdById: "s2", priority: "normal", due: isoDate(addDays(today, -2)), instructions: "Lithium level and renal function.", status: "completed", createdAt: at(6000) },
  ];

  // ---- Threads & messages ----
  const threads: Thread[] = [
    { id: "TH-general", kind: "team", title: "Clinic team" },
    { id: "TH-team-1", kind: "team", patientId: P(1), title: "Care team" },
    { id: "TH-team-0", kind: "team", patientId: P(0), title: "Care team" },
    { id: "TH-team-2", kind: "team", patientId: P(2), title: "Care team" },
    { id: "TH-pt-0", kind: "patient", patientId: P(0), title: "Patient portal" },
    { id: "TH-pt-5", kind: "patient", patientId: P(5), title: "Patient portal" },
  ];
  const messages: Message[] = [
    { id: "M-1", threadId: "TH-team-1", authorId: "s1", body: "Patient missed the scheduled therapy session. Follow-up may be required.", at: at(160), urgent: false },
    { id: "M-2", threadId: "TH-team-1", authorId: "s2", body: "Please contact the patient to arrange another appointment.", at: at(153), urgent: false },
    { id: "M-3", threadId: "TH-team-1", authorId: "s5", body: "Follow-up contact task received.", at: at(151), urgent: false },
    { id: "M-4", threadId: "TH-team-0", authorId: "s3", body: "Observations updated after today's check-in. Sleep improving.", at: at(70), urgent: false },
    { id: "M-5", threadId: "TH-team-2", authorId: "s2", body: "Lithium level back within range. No change to dose.", at: at(1440), urgent: false },
    { id: "M-6", threadId: "TH-general", authorId: "s6", body: "Reminder: MDT meeting Thursday 12:30 in room 2.", at: at(600), urgent: false },
    { id: "M-7", threadId: "TH-general", authorId: "s5", body: "Room 3 is unavailable this afternoon — sessions moved to room 4.", at: at(120), urgent: false },
    { id: "M-8", threadId: "TH-pt-0", authorId: `patient:${P(0)}`, body: "Hi, could I move my next session to later in the day?", at: at(240), urgent: false },
    { id: "M-9", threadId: "TH-pt-0", authorId: "s5", body: "Hello Alex, we can offer 15:30 on the same day. Shall I book it?", at: at(225), urgent: false },
    { id: "M-10", threadId: "TH-pt-5", authorId: `patient:${P(5)}`, body: "I've been feeling a lot worse since the weekend and I'm struggling to cope.", at: at(42), urgent: true },
  ];

  const alerts: ClinicalAlert[] = [
    { id: "AL-1", patientId: P(5), message: "Patient has reported an urgent concern requiring clinical assessment.", receivedAt: at(42), severity: "urgent", status: "awaiting", clinicianId: patients[5].clinicianId },
    { id: "AL-2", patientId: P(1), message: "High-risk flag: PHQ-9 item 9 positive at last review — care plan review required.", receivedAt: at(95), severity: "urgent", status: "acknowledged", clinicianId: patients[1].clinicianId },
    { id: "AL-3", patientId: P(8), message: "Missed two consecutive medication reviews.", receivedAt: at(1300), severity: "warning", status: "awaiting", clinicianId: patients[8].clinicianId },
  ];

  const activity: Activity[] = [
    { id: "AC-1", at: at(10), title: "Clinical note added", detail: `${patients[7].firstName} ${patients[7].lastName[0]}. (${P(7)}) · by Dr. Aisha Perera`, kind: "note" },
    { id: "AC-2", at: at(22), title: "Appointment booked", detail: `${patients[9].firstName} ${patients[9].lastName[0]}. (${P(9)}) · by Front desk`, kind: "appointment" },
    { id: "AC-3", at: at(42), title: "Urgent message received", detail: `${patients[5].firstName} ${patients[5].lastName[0]}. (${P(5)}) · patient portal`, kind: "alert" },
    { id: "AC-4", at: at(45), title: "Care plan updated", detail: `${patients[14].firstName} ${patients[14].lastName[0]}. (${P(14)}) · by Dr. James Wilson`, kind: "plan" },
    { id: "AC-5", at: at(95), title: "Reminder sent to patient", detail: `${patients[3].firstName} ${patients[3].lastName[0]}. (${P(3)}) · WhatsApp`, kind: "message" },
  ];

  return {
    version: DB_VERSION,
    currentUserId: "s1",
    staff,
    patients,
    appointments: deduped,
    waitlist: [
      { id: "W-1", patientId: P(6), role: "Psychologist", note: "Prefers mornings", addedAt: isoDate(addDays(today, -5)) },
      { id: "W-2", patientId: P(10), role: "Psychiatrist", note: "Any time, can come at short notice", addedAt: isoDate(addDays(today, -3)) },
      { id: "W-3", patientId: P(13), role: "Psychiatrist", note: "Afternoons only", addedAt: isoDate(addDays(today, -1)) },
    ],
    notes,
    followUps,
    tasks,
    threads,
    messages,
    alerts,
    activity,
  };
}
