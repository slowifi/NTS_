export function pickRandomUnpicked(entries, pickedIds, random = Math.random) {
  const candidates = entries.filter((entry) => !pickedIds.has(entry.id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)];
}
