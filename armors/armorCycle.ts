export function cycleArmorId(ids: readonly string[], currentId: string, direction: 1 | -1): string {
  if (ids.length === 0) return currentId;
  const index = ids.indexOf(currentId);
  if (index < 0) return direction === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(index + direction + ids.length) % ids.length];
}

export function normalizeArmorId(ids: readonly string[], id: string, fallback: string): string {
  if (ids.includes(id)) return id;
  if (ids.includes(fallback)) return fallback;
  return ids[0] ?? fallback;
}
