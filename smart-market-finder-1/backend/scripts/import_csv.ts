import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
// lightweight CSV parser fallback (handles quoted fields, newlines)
function simpleCsvParse(input: string) {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i+1] === '"') { field += '"'; i++; continue; }
        inQuotes = false; continue;
      }
      field += ch; continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { cur.push(field); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      // handle CRLF
      if (ch === '\r' && input[i+1] === '\n') { i++; }
      cur.push(field); field = '';
      // push row only if not empty header trailing
      rows.push(cur); cur = []; continue;
    }
    field += ch;
  }
  // final field
  if (field !== '' || cur.length) cur.push(field);
  if (cur.length) rows.push(cur);
  // convert to objects using header
  const hdr = rows[0] || [];
  const objs = rows.slice(1).map(r => {
    const obj: any = {};
    for (let i = 0; i < hdr.length; i++) obj[hdr[i]] = r[i] || '';
    return obj;
  });
  return objs;
}
import crypto from 'crypto';

// optional Postgres and Meili helpers
let pgHelper: any = null;
try { pgHelper = require('../src/db/postgres'); } catch (e) { /* optional */ }
let meiliHelper: any = null;
try { meiliHelper = require('../src/search/meili'); } catch (e) { /* optional */ }

const OUT_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function idFromLink(link: string) {
  return crypto.createHash('sha1').update(link).digest('hex');
}

function extractPrice(text: string): number | null {
  try {
    const m = text.match(/Cena:\s*([\d\s]+)\s*Kč/i) || text.match(/Cena[:\s]*([\d\s]+)\s*Kc/i) || text.match(/Cena[:\s]*([\d\s]+)/i);
    if (m && m[1]) return Number(m[1].replace(/\s+/g, ''));
  } catch (e) { }
  return null;
}

function extractLocation(text: string): string {
  try {
    const m = text.match(/Lokalita:\s*([^,\n\r<]+)/i) || text.match(/Lokalita[:\s]*([^,\n\r<]+)/i);
    if (m && m[1]) return m[1].trim();
  } catch (e) { }
  return '';
}

export async function importCsv(url: string) {
  console.log('[importCsv] fetching', url);
  const res = await axios.get(url, { responseType: 'text', timeout: 15000 });
  const csv = res.data as string;
  let records: any[] = [];
  try { records = simpleCsvParse(csv); } catch (e) { records = []; }
  console.log('[importCsv] rows=', records.length);
  const out: any[] = [];
  for (const r of records) {
    const title = (r['Title'] || r['title'] || r['Title'] || '').toString();
    const link = (r['Link'] || r['link'] || r['Feed Link'] || r['Link'] || '').toString();
    const description = (r['Plain Description'] || r['Plain description'] || r['Description'] || r['description'] || '').toString();
    const image = (r['Image'] || r['image'] || '').toString();
    const date = (r['Date'] || r['date'] || '').toString();
    const id = idFromLink(String(link || title));
    const price = extractPrice(description);
    const location = extractLocation(description);
    const item = { id, title, url: link, description, image, date, price, location, raw: r };
    out.push(item);
    // try upsert to Postgres if available
    try {
      if (pgHelper && (process.env.PG_CONN || process.env.DATABASE_URL)) {
        await pgHelper.init();
        await pgHelper.upsertItem({ ...item, source: 'csv_import', source_id: id });
      }
    } catch (e) {
      console.error('[importCsv] pg upsert error', String(e));
    }
    // try indexing to meili if available
    try {
      if (meiliHelper && (process.env.MEILI_HOST || process.env.MEILI_KEY)) {
        await meiliHelper.indexItems([{ id: id, title: item.title, description: item.description, url: item.url, city: item.location, pubDate: item.date }]);
      }
    } catch (e) {
      console.error('[importCsv] meili index error', String(e));
    }
  }
  const outFile = path.join(OUT_DIR, 'csv_import_preview.json');
  fs.writeFileSync(outFile, JSON.stringify(out.slice(0, 200), null, 2));
  console.log('[importCsv] preview written to', outFile, 'imported=', out.length);
  return { imported: out.length, preview: out.slice(0, 20) };
}

if (require.main === module) {
  (async () => {
    const url = process.argv[2] || process.env.CSV_URL;
    if (!url) { console.error('Usage: import_csv.ts <csv_url> or set CSV_URL'); process.exit(2); }
    try {
      const res = await importCsv(url);
      console.log('[importCsv cli] done', res.imported, 'sample=', res.preview.slice(0,5));
    } catch (err: any) {
      console.error('[importCsv cli] failed', String(err)); process.exit(1);
    }
  })();
}
