export function maskEntry(name, phone4) {
  const trimmed = (name ?? '').trim();
  const surname = trimmed.slice(0, 1);
  const masked = 'x'.repeat(Math.max(trimmed.length - 1, 0));
  return `${surname}${masked} (${phone4})`;
}