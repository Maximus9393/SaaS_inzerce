const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

async function parsePriceNumeric(p) {
  if (!p) return null;
  try {
    const s = String(p).replace(/[,\s\u00A0]+/g, '').replace(/Kč|Kc|CZK|dohodou|Dohodou/ig, '');
    const digits = s.replace(/[^0-9\.]/g, '');
    if (!digits) return null;
    const v = Number(digits);
    if (isNaN(v) || !isFinite(v)) return null;
    // sanitize absurd small values
    if (v < 10) return null;
    return v;
  } catch (e) { return null; }
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(2); }
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const filePath = '/workspaces/SaaS_inzerce/tmp_bazos_bulk.json';
  if (!fs.existsSync(filePath)) { console.error('tmp_bazos_bulk.json not found — run scraper first'); process.exit(2); }
  const raw = fs.readFileSync(filePath, 'utf8');
  const items = JSON.parse(raw);
  console.log('Loaded', items.length, 'items from', filePath);

  let upserted = 0;
  for (const it of items) {
    try {
      const url = it.url || it.link || '';
      if (!url) continue;
      const id = crypto.createHash('sha1').update(String(url)).digest('hex');
      // prefer numeric price scraped as digits-only string, else parse fallback
      let priceNumeric = null;
      if (it && it.price && String(it.price).match(/^\d+$/)) {
        priceNumeric = Number(String(it.price));
      } else {
        priceNumeric = await parsePriceNumeric(it.price || it.cena || it.priceText || it.raw && it.raw.price || '');
      }
      // determine currency: prefer explicit field, otherwise default to CZK when we have a numeric price
      const currency = (it && it.currency) ? String(it.currency) : (priceNumeric ? 'CZK' : null);
      const q = `INSERT INTO rss_items (id, source, source_id, url, title, description, price, currency, city, postal, lat, lon, category, published_at, fetched_at, raw)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, price=EXCLUDED.price, city=EXCLUDED.city, postal=EXCLUDED.postal, lat=EXCLUDED.lat, lon=EXCLUDED.lon, category=EXCLUDED.category, published_at=EXCLUDED.published_at, fetched_at=EXCLUDED.fetched_at, raw=EXCLUDED.raw;`;
      const vals = [
        id,
        'bazos',
        null,
        url,
        it.title || null,
        it.description || null,
        priceNumeric,
        currency,
        it.location || null,
        it.postal || null,
        it.lat || null,
        it.lon || null,
        null,
        it.date ? new Date(it.date) : null,
        new Date(),
        JSON.stringify(it)
      ];
      await pool.query(q, vals);
      upserted++;
    } catch (e) {
      console.error('upsert error', it && it.url ? it.url : '', e && e.message ? e.message : e);
    }
  }
  console.log('Upserted', upserted, 'items into Postgres');
  await pool.end();
}

main().catch(e => { console.error(e && e.message ? e.message : e); process.exit(2); });
