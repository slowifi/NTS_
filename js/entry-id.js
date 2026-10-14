export function normalizeName(name) {
  return (name ?? '').replace(/\s+/g, '');
}

export function entryIdFor(name, phone4) {
  return `${normalizeName(name)}_${phone4}`;
}
