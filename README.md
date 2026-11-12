# MindCare — Mental Health EHR & Practice Management

A Next.js 16 + TypeScript + Tailwind CSS app for a mental-health clinic. The app lives in [`frontend/`](frontend).

## Features

- **Dashboard**: today's appointments, patient population, outcome trends, clinician workload, alerts, quick actions and an activity feed.
- **Patients**: searchable register and a full profile. The profile shows the clinical record (concerns, history, assessment, treatment plan, consent), record completeness, PHQ-9/GAD-7 outcomes, session notes, attendance and follow-up.
- **Appointments**: a weekly calendar across practitioners, with **double-booking prevention** for clinicians and patients and working-hours checks. It also covers confirmations and reminders (WhatsApp/email/SMS workflow and preview), patient confirm/reschedule/cancel, attendance tracking, and a **waiting list**: cancelled slots can be offered to patients on it.
- **Clinical notes**: SOAP / DAP / BIRP templates. You can pre-fill a note from the patient record, dictate by voice (Web Speech API), or load the last note. Drafts can be signed and locked.
- **Follow-ups**: due dates come from the attended session plus the recommended interval. Each follow-up shows as Upcoming, Booking required, Overdue, Booked or Completed.
- **Tasks**: assign tasks to team members with a priority and due date, then move them through Pending → In progress → Completed.
- **Care team & messages**: a secure team thread for each patient, a patient-portal channel, and **urgent escalation**, which raises a clinical alert for the assigned clinician.
- **Clinical alerts**: acknowledge, assign a task or resolve.
- **Reports & analytics**: attendance, no-shows, outcomes and documentation stats, insights, and CSV export.

> **Demo data:** there is no backend yet. The app starts with generated demo data (dated relative to today) and saves changes in the browser's `localStorage`. The sidebar has "Reset demo data". All data access goes through `frontend/src/lib/store.tsx`. That is the place to swap in a real API/database (for example Postgres + an auth provider) before storing real patient information.

## Run locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

## Deploy to Vercel

**Option A — Git import (recommended):** push this repo to GitHub, then in Vercel go to *Add New → Project* and import `Mind_Care`. Set **Root Directory = `frontend`**. The framework (Next.js) is detected automatically. Every push to `main` then redeploys.

**Option B — CLI:**

```bash
npm i -g vercel
vercel login
cd frontend
vercel          # preview deployment
vercel --prod   # production
```
