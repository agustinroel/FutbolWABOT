export interface QueueEntry {
  playerId: string;
  joinedAt: string;
}

export interface QueueResult {
  confirmed: QueueEntry[];
  waitlist: QueueEntry[];
}

function compareQueueEntries(left: QueueEntry, right: QueueEntry): number {
  const leftTime = Date.parse(left.joinedAt);
  const rightTime = Date.parse(right.joinedAt);
  const byTime = Number.isNaN(leftTime) || Number.isNaN(rightTime)
    ? left.joinedAt.localeCompare(right.joinedAt)
    : leftTime - rightTime;
  return byTime || left.playerId.localeCompare(right.playerId);
}

export function sortQueueEntries(entries: QueueEntry[]): QueueEntry[] {
  return [...entries].sort(compareQueueEntries);
}

export function addToQueue(entries: QueueEntry[], playerId: string, capacity: number): QueueResult {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('El cupo debe ser un entero positivo.');
  if (entries.some((entry) => entry.playerId === playerId)) {
    const existing = sortQueueEntries(entries);
    return { confirmed: existing.slice(0, capacity), waitlist: existing.slice(capacity) };
  }
  const updated = sortQueueEntries([...entries, { playerId, joinedAt: new Date().toISOString() }]);
  return { confirmed: updated.slice(0, capacity), waitlist: updated.slice(capacity) };
}

export function removeFromQueue(entries: QueueEntry[], playerId: string, capacity: number): QueueResult & { promoted?: string } {
  const sorted = sortQueueEntries(entries);
  const wasConfirmed = sorted.findIndex((entry) => entry.playerId === playerId) > -1 &&
    sorted.slice(0, capacity).some((entry) => entry.playerId === playerId);
  const remaining = sorted.filter((entry) => entry.playerId !== playerId);
  const result: QueueResult = { confirmed: remaining.slice(0, capacity), waitlist: remaining.slice(capacity) };
  const promoted = wasConfirmed ? result.confirmed.find((entry) => sorted.slice(capacity).some((waitlisted) => waitlisted.playerId === entry.playerId))?.playerId : undefined;
  return { ...result, ...(promoted ? { promoted } : {}) };
}
