"use client";

import Link from "next/link";
import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDate, fmtTime } from "@/lib/utils";
import { Badge, Card, Empty, PageHeader, Tabs } from "@/components/ui";

export default function NotesPage() {
  const { db, me, patientName, staffById } = useStore();
  const [tab, setTab] = useState<"mine" | "drafts" | "all">("mine");
  const notes = db.notes
    .filter((n) => (tab === "mine" ? n.clinicianId === me.id : tab === "drafts" ? n.status === "draft" : true))
    .sort((a, b) => b.date.localeCompare(a.date));
  const drafts = db.notes.filter((n) => n.status === "draft").length;

  return (
    <>
      <PageHeader
        title="Clinical notes"
        subtitle={`${db.notes.length} notes · ${drafts} awaiting signature`}
        actions={
          <Link href="/notes/new" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
            <FilePlus2 className="size-4" /> New session note
          </Link>
        }
      />
      <Card>
        <div className="border-b border-line p-4">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "mine", label: "My notes" },
              { value: "drafts", label: `Drafts (${drafts})` },
              { value: "all", label: "All notes" },
            ]}
          />
        </div>
        {notes.length === 0 ? (
          <Empty>No notes here.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={`/notes/${n.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-canvas">
                  <div className="w-28 shrink-0 text-sm">
                    <div className="font-medium">{fmtDate(new Date(n.date), { day: "numeric", month: "short" })}</div>
                    <div className="text-xs text-muted">{fmtTime(n.date)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {patientName(n.patientId)} <span className="text-xs font-normal text-muted">({n.patientId})</span>
                    </div>
                    <div className="truncate text-xs text-muted">
                      {n.template} · {n.modality} · {staffById(n.clinicianId)?.name}
                    </div>
                  </div>
                  <Badge tone={n.status === "signed" ? "green" : "amber"}>{n.status === "signed" ? "Signed" : "Draft"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
