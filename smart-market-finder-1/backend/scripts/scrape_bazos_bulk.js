const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const scraper = require('../dist/scraper/scraper');

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('Provide DATABASE_URL');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // keywords to broaden coverage
  const keywords = ['Škoda','Volkswagen','Audi','BMW','Toyota','Ford','Opel','Renault','Hyundai','Mercedes','Kia','Nissan','Peugeot','Citroën'];
  const perKeywordLimit = Number(process.env.PER_KEYWORD_LIMIT || '50');

  const seen = new Map();
  for (const kw of keywords) {
    try {
      console.log('scraping keyword', kw);
      const res = await scraper.scrapeBazos({ keywords: kw, limit: perKeywordLimit });
      console.log(' -> found', Array.isArray(res) ? res.length : 0, 'items for', kw);
      if (Array.isArray(res)) {
        for (const it of res) {
          if (!it || !it.url) continue;
          const urlKey = String(it.url).split(/[?#]/)[0].trim();
          if (!urlKey) continue;
          if (!seen.has(urlKey)) seen.set(urlKey, it);
        }
      }
      // small delay between keywords
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.error('keyword scrape error', kw, e && e.message ? e.message : e);
    }
  }

  const items = Array.from(seen.values());
  console.log('total unique bazoš items collected:', items.length);
  const outPath = '/workspaces/SaaS_inzerce/tmp_bazos_bulk.json';
  try { fs.writeFileSync(outPath, JSON.stringify(items, null, 2)); console.log('wrote', items.length, 'items to', outPath); } catch (e) { console.error('write error', e); }

  // ensure table exists (use flexible text price to avoid parse errors)
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
  } catch (e) { console.error('table create error', e && e.message ? e.message : e); }

  let upserted = 0;
  for (const it of items) {
    try {
      const url = it.url || it.link || '';
      const id = crypto.createHash('sha1').update(String(url)).digest('hex');
      const q = `INSERT INTO rss_items (id, source, source_id, url, title, description, price, currency, city, postal, lat, lon, category, published_at, fetched_at, raw)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, price=EXCLUDED.price, city=EXCLUDED.city, postal=EXCLUDED.postal, lat=EXCLUDED.lat, lon=EXCLUDED.lon, category=EXCLUDED.category, published_at=EXCLUDED.published_at, fetched_at=EXCLUDED.fetched_at, raw=EXCLUDED.raw;`;
      const vals = [
        id,
        'bazos',
        null,
        url || null,
        it.title || null,
        it.description || null,
        it.price || null,
        null,
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
      console.error('upsert error for', it && it.url ? it.url : '(no url)', e && e.message ? e.message : e);
    }
  }

  console.log('upserted', upserted, 'items to Postgres');

  // quick coverage check for fields required by frontend
  const sample = items.slice(0, 8).map(it => ({ url: it.url, title: !!it.title, price: !!it.price, description: !!it.description, images: Array.isArray(it.images) && it.images.length > 0, thumbnail: !!it.thumbnail, postal: !!it.postal, location: !!it.location }));
  console.log('sample field coverage (first 8 items):', JSON.stringify(sample, null, 2));

  await pool.end();
}

main().catch(e => { console.error(e && e.message ? e.message : e); process.exit(2); });
