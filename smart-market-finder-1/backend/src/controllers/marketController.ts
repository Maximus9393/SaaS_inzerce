import { Request, Response } from 'express';
import { scrapeBazos } from '../scraper/scraper';
import { filterResults } from '../utils/filter';
import * as store from '../utils/store';
import { searchMarket } from '../services/marketService';
import { searchListings } from '../services/searchService';
import lookupPostalPrefixes, { PostalSuggestion } from '../utils/postalLookup';

/**
 * POST /api/search
 * body: { keywords, priceMin, priceMax, location, portal, filterMethod }
 */
export async function search(req: Request, res: Response) {
  try {
  const { keywords = '', priceMin, priceMax, location, portal = 'bazos', filterMethod = 'dedupe', strictLocation = false, limit, pageSize } = req.body || {};

  // Accept either a postal code or a city name. `searchMarket` will expand city names into PSČ prefixes.
  const locRaw = String(location || '').trim();
  const requested = Number(limit || pageSize || 50) || 50;
  console.log('[search] requested pageSize=', requested, 'location=', locRaw, 'keywordsLen=', String(keywords || '').length);
  // Respect the client's strictLocation flag (do not force strict mode)
  const results = await searchListings(keywords, { location: locRaw, pageSize: requested, strict: Boolean(strictLocation) });
  // filterResults expects items similar to scraper output (price as string), so map accordingly
  const rawLike = results.map(r => ({ title: r.title, price: String(r.price || ''), location: r.location, url: r.url, date: (r.date ? String(r.date) : ''), description: (r as any).description || '' }));
  const filtered = filterResults(rawLike, { method: filterMethod, keywords });
  // Return all filtered results to the client and let the frontend paginate as needed.
  store.setResults(filtered);

  return res.json({ ok: true, count: filtered.length, results: filtered });
  } catch (err: any) {
    console.error('search error', err);
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
  console.log('[suggestPostal] q=', q, 'len=', q.length, 'codes=', Array.from(q).map(c=>c.charCodeAt(0)));
  if (!q) return res.json({ ok: true, suggestions: [] });
  // Load suggestPostal at runtime to avoid potential stale module bindings
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const suggestPostalFromData: (s: string) => PostalSuggestion[] = require('../utils/postalLookup').suggestPostal;
  // Try primary lookup
  let suggestions: PostalSuggestion[] = suggestPostalFromData(q);
  console.log('[suggestPostal] primary suggestions=', suggestions && suggestions.slice(0,5));
  // extra debug: call the function again and log its raw return (debugging environment mismatch)
  try {
    const rawCall = suggestPostalFromData(q);
    console.log('[suggestPostal] rawCall length=', rawCall.length, 'sample=', rawCall.slice(0,3));
  } catch (e) {
    console.log('[suggestPostal] rawCall error', String(e));
  }

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
    console.log('[suggestPostal] variant-merged suggestions=', suggestions && suggestions.slice(0,5));
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