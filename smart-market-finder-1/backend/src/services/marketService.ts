import { MarketResult } from '../models/market';
import { postalToCoords, cityToCoords, haversine } from '../utils/geo';
import { scrapeBazos, ScrapeItem } from '../scraper/scraper';
import lookupPostalPrefixes, { suggestPostal, PostalSuggestion } from '../utils/postalLookup';
import { redisGet, redisSet } from '../utils/redisClient';

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
    portal?: string;
    // sort: one of 'date'|'price'|'km'|'distance'
    sort?: 'date' | 'price' | 'km' | 'distance';
    // order: 'asc'|'desc'
    order?: 'asc' | 'desc';
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
    const normalizeTitle = (s?: string) => {
        if (!s) return '';
        try { return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim(); } catch { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }
    };
    const normalizeUrlKey = (u?: string) => {
        if (!u) return '';
        try {
            const url = new URL(String(u).trim());
            // strip query and fragment
            url.search = '';
            url.hash = '';
            return url.href;
        } catch {
            // fallback: strip ? and #
            return String(u).split(/[?#]/)[0].trim();
        }
    };
    for (const it of items) {
        const urlKey = normalizeUrlKey(it.url);
        const titleKey = normalizeTitle(it.title);
        const key = urlKey || (titleKey ? `t:${titleKey}` : undefined);
        if (key) {
            if (!seen.has(key)) seen.set(key, it);
        } else {
            const fallback = `f:${seen.size}`;
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
                    date: h.pubDate ? new Date(h.pubDate) : new Date(),
                    images: Array.isArray(h.images) ? h.images : (h.image ? [h.image] : []),
                    description: h.description || h.metaDescription || ''
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
    thumbnail: (r as any).thumbnail || undefined,
    images: (r as any).images && Array.isArray((r as any).images) && (r as any).images.length ? (r as any).images : ((r as any).thumbnail ? [(r as any).thumbnail] : []),
        description: (r as any).description || '',
        // try to parse mileage from description or title (simple heuristic)
        km: (() => {
            try {
                const txt = ((r.title || '') + ' ' + (r.description || '')).toLowerCase();
                const m = txt.match(/(\d{1,3}(?:[ \u00A0,]\d{3})+)\s*(km|kilometr|km\.)/i);
                if (m && m[1]) return Number(String(m[1]).replace(/[^0-9]/g, ''));
                const m2 = txt.match(/(\d{4,6})\s*(km|kilometr)/i);
                if (m2 && m2[1]) return Number(m2[1]);
            } catch (e) { /* ignore */ }
            return undefined;
        })(),
        distance: undefined
    }));
    return mapped.filter(m => Boolean(m.title)).slice(0, pageSize);
};

// Apply sorting based on criteria; default: date desc
const applySort = (items: MarketResult[], criteria?: SearchCriteria): MarketResult[] => {
    if (!Array.isArray(items) || items.length === 0) return items;
    const sortBy = (criteria && criteria.sort) ? criteria.sort : 'date';
    const order = (criteria && criteria.order) ? criteria.order : 'desc';

    const cmp = (a: any, b: any) => {
        let va: any = a[sortBy as keyof MarketResult];
        let vb: any = b[sortBy as keyof MarketResult];
        // normalize dates
        if (sortBy === 'date') { va = a.date ? new Date(a.date).getTime() : 0; vb = b.date ? new Date(b.date).getTime() : 0; }
        // special handling for distance: treat undefined/null/NaN as Infinity so unknown distances sort last
        if (sortBy === 'distance') {
            const da = (va === undefined || va === null || isNaN(Number(va))) ? Infinity : Number(va);
            const db = (vb === undefined || vb === null || isNaN(Number(vb))) ? Infinity : Number(vb);
            if (da < db) return -1; if (da > db) return 1; return 0;
        }
        // ensure numbers for other sorts
        va = (typeof va === 'number') ? va : (va ? Number(va) : 0);
        vb = (typeof vb === 'number') ? vb : (vb ? Number(vb) : 0);
        if (va < vb) return -1; if (va > vb) return 1; return 0;
    };

    const sorted = items.slice().sort((a, b) => {
        const r = cmp(a, b);
        return order === 'asc' ? r : -r;
    });
    return sorted;
};

// compute simple relevance score for results given the query keywords
const scoreAndSortResults = (items: MarketResult[], rawQuery: string): MarketResult[] => {
    if (!rawQuery || !Array.isArray(items) || items.length === 0) return items;
    const normalize = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const q = normalize(rawQuery).replace(/[\s\-\_\,]+/g, ' ').trim();
    const qTokens = q.split(' ').filter(Boolean);

    const scoreFor = (m: MarketResult) => {
        let score = 0;
        const title = normalize(String(m.title || ''));
        const desc = normalize(String(m.description || ''));

        // exact phrase in title gives a big boost
        if (q && title.includes(q)) score += 50;
        // token matches in title (weighted)
        for (const t of qTokens) { if (t && title.includes(t)) score += 8; }
        // token matches in description (lighter)
        for (const t of qTokens) { if (t && desc.includes(t)) score += 2; }
        // prefer items with a non-empty price (likely a real listing)
        if (m.price && Number(m.price) > 0) score += 4;
        // penalize extremely short titles (likely junk)
        if ((m.title || '').length < 10) score -= 6;
        // small boost if image present
        if (m.images && Array.isArray(m.images) && m.images.length) score += 3;
        return score;
    };

    const scored = items.map(i => ({ item: i, s: scoreFor(i) }));
    scored.sort((a, b) => b.s - a.s);
    return scored.map(s => s.item);
};

// --- Public API -------------------------------------------------
export const searchMarket = async (criteria: SearchCriteria): Promise<MarketResult[]> => {
    const keywords = String(criteria?.keywords || criteria?.query || '').trim();
    const preferredPortal = String((criteria as any)?.portal || '').trim();
    const rawLocation = String(criteria?.location || criteria?.locality || '').trim();
    const strict = Boolean(criteria?.strictLocation || criteria?.strict);
    const requested = Number(criteria?.limit || criteria?.pageSize || 10) || 10;
    const allowed = [10, 20, 50, 100];
    const pageSize = allowed.includes(requested) ? requested : 10;

    const numericClean = rawLocation.replace(/\s+/g, '');
    const isPostalLike = /^\d{3,}$/.test(numericClean);
        // origin: either originPostal (string) or originLat/originLon numbers
        const originPostal = (criteria as any)?.originPostal ? String((criteria as any).originPostal).trim() : '';
        const originLat = (criteria as any)?.originLat ? Number((criteria as any).originLat) : undefined;
        const originLon = (criteria as any)?.originLon ? Number((criteria as any).originLon) : undefined;
        const originCoord = (() => {
            if (originLat !== undefined && originLon !== undefined && !isNaN(originLat) && !isNaN(originLon)) return { lat: originLat, lon: originLon };
            if (originPostal) {
                try { const { normalizePostalCode } = require('../utils/geo'); return postalToCoords(normalizePostalCode(String(originPostal))); } catch { return postalToCoords(originPostal); }
            }
            // if user supplied location as city, try to map
            return cityToCoords(rawLocation);
        })();

    // Redis cache key
    const cacheTTL = Number(process.env.REDIS_CACHE_TTL || 60); // seconds
    const cacheKey = `search:${keywords}:${rawLocation}:${pageSize}`;

    // Try Redis cache first
    try {
        const cached = await redisGet(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    lastResultsCache = parsed.slice(0, pageSize);
                    return lastResultsCache;
                }
            } catch (e) {
                // ignore parse errors
            }
        }
    } catch (e) {
        // ignore redis errors
    }

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
    let mapped = mapScrapeItemsToMarketResults(unique, pageSize);

        // propagate postal code from scraped items if available and compute distance (prefer detail lat/lon)
        if (originCoord) {
            for (const m of mapped) {
                try {
                    const src = unique.find(u => u.url === m.url) as any;
                    const p = src?.postal || undefined;
                    if (p) (m as any).postal = p;
                    let targetCoord = null as any;
                    // prefer explicit detail coords
                    if (src && src.lat !== undefined && src.lon !== undefined && !isNaN(Number(src.lat)) && !isNaN(Number(src.lon))) {
                        targetCoord = { lat: Number(src.lat), lon: Number(src.lon) };
                    } else {
                        if (p) targetCoord = postalToCoords(String(p));
                        if (!targetCoord) targetCoord = cityToCoords(m.location || '');
                        // Try lightweight city fallback: strip district numbers and trailing parts after comma/dash
                        if (!targetCoord && m.location) {
                            const short = String(m.location).split(/[,-]/)[0].replace(/\b\d+\b/g, '').trim();
                            if (short && short.length < String(m.location).length) {
                                targetCoord = cityToCoords(short);
                            }
                        }
                    }
                    const d = haversine(originCoord as any, targetCoord as any);
                    (m as any).distance = isFinite(d) ? d : undefined;
                } catch (e) { /* ignore per-item */ }
            }
        }

    // If client requested a portal preference, bias results so items from that portal appear first
    try {
        const portal = preferredPortal && preferredPortal.length ? preferredPortal.toLowerCase() : '';
        const portalDomain = (() => {
            if (!portal) return '';
            if (portal.includes('.')) return portal;
            if (portal.includes('bazo')) return 'bazos.cz';
            if (portal.includes('sauto')) return 'sauto.cz';
            if (portal.includes('tip')) return 'tipcars.cz';
            if (portal.includes('autos') || portal.includes('auto')) return 'sauto.cz';
            return portal;
        })();
        if (portalDomain) {
            const fav: MarketResult[] = [];
            const other: MarketResult[] = [];
            for (const m of mapped) {
                try {
                    if (m.url && String(m.url).toLowerCase().includes(portalDomain)) fav.push(m);
                    else other.push(m);
                } catch (e) { other.push(m); }
            }
            mapped = fav.concat(other);
        }
    } catch (e) { /* ignore portal bias errors */ }

    // apply requested sort (defaults to date desc)
    mapped = applySort(mapped, criteria as any);
    lastResultsCache = mapped;

    // store in redis (best-effort)
    try {
        await redisSet(cacheKey, JSON.stringify(mapped), cacheTTL);
    } catch (e) {
        // ignore cache write errors
    }
    // Optional persistence: save found results to DB (idempotent where possible)
    if (criteria?.saveToDb) {
        try {
            // enqueue persistence task to avoid blocking request-response
            const { enqueue } = await import('../utils/persistQueue' as any).catch(() => ({ enqueue: null }));
            if (enqueue) {
                for (const m of mapped) {
                    try {
                        enqueue({ url: m.url, title: m.title, price: Number(m.price) || null, location: m.location || null, description: m.description || null, postal: (m as any).postal || null, lat: (m as any).lat ?? null, lon: (m as any).lon ?? null, source: 'scraper', thumbnail: (m as any).thumbnail || null, images: Array.isArray((m as any).images) ? (m as any).images : null, ts: Date.now() });
                    } catch (e) {
                        // ignore per-item enqueue errors
                    }
                }
            }
        } catch (e) {
            console.warn('[searchMarket] enqueue saveToDb failed', e && (e as any).message ? (e as any).message : e);
        }
    }

    return mapped;
};

export const getLastResults = async (): Promise<MarketResult[]> => {
    // Returns the most recent in-memory cached search results.
    // This is a placeholder for a future persistent store (DB/cache).
    return lastResultsCache;
};