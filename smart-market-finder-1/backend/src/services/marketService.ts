import { MarketResult } from '../models/market';
import { scrapeBazos, ScrapeItem } from '../scraper/scraper';
import lookupPostalPrefixes, { suggestPostal, PostalSuggestion } from '../utils/postalLookup';

// Try Meili first when available (dynamically)
let meiliClient: any = null;
try { meiliClient = require('../search/meili'); } catch (e) { meiliClient = null; }

// --- Types -------------------------------------------------
export interface SearchCriteria {
    keywords?: string;
    query?: string;
    location?: string;
    locality?: string;
    strictLocation?: boolean;
    strict?: boolean;
    limit?: number;
    pageSize?: number;
    saveToDb?: boolean;
}

type MeiliIndex = { search: (q: string, opts?: any) => Promise<any> };

// In-memory cache for last results (simple placeholder for future persistent store)
let lastResultsCache: MarketResult[] = [];

// --- Helpers -------------------------------------------------
const parsePrice = (raw: string | number | undefined): number => {
    const MIN_BARE_PRICE = Number(process.env.MIN_BARE_PRICE || 10000);
    const s = String(raw || '').trim();
    const hasCurrency = /Kč|Kc|CZK/i.test(s);
    const digits = Number(s.replace(/[^0-9]/g, '')) || 0;
    if (hasCurrency) return isNaN(digits) ? 0 : digits;
    if (digits >= MIN_BARE_PRICE) return digits;
    return 0;
};

const deduplicateResults = <T extends { url?: string; title?: string }>(items: T[]): T[] => {
    const seen = new Map<string, T>();
    for (const it of items) {
        const key = (it.url && String(it.url).trim()) || (it.title && String(it.title).trim()) || undefined;
        if (key) {
            if (!seen.has(key)) seen.set(key, it);
        } else {
            // keep items without stable key by generating a stable-ish key from title+index
            const fallback = `${String(it.title || '')}:${seen.size}`;
            if (!seen.has(fallback)) seen.set(fallback, it);
        }
    }
    return Array.from(seen.values());
};

// Simple batch runner with concurrency (no external deps)
const runInBatches = async <T, R>(items: T[], worker: (t: T) => Promise<R>, concurrency = 3): Promise<R[]> => {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const settled = await Promise.allSettled(batch.map(b => worker(b)));
        for (const s of settled) {
            if (s.status === 'fulfilled') results.push(s.value as R);
            // on rejection we skip the value but continue
        }
    }
    return results;
};

// Fetch postal code from a detail page (returns postal string or empty)
const fetchPostalFromDetail = async (url: string): Promise<string> => {
    try {
        const axios = await import('axios').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
        const cheerio = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
        if (!axios || !cheerio) return '';
        const r = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 8000 }).catch(() => null);
        if (!r || !r.data) return '';
        const $ = cheerio.load(r.data);
        try {
            const tbodyLocRow = $('tbody tr').filter((i: number, el: any) => { return ($(el).find('td').first().text() || '').trim().startsWith('Lokalita'); }).first();
            if (tbodyLocRow && tbodyLocRow.length) {
                const locTd = tbodyLocRow.find('td').eq(2);
                const anchors = locTd.find('a');
                if (anchors && anchors.length >= 1) {
                    const postalText = $(anchors[0]).text().trim();
                    if (/^\d{3,}/.test(postalText)) return postalText.replace(/\s+/g, '').trim();
                }
            }
        } catch (e) {
            // ignore per-detail parse errors
        }
    } catch (e) {
        // network or import errors
    }
    return '';
};

// Run Meili search if available; return MarketResult[] or null if nothing found or error
const runMeiliSearch = async (q: string, rawLocation: string, isPostalLike: boolean): Promise<MarketResult[] | null> => {
    try {
        if (!meiliClient || !(process.env.MEILI_HOST || process.env.MEILI_KEY)) return null;
        const index: MeiliIndex = await meiliClient.ensureIndex();
        const searchOpts: any = { limit: 50 };
        if (isPostalLike) {
            const numericClean = rawLocation.replace(/\s+/g, '');
            const useLoc = numericClean.length >= 5 ? numericClean : numericClean.slice(0, 3);
            searchOpts.filter = `city LIKE "${useLoc}%"`;
        }
        const res = await index.search(q || rawLocation || '', searchOpts).catch(() => null);
        if (res && Array.isArray(res.hits) && res.hits.length) {
            const hits: MarketResult[] = res.hits.map((h: any) => ({
                title: h.title || '',
                price: Number(h.price) || 0,
                location: h.city || h.locality || '',
                url: h.url || '',
                date: h.pubDate ? new Date(h.pubDate) : new Date()
            }));
            return hits.filter(h => Boolean(h.title));
        }
    } catch (e) {
        console.warn('[searchMarket] meili error', e && (e as any).message ? (e as any).message : e);
    }
    return null;
};

// Run a single scraper invocation and return deduped results
const runScraper = async (options: any, dedupeAfter = true): Promise<ScrapeItem[]> => {
    try {
        const items = await scrapeBazos(options);
        if (!Array.isArray(items)) return [];
        if (dedupeAfter) return deduplicateResults(items) as ScrapeItem[];
        return items;
    } catch (e) {
        console.warn('[searchMarket] scraper run error', e && (e as any).message ? (e as any).message : e);
        return [];
    }
};

const filterByPostalPrefixes = async (items: ScrapeItem[], rawLocation: string, concurrency = 3): Promise<ScrapeItem[]> => {
    if (!rawLocation || items.length === 0) return items;
    const suggestions = suggestPostal(rawLocation || '');
    const prefixes = new Set<string>((suggestions || []).map((s: PostalSuggestion) => String(s.code).slice(0, 3)));
    if (prefixes.size === 0) return items;

    // For each item, attempt to fetch postal from detail; run in limited concurrency batches
    const results: ScrapeItem[] = [];
    const tasks = items.map(it => async () => {
        try {
            const postal = await fetchPostalFromDetail(it.url);
            if (postal) {
                if (prefixes.has(postal.slice(0, 3))) return it;
                return null;
            }
            // fallback textual match
            const norm = (s: string) => String(s || '').toLowerCase();
            const want = norm(rawLocation);
            if (norm(it.location).includes(want) || norm(it.title).includes(want) || norm(String(it.description || '')).includes(want)) return it;
        } catch (e) {
            return it; // keep on per-item error
        }
        return null;
    });

    // run tasks in batches
    for (let i = 0; i < tasks.length; i += concurrency) {
        const batch = tasks.slice(i, i + concurrency).map(fn => fn());
        const settled = await Promise.allSettled(batch);
        for (const s of settled) {
            if (s.status === 'fulfilled' && s.value) results.push(s.value as ScrapeItem);
        }
    }

    return results;
};

const fillAdditionalPostalCodes = async (rawLocation: string, keywords: string, strict: boolean, pageSize: number): Promise<ScrapeItem[]> => {
    const suggestions = suggestPostal(rawLocation || '') || [];
    const MAX_CODES = Number(process.env.MAX_PSC_INITIAL || 16);
    const EXTRA_CAP = Number(process.env.MAX_PSC_EXTRA || 50);
    const runs: ScrapeItem[] = [];

    // First pass: initial set
    const initial = suggestions.slice(0, MAX_CODES);
    const pages = await Promise.allSettled(initial.map(s => runScraper({ keywords, location: String(s.code), strictLocation: strict, wantIsPostal: true, limit: pageSize }, true)));
    for (const p of pages) if (p.status === 'fulfilled' && Array.isArray(p.value)) runs.push(...p.value);

    // If still not enough, iterate further up to EXTRA_CAP
    if (runs.length < pageSize) {
        const more = suggestions.slice(MAX_CODES, Math.min(suggestions.length, MAX_CODES + EXTRA_CAP));
        for (const s of more) {
            try {
                const items = await runScraper({ keywords, location: String(s.code), strictLocation: strict, wantIsPostal: true, limit: pageSize }, true);
                for (const it of items) {
                    runs.push(it);
                    if (runs.length >= pageSize) break;
                }
            } catch (e) {
                // ignore per-code errors
            }
            if (runs.length >= pageSize) break;
        }
    }

    // Deduplicate before returning
    return deduplicateResults(runs) as ScrapeItem[];
};

const mapScrapeItemsToMarketResults = (items: ScrapeItem[], pageSize: number): MarketResult[] => {
    const mapped: MarketResult[] = items.map(r => ({
        title: r.title || '',
        price: parsePrice(r.price as any),
        location: r.location || r.postal || '',
        url: r.url || '',
        date: r.date ? new Date(r.date) : new Date(),
        thumbnail: (r as any).thumbnail || undefined
    }));
    return mapped.filter(m => Boolean(m.title)).slice(0, pageSize);
};

// --- Public API -------------------------------------------------
export const searchMarket = async (criteria: SearchCriteria): Promise<MarketResult[]> => {
    const keywords = String(criteria?.keywords || criteria?.query || '').trim();
    const rawLocation = String(criteria?.location || criteria?.locality || '').trim();
    const strict = Boolean(criteria?.strictLocation || criteria?.strict);
    const requested = Number(criteria?.limit || criteria?.pageSize || 10) || 10;
    const allowed = [10, 20, 50, 100];
    const pageSize = allowed.includes(requested) ? requested : 10;

    const numericClean = rawLocation.replace(/\s+/g, '');
    const isPostalLike = /^\d{3,}$/.test(numericClean);

    // 1) Try Meili (fast path)
    try {
        const meiliRes = await runMeiliSearch(keywords, rawLocation, isPostalLike);
        if (Array.isArray(meiliRes) && meiliRes.length) {
            lastResultsCache = meiliRes.slice(0, pageSize);
            return lastResultsCache;
        }
    } catch (e) {
        // log and continue to scraper
        console.warn('[searchMarket] meili fallback', e && (e as any).message ? (e as any).message : e);
    }

    // 2) Prepare scraper runs depending on input
    let aggregated: ScrapeItem[] = [];

    if (!rawLocation) {
        const items = await runScraper({ keywords, location: '', strictLocation: strict, limit: pageSize }, true);
        aggregated.push(...items);
    } else if (isPostalLike) {
        const useLoc = numericClean.length >= 5 ? numericClean : numericClean.slice(0, 3);
        const items = await runScraper({ keywords, location: useLoc, strictLocation: strict, wantIsPostal: true, limit: pageSize }, true);
        aggregated.push(...items);
    } else {
        // City name: relaxed search first
        const relaxed = await runScraper({ keywords, location: rawLocation, strictLocation: false, limit: pageSize }, true);
        aggregated.push(...relaxed);

        // If we have relaxed results, try post-filtering by PSČ prefixes
        if (aggregated.length > 0) {
            const filtered = await filterByPostalPrefixes(aggregated, rawLocation, Number(process.env.DETAIL_PAR_CONCURRENCY || 3));
            aggregated = filtered.length ? filtered : aggregated;
        }

        // If still empty, fill by postal codes
        if (aggregated.length === 0) {
            const filled = await fillAdditionalPostalCodes(rawLocation, keywords, strict, pageSize);
            aggregated.push(...filled);
        }
    }

    // Final dedupe and mapping
    const unique = deduplicateResults(aggregated) as ScrapeItem[];
    const mapped = mapScrapeItemsToMarketResults(unique, pageSize);

    lastResultsCache = mapped;
    // Optional persistence: save found results to DB (idempotent where possible)
    if (criteria?.saveToDb) {
        try {
            // lazy import to avoid circular deps at module load
            const { saveListing } = await import('./listingService' as any).catch(() => ({ saveListing: null }));
            if (saveListing) {
                const concurrency = Number(process.env.DB_WRITE_CONCURRENCY || 3);
                await runInBatches<MarketResult, any>(mapped, async (m) => {
                    try {
                        await saveListing({ title: m.title, price: Number(m.price) || 0, location: m.location, source: 'scraper', url: m.url, thumbnail: (m as any).thumbnail });
                    } catch (e) {
                        // swallow per-item DB errors
                    }
                }, concurrency);
            }
        } catch (e) {
            // ignore persistence failures for now
            console.warn('[searchMarket] saveToDb failed', e && (e as any).message ? (e as any).message : e);
        }
    }

    return mapped;
};

export const getLastResults = async (): Promise<MarketResult[]> => {
    // Returns the most recent in-memory cached search results.
    // This is a placeholder for a future persistent store (DB/cache).
    return lastResultsCache;
};