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
import crypto from 'crypto';
import pgHelper from '../src/db/postgres';
import { ensureIndex, indexItems } from '../src/search/meili';

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
  const url = raw.link || raw.url || '';
  const title = raw.title || raw.nadpis || '';
  const description = raw.description || raw.popis || '';
  const price = raw.price || raw.cena || null;
  const city = raw.location || raw.mesto || raw.city || '';
  const sourceId = raw.id || raw.guid || null;
  // stable id: sha1 of url (prefixed with source)
  const id = url ? `tipcars:${crypto.createHash('sha1').update(String(url)).digest('hex')}` : `tipcars:${crypto.randomBytes(8).toString('hex')}`;

  return {
    id,
    source: 'tipcars',
    source_id: sourceId,
    link: url,
    title,
    description,
    price,
    currency: raw.currency || raw.kc || null,
    city,
    postal: raw.postal || raw.psc || null,
    lat: raw.lat || null,
    lon: raw.lon || null,
    category: raw.category || null,
    pubDate: raw.pubDate || raw.published || raw.date || null,
    crawledAt: new Date().toISOString(),
    raw: raw
  };
}

async function run() {
  let raw = '';
  if (FEED_URL) {
    console.log('TipCars importer starting for', FEED_URL);
    raw = await fetchFeed(FEED_URL);
  } else {
    console.log('TIPCARS_FEED_URL not provided; attempting website scrape fallback (will not require a feed)');
    // Try to scrape TipCars website search pages for recent listings
    const candidateUrls = [
      'https://www.tipcars.cz/cs/nabidka/osobni/',
      'https://www.tipcars.cz/cs/nabidka/',
      'https://www.tipcars.cz/cs/nabidka/osobni/?query=',
      'https://www.tipcars.cz/inzerce/',
      'https://www.tipcars.cz/inzerce',
      'https://www.tipcars.cz/',
      'https://www.tipcars.cz/auto-inzerce',
    ];
    const axiosImpl = await import('axios').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
    const cheerio = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
    const foundRawItems: any[] = [];
    // Prefer Puppeteer for JS-heavy sites when enabled
    const enablePuppeteer = String(process.env.USE_PUPPETEER || '').toLowerCase() === 'true';
    if (enablePuppeteer) {
      try {
        const puppeteer = await import('puppeteer').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
        if (puppeteer) {
          const launchOpts: any = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
          if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
          const browser = await puppeteer.launch(launchOpts).catch(() => null);
          if (browser) {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (compatible; SmartMarketFinder/1.0)');
            // Try a couple of entry points
            for (const u of candidateUrls) {
              try {
                await page.goto(u, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                // wait a bit for client-side rendering
                await page.waitForTimeout(1500);
                // try to wait for results container
                try { await page.waitForSelector('.search-layout__advertisements__results, [data-offer-listing-target="pool"]', { timeout: 4000 }).catch(() => {});} catch {}
                const anchors = await page.$$eval('a[href*="/inzerat"], a[href*="/detail"], a[href*="/nabidka"], a[href*="/offer"], a[href*="/nabidka/"]', (els: any[]) => els.map(e => ({ href: e.getAttribute('href'), title: e.textContent || '' }))).catch(() => []);
                for (const a of anchors.slice(0, 400)) {
                  if (!a || !a.href) continue;
                  const link = (() => { try { return new URL(a.href, u).href; } catch { return a.href; } })();
                  foundRawItems.push({ link, title: (a.title || '').trim(), description: '', price: null, city: '', id: link });
                }
                if (foundRawItems.length > 0) break;
              } catch (e) { /* ignore per-url puppeteer errors */ }
            }
            try { await browser.close(); } catch {}
          }
        }
      } catch (e) { /* ignore puppeteer init errors */ }
    }
    // Fallback to HTML fetch/cheerio if Puppeteer not available or found nothing
    if (foundRawItems.length === 0 && axiosImpl && cheerio) {
      for (const u of candidateUrls) {
        try {
          const res = await axiosImpl.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 15000 }).catch(() => null);
          if (!res || !res.data) continue;
          const $ = cheerio.load(String(res.data));
          const anchors = $('a[href*="/inzerat"], a[href*="/detail"], a[href*="/nabidka"]').toArray();
          for (const a of anchors.slice(0, 200)) {
            try {
              const $a = $(a as any);
              const href = ($a.attr('href') || '').trim();
              const title = ($a.text() || '').trim();
              if (!href || !title) continue;
              const link = (() => { try { return new URL(href, u).href; } catch { return href; } })();
              // minimal raw shape similar to feed expectations
              foundRawItems.push({ link, title, description: '', price: null, city: '', id: link });
            } catch (e) { /* ignore per-anchor errors */ }
          }
          if (foundRawItems.length > 0) break;
        } catch (e) { /* ignore per-url errors */ }
      }
    }
    raw = JSON.stringify({ items: foundRawItems });
    console.log('Website fallback scraped candidate items:', foundRawItems.length);
  }
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
  // map to full shape and filter invalid
  const mapped = items.map(mapItem).filter(i => i.link && i.title);

  // Helper: try to extract image URLs from common fields
  function extractImages(rawItem: any): string[] {
    const imgs: string[] = [];
    try {
      if (rawItem.enclosure && rawItem.enclosure.url) imgs.push(rawItem.enclosure.url);
      if (rawItem['media:content'] && rawItem['media:content']['@_url']) imgs.push(rawItem['media:content']['@_url']);
      if (rawItem.image) {
        if (typeof rawItem.image === 'string') imgs.push(rawItem.image);
        else if (rawItem.image.url) imgs.push(rawItem.image.url);
      }
      // try to parse img src from description/html
      const desc = String(rawItem.description || rawItem.popis || '');
      const re = /<img[^>]+src=["']?([^"'>\s]+)/gi;
      let m;
      while ((m = re.exec(desc)) !== null) { if (m[1]) imgs.push(m[1]); }
    } catch (e) { /* ignore */ }
    return Array.from(new Set(imgs)).slice(0, 10);
  }

  // If DB helper exists, upsert; otherwise just log. Also index to Meili.
  try {
    // Ensure DB is initialized first; Meili is best-effort and should not block DB upserts
    await pgHelper.init();
    let meiliIndex: any = null;
    try { meiliIndex = await ensureIndex(); } catch (mi) { console.warn('Meili ensureIndex failed (continuing):', String(mi)); }

    const toIndex: any[] = [];

    for (const m of mapped) {
      const images = extractImages(m.raw || {});
      const upsertPayload: any = {
        id: m.id,
        source: m.source,
        source_id: m.source_id,
        link: m.link,
        title: m.title,
        description: m.description,
        price: m.price || null,
        currency: m.currency || null,
        city: m.city || null,
        postal: m.postal || null,
        lat: m.lat || null,
        lon: m.lon || null,
        category: m.category || null,
        pubDate: m.pubDate || null,
        crawledAt: m.crawledAt || new Date().toISOString(),
        raw: m.raw || {}
      };

      await pgHelper.upsertItem(upsertPayload);

      // prepare Meili doc (keep minimal but useful fields)
      toIndex.push({
        id: upsertPayload.id,
        title: upsertPayload.title,
        description: upsertPayload.description,
        price: upsertPayload.price,
        currency: upsertPayload.currency,
        city: upsertPayload.city,
        postal: upsertPayload.postal,
        url: upsertPayload.link,
        source: upsertPayload.source,
        images: images
      });
    }

    // Bulk index to Meili (best-effort)
    try {
      await indexItems(toIndex);
      console.log('Indexed', toIndex.length, 'items to Meili (tipcars)');
    } catch (me) {
      console.warn('Meili indexing failed (tipcars):', String(me));
    }

    console.log('Upserted', mapped.length, 'items to Postgres (tipcars)');
  } catch (e) {
    console.warn('DB upsert failed or not configured; dry-run outputting sample:', String(e));
    console.log('Sample mapped items:', mapped.slice(0, 5));
  }

  console.log('TipCars importer finished');
}

run().catch(e => { console.error('import_tipcars error', e); process.exit(2); });
