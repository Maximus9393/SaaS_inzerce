"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastResults = exports.searchMarket = void 0;
const scraper_1 = require("../scraper/scraper");
const postalLookup_1 = require("../utils/postalLookup");
// Try Meili first when available (dynamically)
let meiliClient = null;
try {
    meiliClient = require('../search/meili');
}
catch (e) {
    meiliClient = null;
}
// In-memory cache for last results (simple placeholder for future persistent store)
let lastResultsCache = [];
// --- Helpers -------------------------------------------------
const parsePrice = (raw) => {
    const MIN_BARE_PRICE = Number(process.env.MIN_BARE_PRICE || 10000);
    const s = String(raw || '').trim();
    const hasCurrency = /Kč|Kc|CZK/i.test(s);
    const digits = Number(s.replace(/[^0-9]/g, '')) || 0;
    if (hasCurrency)
        return isNaN(digits) ? 0 : digits;
    if (digits >= MIN_BARE_PRICE)
        return digits;
    return 0;
};
const deduplicateResults = (items) => {
    const seen = new Map();
    for (const it of items) {
        const key = (it.url && String(it.url).trim()) || (it.title && String(it.title).trim()) || undefined;
        if (key) {
            if (!seen.has(key))
                seen.set(key, it);
        }
        else {
            // keep items without stable key by generating a stable-ish key from title+index
            const fallback = `${String(it.title || '')}:${seen.size}`;
            if (!seen.has(fallback))
                seen.set(fallback, it);
        }
    }
    return Array.from(seen.values());
};
// Simple batch runner with concurrency (no external deps)
const runInBatches = (items_1, worker_1, ...args_1) => __awaiter(void 0, [items_1, worker_1, ...args_1], void 0, function* (items, worker, concurrency = 3) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const settled = yield Promise.allSettled(batch.map(b => worker(b)));
        for (const s of settled) {
            if (s.status === 'fulfilled')
                results.push(s.value);
            // on rejection we skip the value but continue
        }
    }
    return results;
});
// Fetch postal code from a detail page (returns postal string or empty)
const fetchPostalFromDetail = (url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const axios = yield Promise.resolve().then(() => __importStar(require('axios'))).then(m => (m && m.default) ? m.default : m).catch(() => null);
        const cheerio = yield Promise.resolve().then(() => __importStar(require('cheerio'))).then(m => (m && m.default) ? m.default : m).catch(() => null);
        if (!axios || !cheerio)
            return '';
        const r = yield axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 8000 }).catch(() => null);
        if (!r || !r.data)
            return '';
        const $ = cheerio.load(r.data);
        try {
            const tbodyLocRow = $('tbody tr').filter((i, el) => { return ($(el).find('td').first().text() || '').trim().startsWith('Lokalita'); }).first();
            if (tbodyLocRow && tbodyLocRow.length) {
                const locTd = tbodyLocRow.find('td').eq(2);
                const anchors = locTd.find('a');
                if (anchors && anchors.length >= 1) {
                    const postalText = $(anchors[0]).text().trim();
                    if (/^\d{3,}/.test(postalText))
                        return postalText.replace(/\s+/g, '').trim();
                }
            }
        }
        catch (e) {
            // ignore per-detail parse errors
        }
    }
    catch (e) {
        // network or import errors
    }
    return '';
});
// Run Meili search if available; return MarketResult[] or null if nothing found or error
const runMeiliSearch = (q, rawLocation, isPostalLike) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!meiliClient || !(process.env.MEILI_HOST || process.env.MEILI_KEY))
            return null;
        const index = yield meiliClient.ensureIndex();
        const searchOpts = { limit: 50 };
        if (isPostalLike) {
            const numericClean = rawLocation.replace(/\s+/g, '');
            const useLoc = numericClean.length >= 5 ? numericClean : numericClean.slice(0, 3);
            searchOpts.filter = `city LIKE "${useLoc}%"`;
        }
        const res = yield index.search(q || rawLocation || '', searchOpts).catch(() => null);
        if (res && Array.isArray(res.hits) && res.hits.length) {
            const hits = res.hits.map((h) => ({
                title: h.title || '',
                price: Number(h.price) || 0,
                location: h.city || h.locality || '',
                url: h.url || '',
                date: h.pubDate ? new Date(h.pubDate) : new Date()
            }));
            return hits.filter(h => Boolean(h.title));
        }
    }
    catch (e) {
        console.warn('[searchMarket] meili error', e && e.message ? e.message : e);
    }
    return null;
});
// Run a single scraper invocation and return deduped results
const runScraper = (options_1, ...args_1) => __awaiter(void 0, [options_1, ...args_1], void 0, function* (options, dedupeAfter = true) {
    try {
        const items = yield (0, scraper_1.scrapeBazos)(options);
        if (!Array.isArray(items))
            return [];
        if (dedupeAfter)
            return deduplicateResults(items);
        return items;
    }
    catch (e) {
        console.warn('[searchMarket] scraper run error', e && e.message ? e.message : e);
        return [];
    }
});
const filterByPostalPrefixes = (items_1, rawLocation_1, ...args_1) => __awaiter(void 0, [items_1, rawLocation_1, ...args_1], void 0, function* (items, rawLocation, concurrency = 3) {
    if (!rawLocation || items.length === 0)
        return items;
    const suggestions = (0, postalLookup_1.suggestPostal)(rawLocation || '');
    const prefixes = new Set((suggestions || []).map((s) => String(s.code).slice(0, 3)));
    if (prefixes.size === 0)
        return items;
    // For each item, attempt to fetch postal from detail; run in limited concurrency batches
    const results = [];
    const tasks = items.map(it => () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const postal = yield fetchPostalFromDetail(it.url);
            if (postal) {
                if (prefixes.has(postal.slice(0, 3)))
                    return it;
                return null;
            }
            // fallback textual match
            const norm = (s) => String(s || '').toLowerCase();
            const want = norm(rawLocation);
            if (norm(it.location).includes(want) || norm(it.title).includes(want) || norm(String(it.description || '')).includes(want))
                return it;
        }
        catch (e) {
            return it; // keep on per-item error
        }
        return null;
    }));
    // run tasks in batches
    for (let i = 0; i < tasks.length; i += concurrency) {
        const batch = tasks.slice(i, i + concurrency).map(fn => fn());
        const settled = yield Promise.allSettled(batch);
        for (const s of settled) {
            if (s.status === 'fulfilled' && s.value)
                results.push(s.value);
        }
    }
    return results;
});
const fillAdditionalPostalCodes = (rawLocation, keywords, strict, pageSize) => __awaiter(void 0, void 0, void 0, function* () {
    const suggestions = (0, postalLookup_1.suggestPostal)(rawLocation || '') || [];
    const MAX_CODES = Number(process.env.MAX_PSC_INITIAL || 16);
    const EXTRA_CAP = Number(process.env.MAX_PSC_EXTRA || 50);
    const runs = [];
    // First pass: initial set
    const initial = suggestions.slice(0, MAX_CODES);
    const pages = yield Promise.allSettled(initial.map(s => runScraper({ keywords, location: String(s.code), strictLocation: strict, wantIsPostal: true, limit: pageSize }, true)));
    for (const p of pages)
        if (p.status === 'fulfilled' && Array.isArray(p.value))
            runs.push(...p.value);
    // If still not enough, iterate further up to EXTRA_CAP
    if (runs.length < pageSize) {
        const more = suggestions.slice(MAX_CODES, Math.min(suggestions.length, MAX_CODES + EXTRA_CAP));
        for (const s of more) {
            try {
                const items = yield runScraper({ keywords, location: String(s.code), strictLocation: strict, wantIsPostal: true, limit: pageSize }, true);
                for (const it of items) {
                    runs.push(it);
                    if (runs.length >= pageSize)
                        break;
                }
            }
            catch (e) {
                // ignore per-code errors
            }
            if (runs.length >= pageSize)
                break;
        }
    }
    // Deduplicate before returning
    return deduplicateResults(runs);
});
const mapScrapeItemsToMarketResults = (items, pageSize) => {
    const mapped = items.map(r => ({
        title: r.title || '',
        price: parsePrice(r.price),
        location: r.location || r.postal || '',
        url: r.url || '',
        date: r.date ? new Date(r.date) : new Date(),
        thumbnail: r.thumbnail || undefined
    }));
    return mapped.filter(m => Boolean(m.title)).slice(0, pageSize);
};
// --- Public API -------------------------------------------------
const searchMarket = (criteria) => __awaiter(void 0, void 0, void 0, function* () {
    const keywords = String((criteria === null || criteria === void 0 ? void 0 : criteria.keywords) || (criteria === null || criteria === void 0 ? void 0 : criteria.query) || '').trim();
    const rawLocation = String((criteria === null || criteria === void 0 ? void 0 : criteria.location) || (criteria === null || criteria === void 0 ? void 0 : criteria.locality) || '').trim();
    const strict = Boolean((criteria === null || criteria === void 0 ? void 0 : criteria.strictLocation) || (criteria === null || criteria === void 0 ? void 0 : criteria.strict));
    const requested = Number((criteria === null || criteria === void 0 ? void 0 : criteria.limit) || (criteria === null || criteria === void 0 ? void 0 : criteria.pageSize) || 10) || 10;
    const allowed = [10, 20, 50, 100];
    const pageSize = allowed.includes(requested) ? requested : 10;
    const numericClean = rawLocation.replace(/\s+/g, '');
    const isPostalLike = /^\d{3,}$/.test(numericClean);
    // 1) Try Meili (fast path)
    try {
        const meiliRes = yield runMeiliSearch(keywords, rawLocation, isPostalLike);
        if (Array.isArray(meiliRes) && meiliRes.length) {
            lastResultsCache = meiliRes.slice(0, pageSize);
            return lastResultsCache;
        }
    }
    catch (e) {
        // log and continue to scraper
        console.warn('[searchMarket] meili fallback', e && e.message ? e.message : e);
    }
    // 2) Prepare scraper runs depending on input
    let aggregated = [];
    if (!rawLocation) {
        const items = yield runScraper({ keywords, location: '', strictLocation: strict, limit: pageSize }, true);
        aggregated.push(...items);
    }
    else if (isPostalLike) {
        const useLoc = numericClean.length >= 5 ? numericClean : numericClean.slice(0, 3);
        const items = yield runScraper({ keywords, location: useLoc, strictLocation: strict, wantIsPostal: true, limit: pageSize }, true);
        aggregated.push(...items);
    }
    else {
        // City name: relaxed search first
        const relaxed = yield runScraper({ keywords, location: rawLocation, strictLocation: false, limit: pageSize }, true);
        aggregated.push(...relaxed);
        // If we have relaxed results, try post-filtering by PSČ prefixes
        if (aggregated.length > 0) {
            const filtered = yield filterByPostalPrefixes(aggregated, rawLocation, Number(process.env.DETAIL_PAR_CONCURRENCY || 3));
            aggregated = filtered.length ? filtered : aggregated;
        }
        // If still empty, fill by postal codes
        if (aggregated.length === 0) {
            const filled = yield fillAdditionalPostalCodes(rawLocation, keywords, strict, pageSize);
            aggregated.push(...filled);
        }
    }
    // Final dedupe and mapping
    const unique = deduplicateResults(aggregated);
    const mapped = mapScrapeItemsToMarketResults(unique, pageSize);
    lastResultsCache = mapped;
    // Optional persistence: save found results to DB (idempotent where possible)
    if (criteria === null || criteria === void 0 ? void 0 : criteria.saveToDb) {
        try {
            // lazy import to avoid circular deps at module load
            const { saveListing } = yield Promise.resolve(`${'./listingService'}`).then(s => __importStar(require(s))).catch(() => ({ saveListing: null }));
            if (saveListing) {
                const concurrency = Number(process.env.DB_WRITE_CONCURRENCY || 3);
                yield runInBatches(mapped, (m) => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        yield saveListing({ title: m.title, price: Number(m.price) || 0, location: m.location, source: 'scraper', url: m.url, thumbnail: m.thumbnail });
                    }
                    catch (e) {
                        // swallow per-item DB errors
                    }
                }), concurrency);
            }
        }
        catch (e) {
            // ignore persistence failures for now
            console.warn('[searchMarket] saveToDb failed', e && e.message ? e.message : e);
        }
    }
    return mapped;
});
exports.searchMarket = searchMarket;
const getLastResults = () => __awaiter(void 0, void 0, void 0, function* () {
    // Returns the most recent in-memory cached search results.
    // This is a placeholder for a future persistent store (DB/cache).
    return lastResultsCache;
});
exports.getLastResults = getLastResults;
