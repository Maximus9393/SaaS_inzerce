import { Request, Response } from 'express';
import { scrapeBazos } from '../scraper/scraper';
import { filterResults } from '../utils/filter';
import * as store from '../utils/store';

/**
 * POST /api/search
 * body: { keywords, priceMin, priceMax, location, portal, filterMethod }
 */
export async function search(req: Request, res: Response) {
  try {
  const { keywords = '', priceMin, priceMax, location, portal = 'bazos', filterMethod = 'dedupe', strictLocation = false } = req.body || {};

    let rawResults: any[] = [];
    if (portal === 'bazos') {
      rawResults = await scrapeBazos({ keywords, priceMin, priceMax, location, strictLocation });
    } else {
      rawResults = []; // placeholder for other portals
    }

  const filtered = filterResults(rawResults, { method: filterMethod, keywords });
  // Return all filtered results to the client and let the frontend paginate as needed.
  store.setResults(filtered);

  return res.json({ ok: true, count: filtered.length, results: filtered });
  } catch (err: any) {
    console.error('search error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
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