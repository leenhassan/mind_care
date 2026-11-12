export type StaffRole =
  | "Psychiatrist"
  | "Psychologist"
  | "Clinical nurse"
  | "Receptionist"
  | "Coordinator";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  /** Working hours, 24h "HH:MM" */
  hours: [string, string];
  initials: string;
}

export type Condition = "Depression" | "Anxiety" | "Bipolar" | "PTSD" | "Psychosis" | "Other";
export type PatientStatus = "active" | "inactive" | "discharged";
export type RiskLevel = "low" | "medium" | "high";

export interface OutcomeMeasure {
  date: string; // ISO date
  phq9: number; // 0-27
  gad7: number; // 0-21
}

export interface ClinicalRecord {
  presentingConcerns: string;
  history: string;
  medications: string;
  assessment: string;
  diagnosis: string;
  treatmentPlan: string;
  consentSigned: boolean;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: "Female" | "Male" | "Non-binary" | "";
  phone: string;
  email: string;
  emergencyContact: string;
  registeredAt: string;
  clinicianId: string;
  status: PatientStatus;
  condition: Condition;
  risk: RiskLevel;
  record: ClinicalRecord;
  outcomes: OutcomeMeasure[];
}

export type AppointmentType =
  | "Initial Assessment"
  | "Therapy"
  | "Medication Review"
  | "Follow-up"
  | "Care Plan Review";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked-in"
  | "completed"
  | "cancelled"
  | "no-show";

export type Channel = "whatsapp" | "email" | "sms";
export type DeliveryState = "delivered" | "scheduled" | "not-sent";
export type PatientResponse = "awaiting" | "confirmed" | "reschedule-requested" | "cancelled";

export interface Appointment {
  id: string;
  patientId: string;
  clinicianId: string;
  start: string; // ISO datetime
  durationMin: number;
  type: AppointmentType;
  status: AppointmentStatus;
  channels: Channel[];
  confirmation: DeliveryState;
  reminder: DeliveryState;
  response: PatientResponse;
}

export interface WaitlistEntry {
  id: string;
  patientId: string;
  role: StaffRole;
  note: string;
  addedAt: string;
}

export type NoteTemplate = "SOAP" | "DAP" | "BIRP";

export interface SessionNote {
  id: string;
  patientId: string;
  clinicianId: string;
  date: string;
  sessionType: "Individual" | "Group" | "Family" | "Couples";
  modality: string;
  affect: string;
  template: NoteTemplate;
  sections: Record<string, string>;
  status: "draft" | "signed";
}

export interface FollowUp {
  id: string;
  patientId: string;
  lastConsultation: string; // ISO date
  intervalWeeks: number;
  dueDate: string; // ISO date
  role: StaffRole;
  completed: boolean;
  appointmentId?: string;
}

export type TaskPriority = "low" | "normal" | "urgent";
export type TaskStatus = "pending" | "in-progress" | "completed";

export interface Task {
  id: string;
  title: string;
  patientId?: string;
  assigneeId: string;
  createdById: string;
  priority: TaskPriority;
  due: string; // ISO date
  instructions: string;
  status: TaskStatus;
  createdAt: string;
}

export interface Thread {
  id: string;
  kind: "team" | "patient";
  patientId?: string;
  title: string;
}

export interface Message {
  id: string;
  threadId: string;
  /** staff id, or `patient:<id>` for messages from the patient portal */
  authorId: string;
  body: string;
  at: string;
  urgent: boolean;
}

export interface ClinicalAlert {
  id: string;
  patientId: string;
  message: string;
  receivedAt: string;
  severity: "urgent" | "warning";
  status: "awaiting" | "acknowledged" | "resolved";
  clinicianId: string;
}

export interface Activity {
  id: string;
  at: string;
  title: string;
  detail: string;
  kind: "note" | "appointment" | "message" | "plan" | "task" | "patient" | "alert";
}

export interface DB {
  version: number;
  currentUserId: string;
  staff: Staff[];
  patients: Patient[];
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
  notes: SessionNote[];
  followUps: FollowUp[];
  tasks: Task[];
  threads: Thread[];
  messages: Message[];
  alerts: ClinicalAlert[];
  activity: Activity[];
}
