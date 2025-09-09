const path = require('path');
const fs = require('fs');

function formatPrice(p) {
  const noPrice = 'Cena neuvedena';
  if (p == null) return noPrice;
  if (typeof p === 'number') {
    if (p <= 0) return noPrice;
    return new Intl.NumberFormat('cs-CZ').format(p) + ' Kč';
  }
  const s = String(p || '').trim();
  if (!s) return noPrice;
  if (/kč|kc|czk/i.test(s)) return s;
  const digits = Number(s.replace(/[^0-9]/g, '')) || 0;
  if (digits > 0) return new Intl.NumberFormat('cs-CZ').format(digits) + ' Kč';
  return s || noPrice;
}

const sample = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../tmp_search_result.json'), 'utf8'));
console.log('Loaded', sample.results.length, 'items');
for (let i = 0; i < Math.min(4, sample.results.length); i++) {
  const it = sample.results[i];
  console.log(i+1, it.title);
  console.log(' raw price:', it.price);
  console.log(' formatted:', formatPrice(it.price));
  console.log('---');
}
