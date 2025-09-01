import { Request, Response } from 'express';
import { saveListing, findRecent } from '../services/listingService';

export async function createListing(req: Request, res: Response) {
  try {
    const { title, price, location, source, url, thumbnail } = req.body || {};
    const created = await saveListing({ title, price: Number(price) || 0, location, source: source || 'unknown', url, thumbnail });
    if (!created) return res.status(409).json({ error: 'already exists or not saved' });
    return res.json(created);
  } catch (e: any) {
    return res.status(500).json({ error: e && e.message ? e.message : 'error' });
  }
}

export async function listRecent(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit || 20) || 20;
    const rows = await findRecent(limit);
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ error: e && e.message ? e.message : 'error' });
  }
}
