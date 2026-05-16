export const IA_STATUSES = [
  "not_started",
  "research",
  "drafting",
  "revision",
  "submitted",
] as const;

export const CORE_STATUSES = [
  "planning",
  "in_progress",
  "drafting",
  "revision",
  "submitted",
] as const;

export const CAS_TYPES = ["creativity", "activity", "service"] as const;

export function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function percent(completed: number, total: number) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}
