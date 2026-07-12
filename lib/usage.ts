import { FREE_MONTHLY_DELETION_LIMIT } from "./billing";

interface UsageRecord {
  month: string;
  count: number;
}

const store = new Map<string, UsageRecord>();

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getUsage(key: string): number {
  const rec = store.get(key);
  if (!rec || rec.month !== currentMonth()) {
    return 0;
  }
  return rec.count;
}

export function recordDeletions(key: string, n: number): void {
  const month = currentMonth();
  const rec = store.get(key);
  if (!rec || rec.month !== month) {
    store.set(key, { month, count: n });
  } else {
    rec.count += n;
  }
}

export function remainingDeletions(key: string): number {
  return Math.max(0, FREE_MONTHLY_DELETION_LIMIT - getUsage(key));
}

export function wouldExceedLimit(key: string, requested: number): boolean {
  return getUsage(key) + requested > FREE_MONTHLY_DELETION_LIMIT;
}
