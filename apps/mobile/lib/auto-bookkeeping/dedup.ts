export interface DedupItem {
  readonly amount: number;
  readonly source: string;
  readonly timestamp: number;
}

const DEFAULT_WINDOW_MS = 10_000;

export function isDuplicate(
  incoming: DedupItem,
  existingItems: readonly DedupItem[],
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  return existingItems.some(
    (existing) =>
      existing.source === incoming.source &&
      existing.amount === incoming.amount &&
      Math.abs(existing.timestamp - incoming.timestamp) < windowMs,
  );
}
