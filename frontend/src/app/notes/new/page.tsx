"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NoteEditor } from "@/components/NoteEditor";
import { PageHeader } from "@/components/ui";

export default function NewNotePage() {
  const params = useSearchParams();
  return (
    <>
      <Link href="/notes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" /> Clinical notes
      </Link>
      <PageHeader title="Create session note" />
      <NoteEditor initialPatientId={params.get("patient") ?? undefined} />
    </>
  );
}
