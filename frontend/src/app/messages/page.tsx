"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Globe, Plus, Send, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn, fmtTime, relativeTime } from "@/lib/utils";
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Select, Tabs } from "@/components/ui";

const roleColor: Record<string, string> = {
  Psychologist: "bg-emerald-100 text-emerald-700",
  Psychiatrist: "bg-sky-100 text-sky-700",
  "Clinical nurse": "bg-pink-100 text-pink-700",
  Receptionist: "bg-amber-100 text-amber-800",
  Coordinator: "bg-brand-100 text-brand-700",
};

export default function MessagesPage() {
  const { db, now, me, patientName, staffById, sendMessage, ensureThread } = useStore();
  const params = useSearchParams();
  const wantedPatient = params.get("patient");
  const [kind, setKind] = useState<"team" | "patient">("team");
  const [selected, setSelected] = useState<string>(() => {
    if (wantedPatient) return db.threads.find((t) => t.kind === "team" && t.patientId === wantedPatient)?.id ?? "";
    return db.threads[0]?.id ?? "";
  });
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [newThread, setNewThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const threads = db.threads
    .filter((t) => t.kind === kind)
    .map((t) => ({ t, last: db.messages.filter((m) => m.threadId === t.id).at(-1) }))
    .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? ""));
  const thread = db.threads.find((t) => t.id === selected);
  const msgs = db.messages.filter((m) => m.threadId === selected);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, selected]);

  const title = (t: (typeof db.threads)[number]) => (t.patientId ? `${patientName(t.patientId)} — ${t.patientId}` : t.title);

  const send = () => {
    if (!body.trim() || !thread) return;
    sendMessage(thread.id, body.trim(), urgent);
    setBody("");
    setUrgent(false);
  };

  return (
    <>
      <PageHeader
        title="Care team & communication"
        subtitle="Secure internal messaging, a designated patient channel, and urgent escalation to the assigned clinician"
        actions={
          <Button onClick={() => setNewThread(true)}>
            <Plus className="size-4" /> New conversation
          </Button>
        }
      />
      <Card className="grid min-h-[620px] grid-cols-1 overflow-hidden md:grid-cols-[320px_1fr]">
        <div className="border-b border-line md:border-b-0 md:border-r">
          <div className="border-b border-line p-3">
            <Tabs
              value={kind}
              onChange={(k) => {
                setKind(k);
                setSelected(db.threads.find((t) => t.kind === k)?.id ?? "");
              }}
              items={[
                { value: "team", label: "Care teams" },
                { value: "patient", label: "Patient portal" },
              ]}
            />
          </div>
          <ul className="scroll-thin max-h-[560px] overflow-y-auto">
            {threads.length === 0 && <Empty>No conversations.</Empty>}
            {threads.map(({ t, last }) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelected(t.id)}
                  className={cn("flex w-full gap-3 border-l-2 px-4 py-3 text-left", selected === t.id ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-canvas")}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100">
                    {t.kind === "patient" ? <Globe className="size-4 text-muted" /> : <Users className="size-4 text-muted" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{title(t)}</span>
                      {last && <span className="shrink-0 text-[11px] text-muted">{relativeTime(last.at, now)}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                      {last?.urgent && <AlertTriangle className="size-3 shrink-0 text-rose-600" />}
                      {last ? last.body : "No messages yet"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-h-0 flex-col">
          {!thread ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted">
              {wantedPatient ? (
                <div>
                  No care-team conversation for {patientName(wantedPatient)} yet.
                  <div className="mt-3">
                    <Button onClick={() => setSelected(ensureThread("team", wantedPatient))}>Start care-team thread</Button>
                  </div>
                </div>
              ) : (
                "Select a conversation"
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
                <div>
                  <div className="font-semibold">{thread.kind === "team" && thread.patientId ? `Patient care team — ${thread.patientId}` : title(thread)}</div>
                  <div className="text-xs text-muted">
                    {thread.kind === "patient" ? "Messages from the patient portal · replies are sent to the patient" : "Visible to authorised staff only"}
                  </div>
                </div>
                {thread.patientId && (
                  <Link href={`/patients/${thread.patientId}`} className="text-xs font-medium text-brand-600 hover:underline">
                    Open patient record
                  </Link>
                )}
              </div>
              <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 py-4" style={{ maxHeight: 460 }}>
                {msgs.length === 0 && <Empty>No messages yet — start the conversation.</Empty>}
                {msgs.map((m) => {
                  const fromPatient = m.authorId.startsWith("patient:");
                  const author = staffById(m.authorId);
                  const mine = m.authorId === me.id;
                  return (
                    <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                      <Avatar
                        initials={fromPatient ? "PT" : (author?.initials ?? "?")}
                        className={cn(fromPatient ? "bg-slate-200 text-slate-700" : roleColor[author?.role ?? ""])}
                      />
                      <div className={cn("max-w-[75%]", mine && "text-right")}>
                        <div className="text-xs font-semibold">
                          {fromPatient ? `${patientName(m.authorId.slice(8))} (patient)` : `${author?.name} · ${author?.role}`}
                        </div>
                        <div
                          className={cn(
                            "mt-1 inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed",
                            m.urgent ? "border border-rose-200 bg-rose-50 text-rose-900" : mine ? "bg-brand-600 text-white" : "bg-canvas",
                          )}
                        >
                          {m.urgent && (
                            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-rose-700">
                              <AlertTriangle className="size-3.5" /> Urgent — escalated to clinician
                            </span>
                          )}
                          {m.body}
                        </div>
                        <div className="mt-1 text-[11px] text-muted">{fmtTime(m.at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-line p-4">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={thread.kind === "patient" ? "Reply to the patient…" : "Message the care team…"}
                  className="h-20 w-full resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {thread.patientId && (
                      <label className={cn("flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium", urgent ? "bg-rose-50 text-rose-700" : "text-muted")}>
                        <input type="checkbox" className="accent-rose-600" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
                        Flag as urgent (notifies assigned clinician)
                      </label>
                    )}
                    {thread.kind === "patient" && thread.patientId && (
                      <button
                        className="text-xs text-muted underline-offset-2 hover:underline"
                        onClick={() =>
                          sendMessage(thread.id, "I'm feeling much worse today and need to speak to someone.", true, `patient:${thread.patientId}`)
                        }
                      >
                        Simulate urgent patient message
                      </button>
                    )}
                  </div>
                  <Button onClick={send} disabled={!body.trim()}>
                    <Send className="size-4" /> Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
      <NewThreadModal
        open={newThread}
        onClose={() => setNewThread(false)}
        onCreate={(k, pid) => {
          setKind(k);
          setSelected(ensureThread(k, pid));
          setNewThread(false);
        }}
      />
      {db.alerts.some((a) => a.status === "awaiting") && (
        <p className="mt-3 text-xs text-muted">
          <Badge tone="red">{db.alerts.filter((a) => a.status === "awaiting").length}</Badge> urgent item(s) awaiting acknowledgement —{" "}
          <Link href="/alerts" className="text-brand-600 hover:underline">
            open clinical alerts
          </Link>
        </p>
      )}
    </>
  );
}

function NewThreadModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (k: "team" | "patient", pid: string) => void }) {
  const { db } = useStore();
  const [pid, setPid] = useState("");
  const [k, setK] = useState<"team" | "patient">("team");
  return (
    <Modal open={open} onClose={onClose} title="New conversation">
      <div className="space-y-4">
        <Field label="Type">
          <Select value={k} onChange={(e) => setK(e.target.value as "team" | "patient")}>
            <option value="team">Care team discussion about a patient</option>
            <option value="patient">Message a patient (portal)</option>
          </Select>
        </Field>
        <Field label="Patient">
          <Select value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Select patient…</option>
            {db.patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.firstName} {p.lastName}
              </option>
            ))}
          </Select>
        </Field>
        <Button className="w-full" disabled={!pid} onClick={() => onCreate(k, pid)}>
          Open conversation
        </Button>
      </div>
    </Modal>
  );
}
