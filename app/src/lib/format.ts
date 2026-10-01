const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function formatRupees(amount: number): string {
  return rupees.format(amount);
}

export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? String(value) : dateFormat.format(date);
}

export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

/** Parses "50,00,000" or "5000000" into a number; returns NaN for anything else. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[,\s₹]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}
