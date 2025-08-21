import { Request, Response } from 'express';
import { scrapeBazos } from '../scraper/scraper';
import { filterResults } from '../utils/filter';
import * as store from '../utils/store';
import { searchMarket } from '../services/marketService';
import lookupPostalPrefixes from '../utils/postalLookup';

/**
 * POST /api/search
 * body: { keywords, priceMin, priceMax, location, portal, filterMethod }
 */
export async function search(req: Request, res: Response) {
  try {
  const { keywords = '', priceMin, priceMax, location, portal = 'bazos', filterMethod = 'dedupe', strictLocation = false } = req.body || {};

  // Delegate search to service which handles PSČ expansion / strict behavior
  const results = await searchMarket({ keywords, location, strictLocation });
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
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ ok: true, suggestions: [] });
    // If user typed digits, suggest matching prefixes; else suggest prefixes by city name
    const prefixes = lookupPostalPrefixes(q);
    return res.json({ ok: true, suggestions: prefixes });
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
    return res.json({ ok: true, results: store.getResults() });
  } catch (err: any) {
    console.error('getResults error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}