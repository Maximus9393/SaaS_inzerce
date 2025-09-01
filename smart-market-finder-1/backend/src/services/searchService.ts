import { searchMarket, SearchCriteria } from './marketService';
import { MarketResult } from '../models/market';

export async function searchListings(query: string, opts?: { location?: string; saveToDb?: boolean; pageSize?: number; strict?: boolean }): Promise<MarketResult[]> {
  const criteria: SearchCriteria = {
    keywords: query || undefined,
    location: opts?.location || undefined,
    strictLocation: Boolean(opts?.strict),
    pageSize: opts?.pageSize,
    saveToDb: Boolean(opts?.saveToDb),
  } as SearchCriteria;
  return await searchMarket(criteria);
}

export default { searchListings };
