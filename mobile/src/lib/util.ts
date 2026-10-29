export const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const day = (s?: string | null) => (s ? s.slice(0, 10) : "—");
export const initials = (name: string) => (name || "?").trim().slice(0, 2);
export const daysUntil = (iso: string) => {
  const d = new Date(iso); const n = new Date();
  d.setHours(0, 0, 0, 0); n.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
};
