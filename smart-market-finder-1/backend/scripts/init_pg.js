const { Client } = require('pg');
const conn = process.env.PG_CONN || 'postgresql://demo:demo@127.0.0.1:5432/smart';
const SQL = `
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
(async function(){
  const c = new Client({ connectionString: conn });
  await c.connect();
  await c.query(SQL);
  await c.end();
  console.log('pg init done');
})().catch(e=>{ console.error('pg init error', e); process.exit(1); });
