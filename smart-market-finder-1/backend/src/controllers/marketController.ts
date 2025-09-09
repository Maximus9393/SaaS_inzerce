import { Request, Response } from 'express';
import { scrape } from '../scraper/scraper';
import { filterResults } from '../utils/filter';
import * as store from '../utils/store';
import { searchMarket } from '../services/marketService';
import { searchListings } from '../services/searchService';
import lookupPostalPrefixes, { PostalSuggestion } from '../utils/postalLookup';
import { logger } from '../utils/logger';

/**
 * POST /api/search
 * body: { keywords, priceMin, priceMax, location, portal, filterMethod }
 */
export async function search(req: Request, res: Response) {
  try {
  const { keywords = '', priceMin, priceMax, location, portal = 'bazos', filterMethod = 'dedupe', strictLocation = false, limit, pageSize, sort, order } = req.body || {};
  // Fast-mode (diagnostic/CI): if caller sets `fast` true in body, return a tiny mocked result set
  if (req.body && (req.body.fast === true || req.query && req.query.fast === '1')) {
    const sample = [{ title: `Mock ${String(keywords || '')}` , price: '10000 Kč', location: String(location || 'Praha'), url: 'https://example.com/mock/1', date: new Date().toISOString(), description: 'Sample item for fast matrix runs', thumbnail: '' }];
    store.setResults(sample as any);
    return res.json({ ok: true, count: sample.length, results: sample });
  }

  // Accept either a postal code or a city name. `searchMarket` will expand city names into PSČ prefixes.
  const locRaw = String(location || '').trim();
  const requested = Number(limit || pageSize || 50) || 50;
  logger.info(`[search] requested pageSize=${requested} location=${locRaw} keywordsLen=${String(keywords || '').length}`);
  // Respect the client's strictLocation flag (do not force strict mode)
  const { originPostal, originLat, originLon } = req.body || {};

  // First: try to return saved DB results immediately for better latency/UX
  // Immediately return any stored in-memory results to avoid blocking the request.
  try {
    const current = store.getResults() || [];
    const has = Array.isArray(current) && current.length > 0;
    // helper: run a promise with timeout
    const runWithTimeout = async <T>(p: Promise<T>, ms = 8000): Promise<T | null> => {
      return await Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))]);
    };

    // Start background work: fetch saved DB results and run scrapers/indexers as needed.
    (async () => {
      try {
        // 1) Try to enrich from DB (searchSaved)
        try {
          const listingSvc = await import('../services/listingService');
          const saved = await listingSvc.searchSaved(String(keywords || ''), locRaw, Number(requested));
          if (Array.isArray(saved) && saved.length > 0) {
            const rawLike = saved.map((r: any) => ({ title: r.title, price: r.price ? String(r.price) + ' Kč' : '', location: r.location || '', url: r.url, date: (r.createdAt ? String(r.createdAt) : ''), description: r.description || '', thumbnail: r.thumbnail || '' }));
            const filtered = filterResults(rawLike, { method: filterMethod, keywords });
            store.setResults(filtered as any);
          }
        } catch (e) {
          try { logger.warn('[search-bg] DB quick fetch failed: ' + (e && (e as any).message ? (e as any).message : String(e))); } catch {}
        }

          // 2) Ensure a full live search runs to fill missing results and persist to DB/meili
          try {
            const fresh = await runWithTimeout(searchListings(keywords, { location: locRaw, pageSize: requested, strict: Boolean(strictLocation), portal, sort, order, originPostal, originLat, originLon, saveToDb: true } as any), 10000);
            if (Array.isArray(fresh) && fresh.length) {
              const rawLike = fresh.map((r: any) => ({ title: r.title, price: String(r.price || ''), location: r.location || '', url: r.url, date: (r.date ? String(r.date) : ''), description: (r as any).description || '', thumbnail: (r as any).thumbnail || '' }));
              const filteredFresh = filterResults(rawLike, { method: filterMethod, keywords });
              store.setResults(filteredFresh as any);
            }
            // if fresh is null => timeout, run scraper fallback below
            if (fresh === null) {
              throw new Error('searchListings timed out');
            }
          } catch (e) {
            try { logger.warn('[search-bg] full background search failed: ' + (e && (e as any).message ? (e as any).message : String(e))); } catch {}
            // Fallback: if DB/Meili unavailable or searchListings timed out, try local scrapers to provide some fast results
            try {
              const scraped = await scrape({ keywords: String(keywords || ''), location: locRaw, limit: Math.max(10, Math.min(50, requested)) } as any);
              if (Array.isArray(scraped) && scraped.length) {
                const mapped = scraped.map((it: any) => ({ title: it.title, price: it.price ? String(it.price) + ' Kč' : '', location: it.location || '', url: it.url, date: it.date || new Date().toISOString(), description: it.description || '', thumbnail: it.thumbnail || '' }));
                const filtered = filterResults(mapped, { method: filterMethod, keywords });
                store.setResults(filtered as any);
              }
            } catch (ee) {
              try { logger.warn('[search-bg] scraper fallback also failed: ' + (ee && (ee as any).message ? (ee as any).message : String(ee))); } catch {}
            }
          }
      } catch (e) {
        /* background errors ignored */
      }
    })();

    // Respond with current stored results; if none, indicate processing and let frontend poll /api/results
    if (has) return res.json({ ok: true, count: current.length, results: current });
    return res.json({ ok: true, count: 0, results: [], processing: true });
  } catch (e) {
    // fallback: spawn background work and return processing
    (async () => { try { await searchListings(keywords, { location: locRaw, pageSize: requested, strict: Boolean(strictLocation), portal, sort, order, originPostal, originLat, originLon, saveToDb: true } as any); } catch(e){} })();
    return res.json({ ok: true, count: 0, results: [], processing: true });
  }
  } catch (err: any) {
    console.error('search error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}

// Lightweight quick search endpoint: return currently stored results immediately
// and start background refresh work without awaiting it. This avoids blocking
// the request on slow DB/scraper work.
export async function searchQuick(req: Request, res: Response) {
  try {
    const { keywords = '', location = '', limit, pageSize, portal = 'bazos', strictLocation = false, sort, order } = req.body || {};
    const locRaw = String(location || '').trim();
    const requested = Number(limit || pageSize || 50) || 50;
    // return in-memory results quickly
    try {
      const current = store.getResults() || [];
      const has = Array.isArray(current) && current.length > 0;
      // background refresh - fire-and-forget
      setImmediate(async () => {
        try {
          // run searchListings with a timeout; if it times out, fallback to local scrapers
          const fresh = await (async () => {
            const p = searchListings(String(keywords || ''), { location: locRaw, pageSize: requested, strict: Boolean(strictLocation), portal, sort, order } as any);
            return await Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), 10000))]);
          })();
          if (Array.isArray(fresh) && fresh.length) {
            const mapped = (fresh as any[]).map((r: any) => ({ title: r.title, price: r.price ? String(r.price) : '', location: r.location || '', url: r.url, date: r.date || new Date().toISOString(), description: r.description || '', thumbnail: r.thumbnail || '' }));
            const filtered = filterResults(mapped, { method: 'dedupe', keywords });
            store.setResults(filtered as any);
            return;
          }
          if (fresh === null) throw new Error('searchListings timed out');
        } catch (e) {
          try { logger.warn('[searchQuick] background refresh failed: ' + (e && (e as any).message ? (e as any).message : String(e))); } catch{}
          // fallback to local scrapers so frontend sees some results even when DB/Prisma is not configured
          try {
            const scraped = await scrape({ keywords: String(keywords || ''), location: locRaw, limit: Math.max(10, Math.min(50, requested)) } as any);
            if (Array.isArray(scraped) && scraped.length) {
              const mapped = scraped.map((it: any) => ({ title: it.title, price: it.price ? String(it.price) + ' Kč' : '', location: it.location || '', url: it.url, date: it.date || new Date().toISOString(), description: it.description || '', thumbnail: it.thumbnail || '' }));
              const filtered = filterResults(mapped, { method: 'dedupe', keywords });
              store.setResults(filtered as any);
            }
              // final fallback: if nothing found (likely offline/dev), set a small mock result so frontend shows something
              const cur = store.getResults() || [];
              if ((!cur || cur.length === 0)) {
                const allowed = (process.env.ENABLE_DEMO_FALLBACK === '1') || process.env.NODE_ENV === 'development';
                if (allowed) {
                  const mock = [{ title: `Demo: ${String(keywords || '')}`, price: '10000 Kč', location: locRaw || 'Praha', url: 'https://example.com/demo/1', date: new Date().toISOString(), description: 'Demo result (no DB or network available)', thumbnail: '' }];
                  try { logger.info('[searchQuick-fallback] setting mock results, keywords=' + String(keywords || '')); } catch(e){}
                  store.setResults(mock as any);
                }
              }
          } catch (ee) {
            try { logger.warn('[searchQuick] scraper fallback failed: ' + (ee && (ee as any).message ? (ee as any).message : String(ee))); } catch {}
          }
          // final guarantee: if nothing in store yet, set a demo mock result so UI is not empty
          try {
            const cur2 = store.getResults() || [];
            if ((!cur2 || cur2.length === 0)) {
              const mock2 = [{ title: `Demo: ${String(keywords || '')}`, price: '10000 Kč', location: locRaw || 'Praha', url: 'https://example.com/demo/1', date: new Date().toISOString(), description: 'Demo result (no DB or network available)', thumbnail: '' }];
              try { logger.info('[searchQuick-fallback-final] forcing mock results'); } catch(e){}
              store.setResults(mock2 as any);
            }
          } catch (eee) { /* ignore */ }
        }
      });
      if (has) return res.json({ ok: true, count: current.length, results: current });
      return res.json({ ok: true, count: 0, results: [], processing: true });
    } catch (e) {
      // fallback: spawn background and return processing
      setImmediate(async () => { try { await searchListings(String(keywords || ''), { location: locRaw, pageSize: requested, strict: Boolean(strictLocation), portal, sort, order } as any); } catch(e){} });
      return res.json({ ok: true, count: 0, results: [], processing: true });
    }
  } catch (err: any) {
    console.error('searchQuick error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}

export function suggestPostal(req: Request, res: Response) {
  try {
  let qRaw: any = req.query.q || '';
  if (Array.isArray(qRaw)) qRaw = qRaw[0];
  let q = String(qRaw || '').trim();
  // try decode if percent-encoded
  try { q = decodeURIComponent(q); } catch (e) { /* ignore */ }
  logger.info(`[suggestPostal] q=${q} len=${q.length}`);
  if (!q) return res.json({ ok: true, suggestions: [] });
  // Load suggestPostal at runtime to avoid potential stale module bindings
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const suggestPostalFromData: (s: string) => PostalSuggestion[] = require('../utils/postalLookup').suggestPostal;
  // Try primary lookup
  let suggestions: PostalSuggestion[] = suggestPostalFromData(q);
  logger.info(`[suggestPostal] primary suggestions=${(suggestions && suggestions.slice(0,5) || []).length}`);

  // If no results, try simple spelling variants and aggregate (dedupe by code)
  if ((!suggestions || suggestions.length === 0) && q) {
    const variants = new Set<string>([q]);
    // replace trailing 'ick' -> 'ik' (melnick -> melnik)
    variants.add(q.replace(/ick$/i, 'ik'));
    // drop trailing 'c'
    variants.add(q.replace(/c$/i, ''));
    // ASCII-only fold (remove diacritics)
    try { variants.add(q.normalize('NFD').replace(/\p{Diacritic}/gu, '')); } catch (e) { /* ignore */ }

    const all: PostalSuggestion[] = [];
    for (const v of Array.from(variants)) {
      if (!v) continue;
      try {
        const s = suggestPostalFromData(v);
        if (s && s.length) all.push(...s);
      } catch (e) {
        // ignore
      }
    }
    // dedupe by code preserving order
    const seen = new Set<string>();
    suggestions = all.filter(s => { if (seen.has(s.code)) return false; seen.add(s.code); return true; }).slice(0, 50);
  logger.info(`[suggestPostal] variant-merged suggestions=${(suggestions && suggestions.slice(0,5) || []).length}`);
  }

  // If the user typed only digits, force numeric sort ascending and limit to 5 items
  try {
    const numericQuery = /^\d+$/.test(q.replace(/\s+/g, ''));
    if (numericQuery) {
      // ensure unique by code first
      const seen = new Set<string>();
      suggestions = suggestions.filter(s => { if (seen.has(s.code)) return false; seen.add(s.code); return true; });
      suggestions.sort((a, b) => Number(a.code) - Number(b.code));
      suggestions = suggestions.slice(0, 5);
    }
  } catch (e) {
    // ignore sorting errors
  }

  return res.json({ ok: true, suggestions });
  } catch (e: any) {
    console.error('suggestPostal error', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

/**
 * GET /api/results
 */
export function getResults(_req: Request, res: Response) {
  try {
    // Guard the in-memory store access so any unexpected error doesn't cause a 500 to the frontend.
    let results;
    try {
      results = store.getResults();
    } catch (innerErr) {
      console.error('[getResults] store.getResults failed', innerErr, { headers: _req.headers });
      // Return safe empty result set so the frontend can continue to operate.
      return res.json({ ok: true, results: [] });
    }
    return res.json({ ok: true, results });
  } catch (err: any) {
    console.error('getResults error', err, { headers: _req.headers });
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}