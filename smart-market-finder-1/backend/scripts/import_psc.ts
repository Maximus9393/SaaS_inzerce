import fs from 'fs';
import path from 'path';
import readline from 'readline';

async function main() {
  const csvPath = path.resolve(__dirname, '..', 'src', 'utils', 'psc.csv');
  const outPath = path.resolve(__dirname, '..', 'src', 'utils', 'psc.json');
  if (!fs.existsSync(csvPath)) {
    console.error('psc.csv not found at', csvPath);
    process.exit(2);
  }
  const rl = readline.createInterface({ input: fs.createReadStream(csvPath), crlfDelay: Infinity });
  const items: { code: string; city: string }[] = [];
  for await (const line of rl) {
    const row = line.trim();
    if (!row) continue;
    // allow CSV with header; skip non-digit start
    const parts = row.split(',').map(s => s.trim());
    if (parts.length < 2) continue;
    const code = parts[0].replace(/"/g, '').replace(/\s+/g, '');
    const city = parts.slice(1).join(',').replace(/"/g, '').trim();
    if (!/^\d{3,5}$/.test(code)) continue;
    items.push({ code, city });
  }
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf8');
  console.log('Wrote', items.length, 'PSC entries to', outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
