export default function formatPrice(p: string | number | null | undefined): string {
  const noPrice = 'Cena neuvedena';
  if (p == null) return noPrice;
  if (typeof p === 'number') {
    if (p <= 0) return noPrice;
    return new Intl.NumberFormat('cs-CZ').format(p) + ' Kč';
  }
  const s = String(p || '').trim();
  if (!s) return noPrice;
  // if already contains currency, show as-is
  if (/kč|kc|czk/i.test(s)) return s;
  // extract digits from any formatted string and format
  const digits = Number(s.replace(/[^0-9]/g, '')) || 0;
  if (digits > 0) return new Intl.NumberFormat('cs-CZ').format(digits) + ' Kč';
  return s || noPrice;
}
