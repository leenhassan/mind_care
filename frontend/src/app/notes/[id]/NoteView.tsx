"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtDate, fmtTime } from "@/lib/utils";
import { NoteEditor } from "@/components/NoteEditor";
import { Card, PageHeader } from "@/components/ui";

export function NoteView({ id }: { id: string }) {
  const { db, patientName, staffById } = useStore();
  const note = db.notes.find((n) => n.id === id);
  if (!note) {
    return (
      <Card className="p-10 text-center text-muted">
        Note not found.{" "}
        <Link href="/notes" className="font-medium text-brand-600">
          Back to notes
        </Link>
      </Card>
    );
  }
  return (
    <>
      <Link href="/notes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Clinical notes
      </Link>
      <PageHeader
        title={`${note.template} note · ${patientName(note.patientId)}`}
        subtitle={
          <>
            {fmtDate(new Date(note.date), { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at {fmtTime(note.date)} · {staffById(note.clinicianId)?.name} ·{" "}
            <Link href={`/patients/${note.patientId}`} className="text-brand-600 hover:underline">
              Open patient record
            </Link>
          </>
        }
      />
      <NoteEditor key={note.id + note.status} existing={note} />
    </>
  );
}
