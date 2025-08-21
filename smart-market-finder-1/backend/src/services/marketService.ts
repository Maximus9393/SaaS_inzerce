import { MarketResult } from '../models/market';
import { scrapeBazos, ScrapeItem } from '../scraper/scraper';
import lookupPostalPrefixes from '../utils/postalLookup';

/**
 * Contract:
 * - Input: criteria { keywords?, location?, strictLocation? }
 * - Output: Promise<MarketResult[]> (deduped by url)
 * - Error modes: scraper errors propagate; returns empty array on handled failure
 */
export const searchMarket = async (criteria: any): Promise<MarketResult[]> => {
    const keywords = criteria?.keywords || criteria?.query || '';
    const rawLocation = String(criteria?.location || criteria?.locality || '').trim();
    const strict = Boolean(criteria?.strictLocation || criteria?.strict);

    // If location looks numeric (postal) or empty, run single search
    const numericClean = rawLocation.replace(/\s+/g, '');
    const isPostalLike = /^\d{3,}$/.test(numericClean);

    const scraperRuns: Promise<ScrapeItem[]>[] = [];

    if (!rawLocation) {
        scraperRuns.push(scrapeBazos({ keywords, location: '', strictLocation: strict }));
    } else if (isPostalLike) {
        // pass postal prefix (first 3 digits) to scraper
        const prefix = numericClean.slice(0, 3);
        scraperRuns.push(scrapeBazos({ keywords, location: prefix, strictLocation: strict, wantIsPostal: true }));
    } else {
        // Try to expand city name into PSČ prefixes
        const prefixes = lookupPostalPrefixes(rawLocation || '');
        if (prefixes && prefixes.length > 0) {
            // Limit the number of parallel prefix searches to avoid hammering remote site
            const MAX_PREFIXES = 8;
            prefixes.slice(0, MAX_PREFIXES).forEach(p => {
                scraperRuns.push(scrapeBazos({ keywords, location: p, strictLocation: strict, wantIsPostal: true }));
            });
        } else {
            // no prefix found, fallback to searching by city name
            scraperRuns.push(scrapeBazos({ keywords, location: rawLocation, strictLocation: strict }));
        }
    }

    // Run scrapers in parallel and aggregate results
    let allItems: ScrapeItem[] = [];
    try {
        const pages = await Promise.all(scraperRuns);
        pages.forEach(p => { if (Array.isArray(p)) allItems.push(...p); });
    } catch (err) {
        // propagate or return empty array; prefer returning empty so callers handle gracefully
        // console.warn('searchMarket: scraper error', err);
        return [];
    }

    // Deduplicate by URL (if available)
    const seen = new Map<string, ScrapeItem>();
    allItems.forEach(it => {
        const key = (it.url || it.title || Math.random().toString()).toString();
        if (!seen.has(key)) seen.set(key, it);
    });

    const unique = Array.from(seen.values());

    // Map ScrapeItem -> MarketResult (minimal mapping)
    const mapped: MarketResult[] = (unique || []).map(r => ({
        title: r.title || '',
        price: (() => { const n = Number(String(r.price || '').replace(/[^0-9]/g, '')); return isNaN(n) ? 0 : n; })(),
        location: r.location || r.postal || '',
        url: r.url || '',
        date: r.date ? new Date(r.date) : new Date()
    }));

    // Filter out entries without title or price
    return mapped.filter((result) => Boolean(result.title) && Boolean(result.price));
};

export const getLastResults = async (): Promise<MarketResult[]> => {
    // Placeholder - no persistent store yet
    return [];
};