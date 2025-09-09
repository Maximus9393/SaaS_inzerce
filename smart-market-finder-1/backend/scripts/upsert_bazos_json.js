const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not provided');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS rss_items (
      id TEXT PRIMARY KEY,
      source TEXT,
      source_id TEXT,
      url TEXT,
      title TEXT,
      description TEXT,
      price TEXT,
      currency TEXT,
      city TEXT,
      postal TEXT,
      lat DOUBLE PRECISION,
      lon DOUBLE PRECISION,
      category TEXT,
      published_at TIMESTAMP,
      fetched_at TIMESTAMP NOT NULL,
      raw JSONB
    );`);

    const filePath = '/workspaces/SaaS_inzerce/tmp_bazos_direct.json';
    const raw = fs.readFileSync(filePath, 'utf8');
    const items = JSON.parse(raw);
    console.log('Loaded items from', filePath, 'count=', items.length);
    let upserted = 0;
    for (const it of items) {
      const id = 'bazos:' + (it.url ? Buffer.from(it.url).toString('base64').slice(0,24) : Math.random().toString(36).slice(2,10));
      // normalize price to numeric (strip non-digits), leave null when not parseable
      let priceNumeric = null;
      try {
        if (it.price) {
          const digits = String(it.price).replace(/[^0-9]/g, '');
          if (digits && digits.length > 0) priceNumeric = Number(digits);
        }
      } catch (e) { priceNumeric = null; }
      const q = `INSERT INTO rss_items (id, source, source_id, url, title, description, price, currency, city, postal, lat, lon, category, published_at, fetched_at, raw)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, price=EXCLUDED.price, city=EXCLUDED.city, postal=EXCLUDED.postal, published_at=EXCLUDED.published_at, fetched_at=EXCLUDED.fetched_at, raw=EXCLUDED.raw;`;
      const vals = [
        id,
        'bazos',
        null,
        it.url || null,
        it.title || null,
        it.description || null,
        priceNumeric,
        null,
        it.location || null,
        it.postal || null,
        null,
        null,
        null,
        it.date ? new Date(it.date) : null,
        new Date(),
        JSON.stringify(it)
      ];
      try {
        await pool.query(q, vals);
        upserted++;
      } catch (e) {
        console.error('row upsert error', e && e.message ? e.message : e);
      }
    }
    console.log('Upserted', upserted, 'items');
    await pool.end();
  } catch (e) {
    console.error('error', e && e.message ? e.message : e);
    try { await pool.end(); } catch {};
    process.exit(2);
  }
}

main();
