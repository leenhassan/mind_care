"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { recordCompleteness, useStore } from "@/lib/store";
import { ageFrom, fmtDate } from "@/lib/utils";
import { AddPatientModal, CLINICAL_ROLES } from "@/components/forms";
import { Badge, Button, Card, Empty, Input, PageHeader, Progress, Select } from "@/components/ui";

export default function PatientsPage() {
  const { db, now, staffById } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [clinician, setClinician] = useState("");
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.patients
      .filter((p) => (status ? p.status === status : true))
      .filter((p) => (clinician ? p.clinicianId === clinician : true))
      .filter((p) => !s || `${p.firstName} ${p.lastName} ${p.id} ${p.condition}`.toLowerCase().includes(s))
      .map((p) => {
        const next = db.appointments
          .filter((a) => a.patientId === p.id && new Date(a.start) > now && a.status !== "cancelled")
          .sort((a, b) => a.start.localeCompare(b.start))[0];
        return { p, next, completeness: recordCompleteness(p).pct };
      });
  }, [db, q, status, clinician, now]);

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={`${db.patients.filter((p) => p.status === "active").length} active · ${db.patients.length} total`}
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Add patient
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, ID or condition" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discharged">Discharged</option>
          </Select>
          <Select value={clinician} onChange={(e) => setClinician(e.target.value)} className="w-56">
            <option value="">All clinicians</option>
            {db.staff
              .filter((s) => CLINICAL_ROLES.includes(s.role))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-3 py-3 font-medium">Age</th>
                <th className="px-3 py-3 font-medium">Primary concern</th>
                <th className="px-3 py-3 font-medium">Clinician</th>
                <th className="px-3 py-3 font-medium">Next appointment</th>
                <th className="px-3 py-3 font-medium">Risk</th>
                <th className="px-5 py-3 font-medium">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ p, next, completeness }) => (
                <tr key={p.id} className="hover:bg-canvas">
                  <td className="px-5 py-3">
                    <Link href={`/patients/${p.id}`} className="font-medium hover:text-brand-700">
                      {p.firstName} {p.lastName}
                    </Link>
                    <div className="text-xs text-muted">{p.id}</div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{ageFrom(p.dob) ?? "—"}</td>
                  <td className="px-3 py-3">{p.condition}</td>
                  <td className="px-3 py-3">{staffById(p.clinicianId)?.name}</td>
                  <td className="px-3 py-3">
                    {next ? (
                      <>
                        {fmtDate(new Date(next.start), { day: "numeric", month: "short" })} ·{" "}
                        {new Date(next.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </>
                    ) : (
                      <span className="text-muted">None booked</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={p.risk === "high" ? "red" : p.risk === "medium" ? "amber" : "green"}>{p.risk}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={completeness} className="w-20" tone={completeness === 100 ? "green" : "amber"} />
                      <span className="text-xs tabular-nums text-muted">{completeness}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No patients match these filters.</Empty>}
        </div>
      </Card>
      <AddPatientModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
