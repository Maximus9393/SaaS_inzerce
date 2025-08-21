"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastResults = exports.searchMarket = void 0;
const scraper_1 = require("../scraper/scraper");
const postalLookup_1 = __importDefault(require("../utils/postalLookup"));
/**
 * Contract:
 * - Input: criteria { keywords?, location?, strictLocation? }
 * - Output: Promise<MarketResult[]> (deduped by url)
 * - Error modes: scraper errors propagate; returns empty array on handled failure
 */
const searchMarket = (criteria) => __awaiter(void 0, void 0, void 0, function* () {
    const keywords = (criteria === null || criteria === void 0 ? void 0 : criteria.keywords) || (criteria === null || criteria === void 0 ? void 0 : criteria.query) || '';
    const rawLocation = String((criteria === null || criteria === void 0 ? void 0 : criteria.location) || (criteria === null || criteria === void 0 ? void 0 : criteria.locality) || '').trim();
    const strict = Boolean((criteria === null || criteria === void 0 ? void 0 : criteria.strictLocation) || (criteria === null || criteria === void 0 ? void 0 : criteria.strict));
    // If location looks numeric (postal) or empty, run single search
    const numericClean = rawLocation.replace(/\s+/g, '');
    const isPostalLike = /^\d{3,}$/.test(numericClean);
    const scraperRuns = [];
    if (!rawLocation) {
        scraperRuns.push((0, scraper_1.scrapeBazos)({ keywords, location: '', strictLocation: strict }));
    }
    else if (isPostalLike) {
        // pass postal prefix (first 3 digits) to scraper
        const prefix = numericClean.slice(0, 3);
        scraperRuns.push((0, scraper_1.scrapeBazos)({ keywords, location: prefix, strictLocation: strict, wantIsPostal: true }));
    }
    else {
        // Try to expand city name into PSČ prefixes
        const prefixes = (0, postalLookup_1.default)(rawLocation || '');
        if (prefixes && prefixes.length > 0) {
            // Limit the number of parallel prefix searches to avoid hammering remote site
            const MAX_PREFIXES = 8;
            prefixes.slice(0, MAX_PREFIXES).forEach(p => {
                scraperRuns.push((0, scraper_1.scrapeBazos)({ keywords, location: p, strictLocation: strict, wantIsPostal: true }));
            });
        }
        else {
            // no prefix found, fallback to searching by city name
            scraperRuns.push((0, scraper_1.scrapeBazos)({ keywords, location: rawLocation, strictLocation: strict }));
        }
    }
    // Run scrapers in parallel and aggregate results
    let allItems = [];
    try {
        const pages = yield Promise.all(scraperRuns);
        pages.forEach(p => { if (Array.isArray(p))
            allItems.push(...p); });
    }
    catch (err) {
        // propagate or return empty array; prefer returning empty so callers handle gracefully
        // console.warn('searchMarket: scraper error', err);
        return [];
    }
    // Deduplicate by URL (if available)
    const seen = new Map();
    allItems.forEach(it => {
        const key = (it.url || it.title || Math.random().toString()).toString();
        if (!seen.has(key))
            seen.set(key, it);
    });
    const unique = Array.from(seen.values());
    // Map ScrapeItem -> MarketResult (minimal mapping)
    const mapped = (unique || []).map(r => ({
        title: r.title || '',
        price: (() => { const n = Number(String(r.price || '').replace(/[^0-9]/g, '')); return isNaN(n) ? 0 : n; })(),
        location: r.location || r.postal || '',
        url: r.url || '',
        date: r.date ? new Date(r.date) : new Date()
    }));
    // Filter out entries without title or price
    return mapped.filter((result) => Boolean(result.title) && Boolean(result.price));
});
exports.searchMarket = searchMarket;
const getLastResults = () => __awaiter(void 0, void 0, void 0, function* () {
    // Placeholder - no persistent store yet
    return [];
});
exports.getLastResults = getLastResults;
