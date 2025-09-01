import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
// optional Postgres helper
let pgHelper: any = null;
try { pgHelper = require('../src/db/postgres'); } catch (e) { /* optional */ }
let meiliHelper: any = null;
try { meiliHelper = require('../src/search/meili'); } catch (e) { /* optional */ }
console.log('[fetchRss] pgHelper=', !!pgHelper, 'meiliHelper=', !!meiliHelper, 'PG_CONN=', !!process.env.PG_CONN, 'MEILI_HOST=', !!process.env.MEILI_HOST);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'rss_items.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify([]));

function idFromLink(link: string) {
  return crypto.createHash('sha1').update(link).digest('hex');
}

export async function fetchRss(url: string) {
  console.log('[fetchRss] fetching', url);
  const res = await axios.get(url, { responseType: 'text', timeout: 15000 });
  const parser = new XMLParser({ ignoreAttributes: false });
  const json = parser.parse(res.data);
  // Try to access rss.channel.item or feed.entry
  const items = (json?.rss?.channel?.item) || (json?.feed?.entry) || [];
  const normalized = Array.isArray(items) ? items : [items];
  const storedRaw = fs.existsSync(STORE_FILE) ? fs.readFileSync(STORE_FILE, 'utf8') : '[]';
  let store: any[] = [];
  try { store = JSON.parse(storedRaw || '[]'); } catch (e) { store = []; }
  const existing = new Set(store.map(i => i.id || i.link));
  const added: any[] = [];
  for (const it of normalized) {
    const link = it.link?.['#text'] || it.link || it.guid || it['@_link'] || (typeof it.link === 'object' && it.link?.href) || '';
    const title = it.title?.['#text'] || it.title || '';
    const description = it.description?.['#text'] || it.description || it.summary || '';
    const pubDate = it.pubDate || it.published || it.updated || it['dc:date'] || '';
    const locality = url.includes('mesto=') ? decodeURIComponent((url.split('mesto=')[1] || '').split('&')[0]) : '';
    const id = idFromLink(String(link || title));
    const record = { id, title: String(title), link: String(link), description: String(description), pubDate: String(pubDate), locality, crawledAt: new Date().toISOString(), raw: it };
    // If Postgres helper is available and PG_CONN present, upsert there
    try {
      if (pgHelper && (process.env.PG_CONN || process.env.DATABASE_URL)) {
        await pgHelper.init();
  await pgHelper.upsertItem({ ...record, source: 'bazos_rss', source_id: record.id });
  // index to meili if configured
  try { if (meiliHelper && (process.env.MEILI_HOST || process.env.MEILI_KEY)) { await meiliHelper.indexItems([ { id: record.id, title: record.title, description: record.description, url: record.link, city: record.locality, pubDate: record.pubDate } ]); } } catch (e) { console.error('[fetchRss] meili index error', String(e)); }
  added.push(record);
        continue;
      }
    } catch (e) {
      console.error('[fetchRss] pg upsert failed', String(e));
      // fallback to JSON store below
    }

    if (existing.has(id) || existing.has(String(link))) continue;
    store.push(record);
    existing.add(id);
    added.push(record);
  }
  // index JSON-stored items to meili if configured
  try { if (meiliHelper && (process.env.MEILI_HOST || process.env.MEILI_KEY) && added.length) { await meiliHelper.indexItems(added.map(a => ({ id: a.id, title: a.title, description: a.description, url: a.link, city: a.locality, pubDate: a.pubDate }))); } } catch (e) { console.error('[fetchRss] meili batch index error', String(e)); }
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2)); } catch (e) { /* ignore write errors */ }
  console.log(`[fetchRss] done: fetched ${normalized.length} items, added ${added.length} new items`);
  return { fetched: normalized.length, added: added.length, addedSample: added.slice(0,5) };
}

// CLI runner with simple fallback to www.bazos.cz when auto.bazos.cz returns 404
if (require.main === module) {
  (async () => {
    // If first arg is 'all', run a set of recommended feeds
    const arg = process.argv[2] || '';
    const feeds = [] as string[];
    if (arg === 'all') {
      // example feeds; tune mesto/city parameters as desired
      feeds.push('https://www.bazos.cz/rss.php?c=1&s=1&q=&mesto=Praha');
      feeds.push('https://www.bazos.cz/rss.php?c=1&s=1&q=&mesto=M%C4%9Bln%C3%ADk');
      // Sbazar and Hyperinzerce often provide category RSS — replace with real feed URLs
      feeds.push(process.env.SBAZAR_FEED || 'https://www.sbazar.cz/rss/?q=auto');
      feeds.push(process.env.HYPER_FEED || 'https://www.hyperinzerce.cz/rss/auto');
    } else {
      const url = process.argv[2] || process.env.FETCH_RSS_URL || 'https://www.bazos.cz/rss.php?c=1&s=1&q=&mesto=Praha';
      feeds.push(url);
    }

    for (let url of feeds) {
      try {
        const res = await fetchRss(url);
        console.log('[fetchRss cli] result for', url, res);
      } catch (err: any) {
        console.error('[fetchRss cli] fetch failed for', url, err && err.message ? err.message : String(err));
        // Try simple fallback for auto.bazos -> www.bazos
        if (url.includes('auto.bazos.cz')) {
          const alt = url.replace('https://auto.bazos.cz', 'https://www.bazos.cz');
          try { const res2 = await fetchRss(alt); console.log('[fetchRss cli] result for', alt, res2); } catch (e) { console.error('[fetchRss cli] retry failed for', alt, String(e)); }
        }
      }
    }
  })();
}
