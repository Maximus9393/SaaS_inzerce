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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getResults = exports.suggestPostal = exports.search = void 0;
const filter_1 = require("../utils/filter");
const store = __importStar(require("../utils/store"));
const marketService_1 = require("../services/marketService");
const postalLookup_1 = __importDefault(require("../utils/postalLookup"));
/**
 * POST /api/search
 * body: { keywords, priceMin, priceMax, location, portal, filterMethod }
 */
function search(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { keywords = '', priceMin, priceMax, location, portal = 'bazos', filterMethod = 'dedupe', strictLocation = false } = req.body || {};
            // Delegate search to service which handles PSČ expansion / strict behavior
            const results = yield (0, marketService_1.searchMarket)({ keywords, location, strictLocation });
            // filterResults expects items similar to scraper output (price as string), so map accordingly
            const rawLike = results.map(r => ({ title: r.title, price: String(r.price || ''), location: r.location, url: r.url, date: (r.date ? String(r.date) : ''), description: r.description || '' }));
            const filtered = (0, filter_1.filterResults)(rawLike, { method: filterMethod, keywords });
            // Return all filtered results to the client and let the frontend paginate as needed.
            store.setResults(filtered);
            return res.json({ ok: true, count: filtered.length, results: filtered });
        }
        catch (err) {
            console.error('search error', err);
            return res.status(500).json({ ok: false, error: (err === null || err === void 0 ? void 0 : err.message) || 'Server error' });
        }
    });
}
exports.search = search;
function suggestPostal(req, res) {
    try {
        const q = String(req.query.q || '').trim();
        if (!q)
            return res.json({ ok: true, suggestions: [] });
        // If user typed digits, suggest matching prefixes; else suggest prefixes by city name
        const prefixes = (0, postalLookup_1.default)(q);
        return res.json({ ok: true, suggestions: prefixes });
    }
    catch (e) {
        console.error('suggestPostal error', e);
        return res.status(500).json({ ok: false, error: 'Server error' });
    }
}
exports.suggestPostal = suggestPostal;
/**
 * GET /api/results
 */
function getResults(_req, res) {
    try {
        return res.json({ ok: true, results: store.getResults() });
    }
    catch (err) {
        console.error('getResults error', err);
        return res.status(500).json({ ok: false, error: 'Server error' });
    }
}
exports.getResults = getResults;
