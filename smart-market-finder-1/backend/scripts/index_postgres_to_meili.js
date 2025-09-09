const { Pool } = require('pg');
const crypto = require('crypto');
const meili = require('../dist/search/meili');

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) { console.error('DATABASE_URL not provided'); process.exit(2); }
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query('SELECT id, title, description, price, city, postal, url, raw FROM rss_items ORDER BY fetched_at DESC LIMIT 500');
    if (!res || !res.rows) { console.log('no rows'); return; }
    const docs = res.rows.map(r => {
      // Meili requires safe document ids: only [A-Za-z0-9_-]. Create a stable SHA1 hex id.
      const safeId = crypto.createHash('sha1').update(String(r.id)).digest('hex');
      return { id: safeId, original_id: r.id, title: r.title, description: r.description, price: r.price, city: r.city, postal: r.postal, url: r.url, raw: r.raw };
    });
    console.log('Indexing', docs.length, 'docs to Meili');
    try {
      const idxRes = await meili.indexItems(docs);
      console.log('Meili response', idxRes);
    } catch (e) { console.error('Meili index error', String(e)); }
    await pool.end();
  } catch (e) { console.error('error', e && e.message ? e.message : e); try { await pool.end(); } catch {} }
}

main();
