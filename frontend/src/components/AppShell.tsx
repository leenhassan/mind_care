"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  BrainCircuit,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  RotateCcw,
  Search,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { StoreProvider, useStore, useStoreMaybe } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar, ToastProvider } from "./ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <ToastProvider>
        <Gate>{children}</Gate>
      </ToastProvider>
    </StoreProvider>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const store = useStoreMaybe();
  if (!store) return <Splash />;
  return <Shell>{children}</Shell>;
}

export function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex items-center gap-3 text-muted">
        <BrainCircuit className="size-7 animate-pulse text-brand-600" />
        <span className="text-sm font-medium">Loading MindCare…</span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // close the mobile drawer on navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar open={open} onClose={() => setOpen(false)} pathname={pathname} />
      <Topbar onMenu={() => setOpen(true)} />
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function Sidebar({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  const { db, me, resetDemo } = useStore();
  const myOpenTasks = db.tasks.filter((t) => t.assigneeId === me.id && t.status !== "completed").length;
  const openAlerts = db.alerts.filter((a) => a.status === "awaiting").length;

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/patients", label: "Patients", icon: Users },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
    { href: "/notes", label: "Clinical Notes", icon: FileText },
    { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
    { href: "/tasks", label: "Tasks", icon: ClipboardList, badge: myOpenTasks },
    { href: "/messages", label: "Care Team & Messages", icon: MessagesSquare },
    { href: "/alerts", label: "Clinical Alerts", icon: ShieldAlert, badge: openAlerts, urgent: true },
    { href: "/analytics", label: "Reports & Analytics", icon: BarChart3 },
  ];

  return (
    <>
      <div className={cn("fixed inset-0 z-30 bg-navy-900/50 lg:hidden", open ? "block" : "hidden")} onClick={onClose} />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 text-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500">
              <BrainCircuit className="size-6" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-tight">MindCare</span>
              <span className="block text-[11px] text-white/60">Mental Health EHR & Practice</span>
            </span>
          </Link>
          <button className="rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {nav.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-brand-600 text-white shadow-lg shadow-brand-900/30" : "text-white/75 hover:bg-white/5 hover:text-white",
                )}
              >
                <n.icon className="size-[18px]" />
                <span className="flex-1">{n.label}</span>
                {!!n.badge && (
                  <span className={cn("grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold", n.urgent ? "bg-rose-500" : "bg-white/15")}>
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <span className="size-2 rounded-full bg-emerald-400" /> Demo data · saved in this browser
          </div>
          <button
            onClick={() => {
              if (window.confirm("Reset all demo data to its original state?")) resetDemo();
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-white/60 hover:text-white"
          >
            <RotateCcw className="size-3.5" /> Reset demo data
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { db, me } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openAlerts = db.alerts.filter((a) => a.status === "awaiting").length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return db.patients
      .filter((p) => `${p.firstName} ${p.lastName} ${p.id}`.toLowerCase().includes(s))
      .slice(0, 6);
  }, [q, db.patients]);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                router.push(`/patients/${results[0].id}`);
                setQ("");
                inputRef.current?.blur();
              }
            }}
            placeholder="Search patients by name or ID…"
            className="h-10 w-full rounded-xl border border-line bg-canvas pl-9 pr-16 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-white px-1.5 text-[11px] text-muted sm:block">
            Ctrl K
          </kbd>
          {focus && q && (
            <div className="absolute inset-x-0 top-12 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
              {results.length === 0 && <div className="px-4 py-3 text-sm text-muted">No patients match “{q}”.</div>}
              {results.map((p) => (
                <Link
                  key={p.id}
                  href={`/patients/${p.id}`}
                  onClick={() => setQ("")}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-brand-50"
                >
                  <span className="font-medium">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="text-xs text-muted">{p.id}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/alerts" className="relative rounded-xl p-2 hover:bg-slate-100" aria-label={`${openAlerts} open alerts`}>
            <Bell className="size-5" />
            {openAlerts > 0 && (
              <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{openAlerts}</span>
            )}
          </Link>
          <Link href="/messages" className="rounded-xl p-2 hover:bg-slate-100" aria-label="Messages">
            <MessagesSquare className="size-5" />
          </Link>
          <div className="ml-2 hidden items-center gap-2.5 border-l border-line pl-4 sm:flex">
            <Avatar initials={me.initials} />
            <div className="leading-tight">
              <div className="text-sm font-semibold">{me.name}</div>
              <div className="text-xs text-muted">{me.role}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
