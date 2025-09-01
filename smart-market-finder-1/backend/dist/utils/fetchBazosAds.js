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
exports.fetchBazosAds = fetchBazosAds;
const axios_1 = __importDefault(require("axios"));
// use require to avoid ESM interop issues at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio = require('cheerio');
function normalizeText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
}
function normalizeForCompare(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '');
}
/**
 * Fetch Bazos ads using Cheerio HTML parsing.
 * URL format: https://www.bazos.cz/inzeraty/auta/<locality>/?q=<query>
 */
function fetchBazosAds(searchQuery_1, locality_1) {
    return __awaiter(this, arguments, void 0, function* (searchQuery, locality, strictLocality = false) {
        const q = encodeURIComponent(String(searchQuery || '').trim());
        const locSegment = encodeURIComponent(String(locality || '').trim());
        const locSegmentLower = encodeURIComponent(String(locality || '').trim().toLowerCase());
        // lightweight log
        const candidates = [
            `https://auto.bazos.cz/inzeraty/${locSegment}/?q=${q}`,
            `https://www.bazos.cz/inzeraty/auta/${locSegment}/?q=${q}`,
            `https://www.bazos.cz/search.php?hledat=${q}&hlokalita=${encodeURIComponent(String(locality || ''))}`
        ];
        try {
            const currentYear = new Date().getFullYear();
            const wantNorm = normalizeForCompare(locality || '');
            // prefer lowercase locality path variants
            const candidatesWithLocal = candidates.map(u => u.replace(encodeURIComponent(String(locality || '').trim()), locSegmentLower));
            // candidate urls (kept minimal)
            for (const url of candidatesWithLocal) {
                try {
                    const res = yield axios_1.default.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 15000, validateStatus: (s) => s < 500 });
                    if (!res || !res.data)
                        continue;
                    let $;
                    try {
                        $ = cheerio.load(res.data);
                    }
                    catch (e) {
                        console.log('[fetchBazosAds] cheerio.load error', String(e));
                        continue;
                    }
                    const results = [];
                    // Prefer container-first extraction: listing blocks often group title, price and locality
                    const containers = $('.inzeraty.inzeratyflex, .inzeraty, .inzerat, .inzerat-wrap, .inzerat-block').toArray();
                    // candidate containers count available via containers.length if needed
                    for (let ci = 0; ci < containers.length; ci++) {
                        try {
                            const c = containers[ci];
                            const $c = $(c);
                            // find a detail anchor inside the container; prefer one with non-empty text
                            const anchorsArr = $c.find('h2.nadpis a, .inzeratynadpis a, .nadpis a, a').toArray().map((x) => $(x));
                            let $a = anchorsArr.find(($n) => { const h = String($n.attr('href') || '').toLowerCase(); return /\/inzerat\//.test(h) && normalizeText($n.text()).length > 0; });
                            if (!$a) {
                                $a = anchorsArr.find(($n) => { const h = String($n.attr('href') || '').toLowerCase(); return /\/inzerat\//.test(h); });
                            }
                            if (!$a)
                                continue;
                            let title = normalizeText($a.text());
                            // fallback to image alt or nearby h2 if anchor text is empty
                            if (!title) {
                                try {
                                    const img = $a.find('img').first();
                                    if (img && img.length)
                                        title = normalizeText(img.attr('alt') || '');
                                }
                                catch (e) { /* ignore */ }
                            }
                            if (!title) {
                                const h2 = $c.find('h2.nadpis').first();
                                if (h2 && h2.length)
                                    title = normalizeText(h2.text());
                            }
                            let href = String($a.attr('href') || '').trim();
                            if (!title || !href)
                                continue;
                            try {
                                href = new URL(href, url).href;
                            }
                            catch ( /* leave href as-is */_a) { /* leave href as-is */ }
                            // direct children selectors for price/locality
                            let priceText = normalizeText($c.find('.cena, .inzeratycena, .price, .velkaCena').first().text() || '');
                            let localityText = normalizeText($c.find('.inzeratylok, .mesto, .locality, .umisteni').first().text() || '');
                            // no debug logs here
                            // sometimes price/locality are siblings after the title container
                            if ((!priceText || !localityText)) {
                                try {
                                    const nextSibs = $c.nextAll();
                                    if (nextSibs && nextSibs.length) {
                                        nextSibs.each((idx, el) => {
                                            try {
                                                const $el = $(el);
                                                if (!priceText) {
                                                    const ps = $el.find('.cena, .inzeratycena, .price, .velkaCena').first();
                                                    if (ps && ps.length)
                                                        priceText = normalizeText(ps.text());
                                                }
                                                if (!localityText) {
                                                    const ls = $el.find('.inzeratylok, .mesto, .locality, .umisteni').first();
                                                    if (ls && ls.length)
                                                        localityText = normalizeText(ls.text());
                                                }
                                            }
                                            catch (e) { /* ignore per-sib */ }
                                        });
                                    }
                                }
                                catch (e) { /* ignore */ }
                            }
                            // fallback: try searching upward within a few parents (edge layouts)
                            if ((!priceText || !localityText)) {
                                try {
                                    let parent = $c.parent();
                                    let depth = 0;
                                    while (parent && parent.length && depth < 4 && (!priceText || !localityText)) {
                                        if (!priceText)
                                            priceText = normalizeText(parent.find('.cena, .inzeratycena, .price, .velkaCena').first().text() || '');
                                        if (!localityText)
                                            localityText = normalizeText(parent.find('.inzeratylok, .mesto, .locality, .umisteni').first().text() || '');
                                        parent = parent.parent();
                                        depth++;
                                    }
                                }
                                catch (e) { /* ignore */ }
                            }
                            // try tbody detail layout for locality if not found
                            if (!localityText) {
                                try {
                                    const tbodyRow = $('tbody tr').filter((idx, el) => { return ($(el).find('td').first().text() || '').trim().startsWith('Lokalita'); }).first();
                                    if (tbodyRow && tbodyRow.length) {
                                        const locTd = tbodyRow.find('td').eq(1);
                                        const anchorsLoc = locTd.find('a');
                                        if (anchorsLoc && anchorsLoc.length >= 2) {
                                            localityText = normalizeText($(anchorsLoc[1]).text());
                                        }
                                        else {
                                            localityText = normalizeText(locTd.text());
                                        }
                                    }
                                }
                                catch (e) { /* ignore */ }
                            }
                            // fallback: meta description
                            if (!localityText) {
                                const metaDesc = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim();
                                const lm = metaDesc.match(/Lokalita:\s*([^,\n]+)/i);
                                if (lm && lm[1])
                                    localityText = lm[1].trim();
                            }
                            // Price parsing
                            let priceNum = null;
                            let priceCandidate = priceText || '';
                            if (!priceCandidate) {
                                try {
                                    const nearby = $c.find('.cena, .inzeratycena, .price, .velkaCena').first();
                                    if (nearby && nearby.length)
                                        priceCandidate = normalizeText(nearby.text());
                                }
                                catch (e) { /* ignore */ }
                            }
                            if (priceCandidate) {
                                const digits = priceCandidate.replace(/[^0-9]/g, '');
                                if (digits) {
                                    const asNum = Number(digits);
                                    if (!(digits.length === 4 && asNum >= 1900 && asNum <= (currentYear + 1))) {
                                        priceNum = Number(asNum);
                                    }
                                }
                            }
                            const itemLocality = localityText || '';
                            // strict locality
                            if (strictLocality && wantNorm) {
                                const itemNorm = normalizeForCompare(itemLocality);
                                if (!itemNorm || !itemNorm.includes(wantNorm)) {
                                    continue;
                                }
                            }
                            results.push({ title, price: priceNum, link: href, locality: itemLocality, source: 'bazos' });
                        }
                        catch (e) {
                            // ignore per-container errors
                        }
                    }
                    // Fallback: anchor-first extraction if no containers produced results
                    if (results.length === 0) {
                        const anchors = $('h2.nadpis a, .inzeratynadpis a, .nadpis a').toArray().filter((a) => {
                            const href = String((a.attribs && a.attribs.href) || '').toLowerCase();
                            return /\/inzerat\//.test(href);
                        });
                        console.log('[fetchBazosAds] fallback anchorsFound=', anchors.length);
                        for (let i = 0; i < anchors.length; i++) {
                            try {
                                const a = anchors[i];
                                const $a = $(a);
                                let title = normalizeText($a.text());
                                // if anchor text is empty, try image alt or nearby h2
                                if (!title) {
                                    try {
                                        const img = $a.find('img').first();
                                        if (img && img.length)
                                            title = normalizeText(img.attr('alt') || '');
                                    }
                                    catch (e) { }
                                }
                                if (!title) {
                                    const h2 = $a.closest('.inzerat, .inzeraty, .inzerat-wrap').find('h2.nadpis').first();
                                    if (h2 && h2.length)
                                        title = normalizeText(h2.text());
                                }
                                let href = String($a.attr('href') || '').trim();
                                if (!title || !href)
                                    continue;
                                try {
                                    href = new URL(href, url).href;
                                }
                                catch (_b) { }
                                // climb to container for locality/price (existing approach)
                                let container = $a.parent();
                                let tries = 0;
                                let priceText = '';
                                let localityText = '';
                                while (container && container.length && tries < 6) {
                                    const p = container.find('.cena, .inzeratycena, .price, .velkaCena').first();
                                    const l = container.find('.inzeratylok, .mesto, .locality, .umisteni').first();
                                    if (p && p.length)
                                        priceText = normalizeText(p.text());
                                    if (l && l.length)
                                        localityText = normalizeText(l.text());
                                    if (priceText && localityText)
                                        break;
                                    try {
                                        const nextSibs = container.nextAll();
                                        if ((!priceText || !localityText) && nextSibs && nextSibs.length) {
                                            nextSibs.each((idx, el) => {
                                                try {
                                                    const $el = $(el);
                                                    if (!priceText) {
                                                        const ps = $el.find('.cena, .inzeratycena, .price, .velkaCena').first();
                                                        if (ps && ps.length)
                                                            priceText = normalizeText(ps.text());
                                                    }
                                                    if (!localityText) {
                                                        const ls = $el.find('.inzeratylok, .mesto, .locality, .umisteni').first();
                                                        if (ls && ls.length)
                                                            localityText = normalizeText(ls.text());
                                                    }
                                                }
                                                catch (e) { }
                                            });
                                        }
                                    }
                                    catch (e) { }
                                    const parent = container.parent();
                                    if (!parent || parent.length === 0)
                                        break;
                                    container = parent;
                                    tries++;
                                }
                                // try tbody / meta fallbacks (reuse same logic as above)
                                if (!localityText) {
                                    try {
                                        const tbodyRow = $('tbody tr').filter((idx, el) => { return ($(el).find('td').first().text() || '').trim().startsWith('Lokalita'); }).first();
                                        if (tbodyRow && tbodyRow.length) {
                                            const locTd = tbodyRow.find('td').eq(1);
                                            const anchorsLoc = locTd.find('a');
                                            if (anchorsLoc && anchorsLoc.length >= 2) {
                                                localityText = normalizeText($(anchorsLoc[1]).text());
                                            }
                                            else {
                                                localityText = normalizeText(locTd.text());
                                            }
                                        }
                                    }
                                    catch (e) { }
                                }
                                if (!localityText) {
                                    const metaDesc = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim();
                                    const lm = metaDesc.match(/Lokalita:\s*([^,\n]+)/i);
                                    if (lm && lm[1])
                                        localityText = lm[1].trim();
                                }
                                let priceNum = null;
                                let priceCandidate = '';
                                if (priceText)
                                    priceCandidate = priceText;
                                else {
                                    try {
                                        const nearby = $a.closest('li, .inzerat, article, .inzerat-wrap');
                                        const p2 = nearby.find('.cena, .inzeratycena, .price, .velkaCena').first();
                                        if (p2 && p2.length)
                                            priceCandidate = normalizeText(p2.text());
                                    }
                                    catch (e) { }
                                }
                                if (priceCandidate) {
                                    const digits = priceCandidate.replace(/[^0-9]/g, '');
                                    if (digits) {
                                        const asNum = Number(digits);
                                        if (!(digits.length === 4 && asNum >= 1900 && asNum <= (currentYear + 1))) {
                                            priceNum = Number(asNum);
                                        }
                                    }
                                }
                                const itemLocality = localityText || '';
                                if (strictLocality && wantNorm) {
                                    const itemNorm = normalizeForCompare(itemLocality);
                                    if (!itemNorm || !itemNorm.includes(wantNorm)) {
                                        continue;
                                    }
                                }
                                results.push({ title, price: priceNum, link: href, locality: itemLocality, source: 'bazos' });
                            }
                            catch (e) { }
                        }
                    }
                    if (results.length > 0) {
                        return results;
                    }
                }
                catch (e) {
                    console.log('[fetchBazosAds] candidate parse error:', e && (e.message || e.toString()));
                    // try next candidate
                    continue;
                }
            }
            // nothing found in any candidate
            return [];
        }
        catch (err) {
            // on fetch error, return empty array
            return [];
        }
    });
}
exports.default = fetchBazosAds;
