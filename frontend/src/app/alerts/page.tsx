"use client";

import Link from "next/link";
import { useState } from "react";
import { BellRing, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn, fmtTime, relativeTime } from "@/lib/utils";
import { CreateTaskModal } from "@/components/forms";
import { Badge, Button, Card, Empty, PageHeader, Tabs, useToast } from "@/components/ui";

export default function AlertsPage() {
  const { db, now, patientName, staffById, updateAlert } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [taskFor, setTaskFor] = useState<string | null>(null);
  const alerts = db.alerts
    .filter((a) => (tab === "open" ? a.status !== "resolved" : a.status === "resolved"))
    .sort((a, b) => (a.status === "awaiting" ? -1 : 1) - (b.status === "awaiting" ? -1 : 1) || b.receivedAt.localeCompare(a.receivedAt));

  return (
    <>
      <PageHeader title="Clinical alert dashboard" subtitle="Urgent messages and risk flags are escalated to the designated clinician until acknowledged" />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "open", label: `Open (${db.alerts.filter((a) => a.status !== "resolved").length})` },
            { value: "resolved", label: "Resolved" },
          ]}
        />
      </div>
      {alerts.length === 0 ? (
        <Card>
          <Empty>No alerts in this view.</Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {alerts.map((a) => {
            const clinician = staffById(a.clinicianId);
            return (
              <Card key={a.id} className={cn("p-5", a.status === "awaiting" && a.severity === "urgent" && "border-rose-200 ring-1 ring-rose-100")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/patients/${a.patientId}`} className="text-lg font-semibold hover:text-brand-700">
                      Patient {a.patientId}
                    </Link>
                    <div className="text-sm text-muted">
                      {patientName(a.patientId)} · Message received {fmtTime(a.receivedAt)} ({relativeTime(a.receivedAt, now)})
                    </div>
                  </div>
                  <Badge tone={a.severity === "urgent" ? "red" : "amber"}>{a.severity === "urgent" ? "Urgent" : "Warning"}</Badge>
                </div>
                <p className="mt-3 rounded-xl bg-canvas px-4 py-3 text-sm leading-relaxed">{a.message}</p>
                <ul className="mt-3 space-y-1.5 text-sm font-medium">
                  <li className="flex items-center gap-2">
                    <BellRing className="size-4 text-rose-600" /> Assigned clinician notified — {clinician?.name}
                  </li>
                  <li className="flex items-center gap-2">
                    {a.status === "awaiting" ? (
                      <>
                        <Clock className="size-4 text-amber-600" /> Awaiting acknowledgement
                      </>
                    ) : a.status === "acknowledged" ? (
                      <>
                        <ShieldAlert className="size-4 text-sky-600" /> Acknowledged · assessment in progress
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-600" /> Resolved
                      </>
                    )}
                  </li>
                </ul>
                {a.status !== "resolved" && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    {a.status === "awaiting" && (
                      <Button size="sm" onClick={() => (updateAlert(a.id, "acknowledged"), toast("Alert acknowledged"))}>
                        Acknowledge
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setTaskFor(a.patientId)}>
                      Assign task
                    </Button>
                    <Link href={`/messages?patient=${a.patientId}`} className="inline-flex h-8 items-center rounded-xl border border-line px-3 text-xs font-medium hover:bg-slate-50">
                      Message care team
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => (updateAlert(a.id, "resolved"), toast("Alert resolved"))}>
                      Mark resolved
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <CreateTaskModal open={!!taskFor} onClose={() => setTaskFor(null)} patientId={taskFor ?? undefined} />
    </>
  );
}
