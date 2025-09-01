const { Pool } = require('pg');

const SQL_INIT = `
CREATE TABLE IF NOT EXISTS rss_items (
  id TEXT PRIMARY KEY,
  source TEXT,
  source_id TEXT,
  url TEXT,
  title TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT,
  city TEXT,
  postal TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  category TEXT,
  published_at TIMESTAMP,
  fetched_at TIMESTAMP NOT NULL,
  raw JSONB
);
CREATE INDEX IF NOT EXISTS idx_rss_city ON rss_items(city);
CREATE INDEX IF NOT EXISTS idx_rss_postal ON rss_items(postal);
`;

let pool = null;
function getPool(conn) {
  if (pool) return pool;
  const connectionString = conn || process.env.PG_CONN || process.env.DATABASE_URL || '';
  if (!connectionString) throw new Error('Postgres connection string not provided');
  pool = new Pool({ connectionString });
  return pool;
}

async function init(conn) {
  const p = getPool(conn);
  await p.query(SQL_INIT);
}

async function upsertItem(item) {
  const p = getPool();
  const q = `INSERT INTO rss_items (id, source, source_id, url, title, description, price, currency, city, postal, lat, lon, category, published_at, fetched_at, raw)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title,
  description=EXCLUDED.description,
  price=EXCLUDED.price,
  currency=EXCLUDED.currency,
  city=EXCLUDED.city,
  postal=EXCLUDED.postal,
  lat=EXCLUDED.lat,
  lon=EXCLUDED.lon,
  category=EXCLUDED.category,
  published_at=EXCLUDED.published_at,
  fetched_at=EXCLUDED.fetched_at,
  raw=EXCLUDED.raw;`;
  const vals = [item.id, item.source||null, item.source_id||null, item.link, item.title, item.description, item.price||null, item.currency||null, item.city||null, item.postal||null, item.lat||null, item.lon||null, item.category||null, item.pubDate ? new Date(item.pubDate) : null, item.crawledAt ? new Date(item.crawledAt) : new Date(), item.raw || {}];
  await p.query(q, vals);
}

async function existsById(id) {
  const p = getPool();
  const r = await p.query('SELECT 1 FROM rss_items WHERE id = $1 LIMIT 1', [id]);
  return r.rowCount > 0;
}

module.exports = { init, upsertItem, existsById };
