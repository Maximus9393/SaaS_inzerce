/*
  TipCars importer scaffold
  - Supports XML or JSON feed URLs (config via TIPCARS_FEED_URL)
  - Optional basic auth via env TIPCARS_USER / TIPCARS_PASS
  - Maps minimal fields to internal upsert helper and logs dry-run when credentials absent
  Usage:
    TIPCARS_FEED_URL="https://example.com/feed.xml" npm run import:tipcars
*/
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import pgHelper from '../src/db/postgres';
import { ensureIndex } from '../src/search/meili';

const FEED_URL = process.env.TIPCARS_FEED_URL || '';
const TIPCARS_USER = process.env.TIPCARS_USER || '';
const TIPCARS_PASS = process.env.TIPCARS_PASS || '';

async function fetchFeed(url: string) {
  const opts: any = {};
  if (TIPCARS_USER && TIPCARS_PASS) opts.auth = { username: TIPCARS_USER, password: TIPCARS_PASS };
  const resp = await axios.get(url, { ...opts, responseType: 'text', timeout: 30000 });
  return resp.data;
}

function mapItem(raw: any) {
  // Minimal mapping; extend as needed
  return {
    title: raw.title || raw.nadpis || '',
    price: raw.price || raw.cena || null,
    location: raw.location || raw.mesto || raw.city || '',
    url: raw.link || raw.url || '',
    description: raw.description || raw.popis || '',
    source: 'tipcars'
  };
}

async function run() {
  if (!FEED_URL) {
    console.error('TIPCARS_FEED_URL not provided; aborting');
    process.exit(2);
  }
  console.log('TipCars importer starting for', FEED_URL);
  const raw = await fetchFeed(FEED_URL);
  let items: any[] = [];
  try {
    if (raw.trim().startsWith('<')) {
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(raw);
      // Attempt common RSS/Atom patterns
      if (parsed.rss && parsed.rss.channel && parsed.rss.channel.item) items = parsed.rss.channel.item;
      else if (parsed.feed && parsed.feed.entry) items = parsed.feed.entry;
      else items = [];
    } else {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) items = j;
      else if (j.items) items = j.items;
    }
  } catch (e) {
    console.error('Failed to parse feed', String(e));
    process.exit(2);
  }

  console.log('Fetched items count:', items.length);
  const mapped = items.map(mapItem).filter(i => i.url && i.title);

  // If DB helper exists, upsert; otherwise just log
  try {
    await pgHelper.init();
    const meili = await ensureIndex();
    for (const m of mapped) {
      // upsertItem expects certain shape in pg helper; adapt as needed
      await pgHelper.upsertItem({ title: m.title, price: m.price, location: m.location, url: m.url, description: m.description, source: m.source });
    }
  // Optionally index to meili (bulk path omitted for brevity)
    console.log('Upserted', mapped.length, 'items to Postgres (tipcars)');
  } catch (e) {
    console.warn('DB upsert failed or not configured; dry-run outputting sample:', String(e));
    console.log('Sample mapped items:', mapped.slice(0, 5));
  }

  console.log('TipCars importer finished');
}

run().catch(e => { console.error('import_tipcars error', e); process.exit(2); });
