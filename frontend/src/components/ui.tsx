"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(20,22,41,0.04)]", className)}>{children}</section>;
}

export function CardHeader({
  icon: Icon,
  title,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        {Icon && <Icon className="size-[18px] text-brand-600" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

const tones = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-rose-50 text-rose-700",
  purple: "bg-brand-50 text-brand-700",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};
export function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-slate-50",
        variant === "ghost" && "text-brand-600 hover:bg-brand-50",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
    />
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, "h-10", props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, "h-10 pr-8", props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "min-h-24 leading-relaxed", props.className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/40 p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("w-full rounded-2xl bg-white shadow-2xl", wide ? "max-w-2xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({
  icon: Icon,
  value,
  label,
  sub,
  tone = "purple",
  subTone,
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  sub?: React.ReactNode;
  tone?: "purple" | "blue" | "green" | "red" | "amber";
  subTone?: "up" | "warn" | "muted";
}) {
  const bg = {
    purple: "from-brand-50 to-white border-brand-100",
    blue: "from-sky-50 to-white border-sky-100",
    green: "from-emerald-50 to-white border-emerald-100",
    red: "from-rose-50 to-white border-rose-100",
    amber: "from-amber-50 to-white border-amber-100",
  }[tone];
  const iconBg = {
    purple: "bg-brand-100 text-brand-600",
    blue: "bg-sky-100 text-sky-600",
    green: "bg-emerald-100 text-emerald-600",
    red: "bg-rose-100 text-rose-600",
    amber: "bg-amber-100 text-amber-600",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-2xl border bg-gradient-to-br p-4", bg)}>
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl", iconBg)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight tabular-nums">{value}</div>
        <div className="text-sm text-ink/80">{label}</div>
        {sub && (
          <div className={cn("mt-0.5 text-xs", subTone === "up" ? "text-emerald-600" : subTone === "warn" ? "text-rose-600" : "text-muted")}>{sub}</div>
        )}
      </div>
    </div>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700", className)}>{initials}</span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-muted">{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {items.map((i) => (
        <button
          key={i.value}
          onClick={() => onChange(i.value)}
          className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", value === i.value ? "bg-white text-brand-700 shadow-sm" : "text-muted hover:text-ink")}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, className, tone = "green" }: { value: number; className?: string; tone?: "green" | "amber" | "red" | "brand" }) {
  const c = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500", brand: "bg-brand-500" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full transition-all", c)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ---------- Toasts ----------
type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "toast-in pointer-events-auto max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg",
              t.tone === "ok" ? "bg-navy-800" : "bg-rose-600",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
