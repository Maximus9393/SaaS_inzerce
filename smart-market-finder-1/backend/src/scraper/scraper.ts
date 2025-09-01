export type ScrapeItem = {
  title: string;
  price: string;
  location: string;
  postal?: string;
  url: string;
  date: string;
  description?: string;
  thumbnail?: string;
};

type ScrapeOpts = {
  keywords?: string;
  priceMin?: number;
  priceMax?: number;
  location?: string;
  strictLocation?: boolean;
  // When true, the caller treats `location` as a postal-prefix and prefers postal matching
  wantIsPostal?: boolean;
  // maximum number of items to extract from the listing page
  limit?: number;
};

/**
 * Unified, modular scraper for Bazoš.
 */
export async function scrapeBazos(opts: ScrapeOpts = {}): Promise<ScrapeItem[]> {
  const DEBUG = String(process.env.DEBUG_SCRAPER || '').toLowerCase() === 'true';
  const logger = {
    debug: (...args: any[]) => { if (DEBUG) console.log('[scraper][debug]', ...args); },
    info: (...args: any[]) => { if (DEBUG) console.info('[scraper][info]', ...args); },
    error: (...args: any[]) => { console.error('[scraper][error]', ...args); }
  };

  const normalizeText = (s?: string) => {
    if (!s) return '';
    return String(s).replace(/&nbsp;|\u00A0/g, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  };

  const normalizeForMatch = (s?: string) => String(normalizeText(s)).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

  const normalizePrice = (p: string) => normalizeText(p || '');

  const extractCurrencyFromText = (text?: string): string => {
    if (!text) return '';
    const s = String(text).replace(/&nbsp;|\u00A0/g, ' ');
    const reUnit = /(\d{1,3}(?:[ \u00A0\.,]\d{3})*(?:[ \u00A0\.,]\d+)?\s*(?:Kč|Kc|CZK))/ig;
    let mm: RegExpExecArray | null = null;
    const matches: string[] = [];
    while ((mm = reUnit.exec(s)) !== null) {
      if (mm[1]) matches.push(mm[1].replace(/\s+/g, ' ').trim());
    }
    if (matches.length) { matches.sort((a, b) => b.length - a.length); return matches[0]; }

    const mCena = s.match(/Cena[:\s\-–—]*([^,\n]+)/i);
    if (mCena && mCena[1]) {
      const c = (mCena[1] || '').trim();
      const cunit = c.match(/(\d{1,3}(?:[ \u00A0\.,]\d{3})*(?:[ \u00A0\.,]\d+)?\s*(?:Kč|Kc|CZK))/i);
      if (cunit && cunit[1]) return cunit[1].replace(/\s+/g, ' ').trim();
      const cnum = c.match(/(\d{3,}(?:[ \u00A0\.,]\d{3})*)/);
      if (cnum && cnum[1]) return cnum[1].replace(/\s+/g, ' ').trim();
    }

    const reNum = /\b(\d{3,}(?:[ \u00A0\.,]\d{3})*)(?:\s*(\w+))?/g;
    const MIN_BARE_PRICE = Number(process.env.MIN_BARE_PRICE || '10000');
    const currentYear = new Date().getFullYear();
    mm = null;
    while ((mm = reNum.exec(s)) !== null) {
      const numRaw = mm[1];
      const follow = (mm[2] || '').toLowerCase();
      if (follow && ['kw', 'km', 'ccm', 'cc', 'rv', 'rok', 'ks'].includes(follow.replace(/\.|,/g, ''))) continue;
      const digits = Number(String(numRaw).replace(/[ \u00A0\.,]/g, ''));
      if (isNaN(digits)) continue;
      if (digits >= 1900 && digits <= currentYear + 1) continue;
      if (digits >= MIN_BARE_PRICE) return String(numRaw).replace(/\s+/g, ' ').trim();
    }
    return '';
  };

  const isValidPrice = (p?: string): boolean => {
    if (!p) return false;
    const hasCurrency = /Kč|Kc|CZK/i.test(p);
    const digits = Number(String(p).replace(/[^0-9]/g, '')) || 0;
    const MIN_BARE_PRICE = Number(process.env.MIN_BARE_PRICE || '10000');
    if (!hasCurrency && digits > 0 && digits < MIN_BARE_PRICE) return false;
    if (/^\d{4}$/.test(String(p).trim())) return false;
    return true;
  };

  type ParseOptions = { baseUrl?: string; limit?: number };
  const parseListingsFromHtml = (html: string, optsParse: ParseOptions = {}): ScrapeItem[] => {
    try {
      // dynamic import to keep deps optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const base = optsParse.baseUrl || 'https://www.bazos.cz';
      const anchors = $('h2.nadpis a, .inzeratynadpis a, .nadpis a').toArray();
      const cap = Math.max(5, Math.min(50, Number(optsParse.limit || 20)));
      const found: ScrapeItem[] = [];
      for (let i = 0; i < anchors.length && found.length < cap; i++) {
        try {
          const a = anchors[i];
          const $a = $(a);
          const title = normalizeText($a.text() || '');
          let href = ($a.attr('href') || '').trim();
          if (!title || !href) continue;
          try { href = new URL(href, base).href; } catch {}
          if (!/\/inzerat\//i.test(href)) continue;

          let container = $a.parent();
          let tries = 0;
          let priceText = '';
          let locText = '';
          let descText = '';
          while (container && tries < 6) {
            const p = container.find('.inzeratycena, .cena, .price, .velkaCena, .inzerat-cena').first();
            const l = container.find('.inzeratylok, .mesto, .locality, .umisteni').first();
            const d = container.find('.popis, .description, .inzerat-popis').first();
            if (p && p.length) priceText = (p.text() || '').trim() || priceText;
            if (l && l.length) locText = (l.text() || '').trim() || locText;
            if (d && d.length) descText = (d.text() || '').trim() || descText;
            if (priceText || locText || descText) break;
            const parent = container.parent();
            if (!parent || parent.length === 0) break;
            container = parent;
            tries++;
          }
          if (!priceText && container && container.length) {
            const allText = container.text() || '';
            const c = extractCurrencyFromText(allText);
            if (c) priceText = c;
          }

          let thumb = '';
          try {
            const img = $a.find('img').first();
            if (img && img.length) { thumb = ($(img).attr('src') || '').trim(); try { thumb = new URL(thumb, base).href; } catch {} }
            else if (container) { const img2 = container.find('img').first(); if (img2 && img2.length) { thumb = ($(img2).attr('src') || '').trim(); try { thumb = new URL(thumb, base).href; } catch {} } }
          } catch (e) { logger.debug('[parseListingsFromHtml] thumb parse error', e && (e as any).message ? (e as any).message : e); }

          const item: ScrapeItem = {
            title: normalizeText(title),
            price: normalizePrice(priceText || ''),
            location: normalizeText(locText || ''),
            url: href,
            date: new Date().toISOString(),
            description: normalizeText(descText || ''),
            thumbnail: thumb || ''
          };
          found.push(item);
        } catch (e) {
          logger.debug('[parseListingsFromHtml] per-anchor error', e && (e as any).message ? (e as any).message : e);
        }
      }
      return found;
    } catch (e) {
      logger.error('[parseListingsFromHtml] parser failed', e && (e as any).message ? (e as any).message : e);
      return [];
    }
  };

  const fetchDetailPage = async (it: ScrapeItem, axiosImpl: any, cheerioImpl: any): Promise<ScrapeItem> => {
    try {
      const r = await axiosImpl.get(it.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 10000 }).catch(() => null);
      if (!r || !r.data) return it;
      const $ = cheerioImpl.load(r.data);
      const metaDesc = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim();

      if ((!it.price || !isValidPrice(it.price)) && metaDesc) {
        const c = extractCurrencyFromText(metaDesc);
        if (c) it.price = normalizePrice(c);
      }

      if (!it.thumbnail || it.thumbnail === '') {
        const og = ($('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content') || '').trim();
        if (og) { try { it.thumbnail = new URL(og, it.url).href; } catch { it.thumbnail = og; } }
        else { const firstImg = $('img').first().attr('src') || ''; if (firstImg) { try { it.thumbnail = new URL(String(firstImg).trim(), it.url).href; } catch { it.thumbnail = String(firstImg).trim(); } } }
      }

      if ((!it.location || it.location.trim() === '') && metaDesc) {
        const lm = metaDesc.match(/Lokalita:\s*([^,\n]+)/i) || metaDesc.match(/([A-Za-zÁ-Žá-žěščřžůĚŠČŘŽŮ\s\-]+)\s*\d{3,}/i);
        if (lm && lm[1]) it.location = normalizeText(lm[1]); else if (lm && lm[0]) it.location = normalizeText(lm[0]);
      }

      try {
        const tbodyLocRow = $('tbody tr').filter((i: number, el: any) => { return ($(el).find('td').first().text() || '').trim().startsWith('Lokalita'); }).first();
        if (tbodyLocRow && tbodyLocRow.length) {
          const locTd = tbodyLocRow.find('td').eq(2);
          const anchors = locTd.find('a');
          if (anchors && anchors.length >= 1) {
            const postalText = $(anchors[0]).text().trim();
            if (/^\d{3,}/.test(postalText)) it.postal = postalText.replace(/\s+/g, '').trim();
          }
          if ((!it.location || it.location === '') && anchors && anchors.length >= 2) {
            const detailCity = $(anchors[1]).text().trim(); if (detailCity) it.location = normalizeText(detailCity);
          }
        }
      } catch (e) { /* ignore */ }

      try {
        const tbodyPriceRow = $('tbody tr').filter((i: number, el: any) => { return ($(el).find('td').first().text() || '').trim().startsWith('Cena'); }).first();
        if (tbodyPriceRow && tbodyPriceRow.length) {
          const pb = tbodyPriceRow.find('b').first().text().trim(); if (pb) it.price = normalizePrice(pb.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim());
        }
      } catch (e) { /* ignore */ }

      if ((!it.price || !isValidPrice(it.price))) {
        const p = $('.inzeratydetdel b, .inzeratycena b, .inzeratydet .cena, .price').first().text().trim(); if (p) it.price = normalizePrice(p);
      }
      if ((!it.location || it.location.trim() === '')) {
        const l = $('.inzeratydet tr:contains("Lokalita"), .inzeratylok, .locality').first().text().trim(); if (l) it.location = normalizeText(l.replace(/Lokalita[:\s\-]*/i, ''));
      }
    } catch (e) {
      logger.debug('[fetchDetailPage] per-item error', e && (e as any).message ? (e as any).message : e);
    }
    return it;
  };

  const fetchDetailsInBatches = async (items: ScrapeItem[], concurrency = 3) => {
    try {
      const axios = await import('axios').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
      const cheerio = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
      if (!axios || !cheerio) return items;
      const toFetch = items.map((it, idx) => ({ it, idx })).filter(x => {
        const p = String(x.it.price || '').trim(); const l = String(x.it.location || '').trim(); return !isValidPrice(p) || !l || x.it.thumbnail === '';
      });
      if (toFetch.length === 0) return items;
      const batchSize = Math.max(1, concurrency);
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        await Promise.all(batch.map(async b => {
          try {
            const updated = await fetchDetailPage(b.it, axios, cheerio); items[b.idx] = updated;
          } catch (e) { logger.debug('[fetchDetailsInBatches] item fetch failed', e && (e as any).message ? (e as any).message : e); }
        }));
      }
    } catch (e) { logger.error('[fetchDetailsInBatches] error', e && (e as any).message ? (e as any).message : e); }
    return items;
  };

  const { keywords = '', priceMin, priceMax, location } = opts;
  const results: ScrapeItem[] = [];
  const requestedLimit = Math.max(1, Math.min(100, Number((opts as any).limit || 50)));
  // Try puppeteer only if enabled and available
  try {
    const enablePuppeteer = String(process.env.USE_PUPPETEER || '').toLowerCase() === 'true';
    const puppeteer = enablePuppeteer ? await import('puppeteer').catch(() => null) : null;
    if (puppeteer) {
      logger.debug('[scraper] puppeteer module found');
      const launchOpts: any = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
      if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      let browser: any = null;
      try { browser = await puppeteer.launch(launchOpts); logger.debug('[scraper] puppeteer launched'); } catch (le: unknown) { const msg = le && (typeof le === 'object' ? ((le as any).message || String(le)) : String(le)); logger.error('[scraper] puppeteer launch error', msg); }
      if (browser) {
        try {
          const page = await browser.newPage(); await page.setUserAgent('Mozilla/5.0 (compatible; SmartMarketFinder/1.0)');
          const q = encodeURIComponent(keywords); let url = `https://www.bazos.cz/search.php?hledat=${q}`;
          if (location) { url += `&hlokalita=${encodeURIComponent(location)}`; if ((opts as any)?.wantIsPostal && !(opts as any)?.strictLocation) url += `&humkreis=20`; else if (opts && (opts as any).strictLocation) url += `&humkreis=0`; }
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch((e: unknown) => { const m = e && (typeof e === 'object' ? ((e as any).message || String(e)) : String(e)); logger.error('[scraper] page.goto error', m); });
          try { await page.waitForSelector('.inzeraty, .inzerat, .inzeratyflex, .inzerat-list', { timeout: 5000 }).catch(() => {}); } catch {}
          const html = await page.content(); const parsed = parseListingsFromHtml(html, { baseUrl: url, limit: requestedLimit }); if (parsed && parsed.length > 0) { results.push(...parsed); await fetchDetailsInBatches(results, Number(process.env.DETAIL_PAR_CONCURRENCY || '3')); }
        } catch (e) { logger.debug('[scraper] puppeteer extraction error', e && (e as any).message ? (e as any).message : e); }
        finally { try { await browser.close(); } catch {} }
      } else { logger.debug('[scraper] browser not available, will fall back to HTML fetch'); }
    }
  } catch (e) { logger.error('[scraper] runtime error', e && (e as any).message ? (e as any).message : e); }

  // HTML fallback
  if (results.length === 0) {
    logger.debug('[scraper] no items from puppeteer — trying HTML fallback');
    try {
      const axios = await import('axios').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
      const cheerio = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
      if (axios && cheerio) {
        const q = encodeURIComponent(keywords);
        let htmlUrl = `https://www.bazos.cz/search.php?hledat=${q}`;
        if (location) htmlUrl += `&hlokalita=${encodeURIComponent(location)}`;
        logger.debug('[scraper] fetching HTML', htmlUrl);
        const res = await axios.get(htmlUrl).catch((e: any) => { logger.error('[scraper] axios.get error', e && e.message); return null; });
        if (res && res.data) {
          const parsed = parseListingsFromHtml(String(res.data), { baseUrl: htmlUrl, limit: requestedLimit });
          if (parsed && parsed.length > 0) { results.push(...parsed); await fetchDetailsInBatches(results, Number(process.env.DETAIL_PAR_CONCURRENCY || '3')); }
          else logger.debug('[scraper] html fallback found nothing');
        }
      }
    } catch (e) { logger.error('[scraper] html fallback error', e && (e as any).message ? (e as any).message : e); }

    // simplified location filtering
    if (location && results.length > 0) {
      try {
        const wantNorm = normalizeForMatch(String(location)); const before = results.length;
        const filtered = results.filter(r => normalizeForMatch(r.location).includes(wantNorm) || normalizeForMatch(r.title).includes(wantNorm) || normalizeForMatch(r.description).includes(wantNorm));
        logger.debug('[scraper] post-fetch filtering by location', location, 'before=', before, 'after=', filtered.length);
        const MIN_ACCEPT = Number(process.env.MIN_ACCEPT || '3'); const strict = Boolean((opts as any)?.strictLocation);
        if (strict) { if (filtered.length > 0) { results.length = 0; results.push(...filtered); } else { logger.debug('[scraper] strict locality requested and filtering removed all results; returning EMPTY set'); results.length = 0; } }
        else { if (filtered.length >= MIN_ACCEPT) { results.length = 0; results.push(...filtered); } else { logger.debug('[scraper] post-fetch filtered below MIN_ACCEPT; relaxing locality'); } }
      } catch (e) { logger.debug('[scraper] location filtering error', e && (e as any).message ? (e as any).message : e); }
    }

    if (results.length === 0) {
      if (location) logger.debug('[scraper] no results after applying location filter; returning empty set for strict locality search');
      else { results.push({ title: `Test item matching "${keywords}"`, price: priceMin ? `${priceMin} Kč` : '100 Kč', location: location || 'Praha', url: `https://example.com/mock/${encodeURIComponent(keywords)}-1`, date: new Date().toISOString(), }); results.push({ title: `Second test item ${keywords}`, price: priceMax ? `${priceMax} Kč` : '200 Kč', location: location || 'Brno', url: `https://example.com/mock/${encodeURIComponent(keywords)}-2`, date: new Date().toISOString(), }); }
    }
  }

  try {
    const MIN_BARE_PRICE = Number(process.env.MIN_BARE_PRICE || '10000');
    for (const it of results) {
      try {
        const p = String(it.price || '').trim(); if (!p) continue; const looksLikeYear = /^\d{4}$/.test(p); const digits = Number(String(p).replace(/[^0-9]/g, '')) || 0; const hasCurrency = /Kč|Kc|CZK/i.test(p);
        if ((!hasCurrency && looksLikeYear) || (!hasCurrency && digits > 0 && digits < MIN_BARE_PRICE)) it.price = '';
      } catch (e) { /* ignore per-item */ }
    }
  } catch (e) { /* ignore final cleanup errors */ }

  return results;
}
