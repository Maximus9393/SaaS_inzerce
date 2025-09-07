import { searchMarket, SearchCriteria } from './marketService';
import { MarketResult } from '../models/market';

export async function searchListings(query: string, opts?: { location?: string; saveToDb?: boolean; pageSize?: number; strict?: boolean; portal?: string; sort?: string; order?: string; originPostal?: string; originLat?: number; originLon?: number }): Promise<MarketResult[]> {
  const criteria: SearchCriteria = {
    keywords: query || undefined,
    location: opts?.location || undefined,
    strictLocation: Boolean(opts?.strict),
    pageSize: opts?.pageSize,
    saveToDb: Boolean(opts?.saveToDb),
    // forward portal preference
    query: query,
  } as SearchCriteria;
  // attach portal on criteria if provided
  if (opts && opts.portal) (criteria as any).portal = opts.portal;
  if (opts && opts.sort) (criteria as any).sort = (opts.sort as any);
  if (opts && opts.order) (criteria as any).order = (opts.order as any);
  if (opts && opts.originPostal) (criteria as any).originPostal = String(opts.originPostal);
  if (opts && opts.originLat) (criteria as any).originLat = Number(opts.originLat);
  if (opts && opts.originLon) (criteria as any).originLon = Number(opts.originLon);
  return await searchMarket(criteria);
}

export default { searchListings };
