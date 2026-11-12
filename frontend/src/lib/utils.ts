import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

/** Local date as YYYY-MM-DD */
export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function startOfWeek(d: Date) {
  const r = startOfDay(d);
  const day = (r.getDay() + 6) % 7; // Monday = 0
  return addDays(r, -day);
}

export function sameDay(a: Date, b: Date) {
  return isoDate(a) === isoDate(b);
}

/** Parse a YYYY-MM-DD as a local date */
export function parseDate(s: string) {
  if (s.length === 10) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

export function fmtDate(s: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const d = typeof s === "string" ? parseDate(s) : s;
  return d.toLocaleDateString("en-GB", opts);
}

export function fmtTime(s: string | Date) {
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function relativeTime(iso: string, now = new Date()) {
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.round(diff / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return `${days} d ago`;
}

export function ageFrom(dob: string) {
  if (!dob) return null;
  const d = parseDate(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
