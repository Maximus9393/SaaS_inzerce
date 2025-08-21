export type ScrapeItem = {
  title: string;
  price: string;
  location: string;
  postal?: string;
  url: string;
  date: string;
  description?: string;
};

type ScrapeOpts = {
  keywords?: string;
  priceMin?: number;
  priceMax?: number;
  location?: string;
  strictLocation?: boolean;
  // When true, the caller treats `location` as a postal-prefix and prefers postal matching
  wantIsPostal?: boolean;
};

/**
 * scrapeBazos - best-effort: if puppeteer is installed, use it; otherwise return mock results.
 */
export async function scrapeBazos(opts: ScrapeOpts = {}): Promise<ScrapeItem[]> {
  const { keywords = '', priceMin, priceMax, location } = opts;
  const results: ScrapeItem[] = [];
  // helpers in function scope so both puppeteer and HTML fallback can use them
  const normalizePrice = (p: string) => {
    if (!p) return '';
    // replace non-breaking spaces and collapse whitespace, remove stray HTML entities
    return String(p).replace(/&nbsp;|\u00A0/g, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  };

  const extractCurrency = (text: string) => {
    if (!text) return '';
    const s = String(text).replace(/&nbsp;|\u00A0/g, ' ');
    // 1) Prefer explicit currency tokens like "499 000 Kč", "4.500 Kč", "4500 Kč", or with CZK
    const reUnit = /(\d{1,3}(?:[ \u00A0\.,]\d{3})*(?:[ \u00A0\.,]\d+)?\s*(?:Kč|Kc|CZK))/ig;
    const matches: string[] = [];
    let mm: RegExpExecArray | null = null;
    while ((mm = reUnit.exec(s)) !== null) {
      if (mm[1]) matches.push(mm[1].replace(/\s+/g, ' ').trim());
    }
    if (matches.length) {
      matches.sort((a, b) => b.length - a.length);
      return matches[0];
    }

    // 2) Look for explicit "Cena:" context followed by a number
    const mCena = s.match(/Cena[:\s\-–—]*([^,\n]+)/i);
    if (mCena && mCena[1]) {
      const c = (mCena[1] || '').trim();
      // try to extract unit-aware token from this snippet
      const cunit = c.match(/(\d{1,3}(?:[ \u00A0\.,]\d{3})*(?:[ \u00A0\.,]\d+)?\s*(?:Kč|Kc|CZK))/i);
      if (cunit && cunit[1]) return cunit[1].replace(/\s+/g, ' ').trim();
      const cnum = c.match(/(\d{3,}(?:[ \u00A0\.,]\d{3})*)/);
      if (cnum && cnum[1]) return cnum[1].replace(/\s+/g, ' ').trim();
    }

    // 3) Fallback: accept a bare number only if >= 1000 and not clearly a different unit (kw, km, ccm, rv/year)
    // capture number and following token
    const reNum = /\b(\d{3,}(?:[ \u00A0\.,]\d{3})*)(?:\s*(\w+))?/g;
    let best = '';
    const MIN_BARE_PRICE = 10000; // avoid picking years like 2025 or small unrelated numbers
    const currentYear = new Date().getFullYear();
    while ((mm = reNum.exec(s)) !== null) {
      const numRaw = mm[1];
      const follow = (mm[2] || '').toLowerCase();
      // blacklist common non-price units
      if (follow && ['kw', 'km', 'ccm', 'cc', 'rv', 'rok', 'ks'].includes(follow.replace(/\.|,/g, ''))) continue;
      // parse numeric value
      const digits = Number(String(numRaw).replace(/[ \u00A0\.,]/g, ''));
      if (isNaN(digits)) continue;
      // exclude four-digit tokens that look like years
      if (digits >= 1900 && digits <= currentYear + 1) continue;
      if (digits >= MIN_BARE_PRICE) {
        best = String(numRaw).replace(/\s+/g, ' ').trim();
        break;
      }
    }
    return best;
  };

  try {

    const puppeteer = await import('puppeteer').catch(() => null);
    if (puppeteer) {
      console.log('[scraper] puppeteer module found');
      // allow using system chrome via env var and make launch options container-friendly
      const launchOpts: any = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
      if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      let browser: any = null;
      try {
        browser = await puppeteer.launch(launchOpts);
        console.log('[scraper] puppeteer launched');
      } catch (le: unknown) {
        const msg = le && (typeof le === 'object' ? ((le as any).message || String(le)) : String(le));
        console.error('[scraper] puppeteer launch error', msg);
      }
      if (browser) {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (compatible; SmartMarketFinder/1.0)');
      const q = encodeURIComponent(keywords);
      // Use Bazoš search endpoint - form action is /search.php with param 'hledat' and 'hlokalita'
      // build base search URL. Note: we avoid forcing humkreis=0 (exact locality)
      // because that often over-filters; instead we request hlokalita and
      // perform a post-filter with a relaxed fallback if too few results.
      let url = `https://www.bazos.cz/search.php?hledat=${q}`;
      if (location) {
        url += `&hlokalita=${encodeURIComponent(location)}`;
        if (opts && (opts as any).strictLocation) {
          // force exact locality on the remote query when strict requested
          url += `&humkreis=0`;
        }
      }
      // navigate and wait for network idle; then wait for a listing container to appear
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch((e: unknown) => { const m = e && (typeof e === 'object' ? ((e as any).message || String(e)) : String(e)); console.error('[scraper] page.goto error', m); });
      try {
        // common listing containers on Bazoš: .inzeraty, .inzerat, .inzeratyflex
        await page.waitForSelector('.inzeraty, .inzerat, .inzeratyflex, .inzerat-list', { timeout: 5000 }).catch(() => {});
      } catch (err) {
        // ignore - we'll still try extraction and fallback
      }

        // Debug: capture page title/url and sample outerHTMLs to inspect site structure
        try {
          const sample = await page.evaluate(() => {
            // candidate selectors to probe
            const selectors = ['article', '[class*="inzerat"]', '.inzerat', '.inzeraty > li', '.inzerat-t-body', '.inzerat-wrap', '.inzerat-inner', '.inzerat-row', '.inzerat-list', '.inzeraty', '.inzeratyflex', '.inzeraty .inzerat'];
            const nodes: Array<{ sel: string; html: string }> = [];
            for (const s of selectors) {
              const list = Array.from(document.querySelectorAll(s));
              for (const n of list) {
                try {
                  nodes.push({ sel: s, html: (n as HTMLElement).outerHTML.slice(0, 1000) });
                } catch (err) {
                  // ignore
                }
              }
            }
            return {
              title: document.title,
              url: (window.location && window.location.href) ? window.location.href : document.URL,
              samples: nodes.slice(0, 10)
            };
          });
          console.log('[scraper] page debug', { url: sample.url, title: sample.title, sampleCount: (sample.samples || []).length });
          if (sample.samples && sample.samples.length > 0) {
            for (let i = 0; i < sample.samples.length; i++) {
              console.log(`[scraper] sample[${i}] sel=${sample.samples[i].sel} html=${sample.samples[i].html.replace(/\n/g, '')}`);
            }
          }
        } catch (e) {
          const m = e && (typeof e === 'object' ? ((e as any).message || String(e)) : String(e));
          console.error('[scraper] sample evaluate error', m);
        }

        // Use the page structure observed on Bazoš: container '.inzeraty.inzeratyflex' or '.inzeraty'
        try {
          const extracted = await page.evaluate(() => {
            function normalizeText(el: Element | null) {
              try { return el ? (el.textContent || '').trim() : ''; } catch { return ''; }
            }
            const anchors = Array.from(document.querySelectorAll('h2.nadpis a, .inzeratynadpis a, .nadpis a')) as HTMLAnchorElement[];
            const items: Array<any> = [];
            for (const a of anchors.slice(0, 50)) {
              const title = (a.textContent || '').trim();
              const href = a.href || '';
              // climb up to find a container that contains price or location
              let container: Element | null = a.parentElement;
              let tries = 0;
              while (container && tries < 6) {
                if (container.querySelector('.inzeratycena, .cena, .price, .inzeratylok, .mesto, .locality')) break;
                container = container.parentElement;
                tries++;
              }
              // fallback to closest article or list item
              if (!container) container = a.closest('article, li, .inzerat, .inzeraty') as Element | null;

              // Try to find price/location/description in container, but also check common siblings
              let price = '';
              let loc = '';
              let desc = '';
              if (container) {
                const priceEl = container.querySelector('.inzeratycena, .cena, .price, .velkaCena, .inzerat-cena');
                const locEl = container.querySelector('.inzeratylok, .mesto, .locality, .umisteni');
                const descEl = container.querySelector('.popis, .description, .inzerat-popis');
                if (priceEl) price = normalizeText(priceEl);
                if (locEl) loc = normalizeText(locEl);
                if (descEl) desc = normalizeText(descEl);
                // sometimes price is in a sibling element (e.g. container's parent has .inzeratycena)
                if (!price && container.parentElement) {
                  const siblingPrice = container.parentElement.querySelector('.inzeratycena, .cena, .price');
                  if (siblingPrice) price = normalizeText(siblingPrice);
                }
                // As a last resort, look for .inzeraty ancestor and find price inside it
                if (!price) {
                  const listAncestor = a.closest('.inzeraty, .listainzerat');
                  if (listAncestor) {
                    const pa = listAncestor.querySelector('.inzeratycena, .cena, .price');
                    if (pa) price = normalizeText(pa);
                  }
                }
                // regex fallback: try to match currency in container text
                if (!price) {
                  const txt = normalizeText(container);
                  try {
                    // window won't have our extractCurrency helper; implement a small inline regex
                    const m = txt.match(/(\d{1,3}(?:[ \u00A0\.,]\d{3})*(?:[ \u00A0\.,]\d+)?\s*(?:Kč|Kc|CZK))/i);
                    if (m && m[1]) price = m[1].trim();
                  } catch (e) {
                    // ignore
                  }
                }
              }

              items.push({ title, href, price, loc, desc });
            }
            return items;
          }).catch(() => [] as any[]);
          for (const it of extracted) {
            if (it && it.title && it.href) {
              results.push({ title: String(it.title).trim(), price: normalizePrice(String(it.price || '')), location: String(it.loc || location || '').trim(), url: String(it.href), date: new Date().toISOString(), description: String(it.desc || '').trim() });
            }
          }
        } catch (eEval) {
          const m = eEval && (typeof eEval === 'object' ? ((eEval as any).message || String(eEval)) : String(eEval));
          console.error('[scraper] evaluate extraction error', m);
        }
        console.log('[scraper] items scraped (pre-filter)', results.length);

  // determine strict flag early
  const strict = Boolean((opts as any)?.strictLocation);
  // Enrich items that lack price or location by fetching the ad detail page.
        // Some listing layouts show price/location only in the detail page or meta tags.
        try {
          const axios = await import('axios').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
          const cheerio = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
          if (axios && cheerio) {
            for (let i = 0; i < results.length; i++) {
              const it = results[i];
              if ((!it.price || it.price.trim() === '') || (!it.location || it.location.trim() === '')) {
                try {
                  const r = await axios.get(it.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 10000 }).catch(() => null);
                  if (r && r.data) {
                    const $ = cheerio.load(r.data);
                    // Try meta descriptions first (they often contain 'Cena: ... , Lokalita: ...')
                    const metaDesc = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim();
                    if ((!it.price || it.price.trim() === '') && metaDesc) {
                      // use extractCurrency on metaDesc via server-side helper
                      const c = extractCurrency(metaDesc);
                      if (c) it.price = c;
                      else {
                        const m = metaDesc.match(/Cena:\s*([^,\n]+)/i);
                        if (m && m[1]) it.price = m[1].trim();
                      }
                    }
                    if ((!it.location || it.location.trim() === '') && metaDesc) {
                      const lm = metaDesc.match(/Lokalita:\s*([^,\n]+)/i) || metaDesc.match(/Praha\s*\d*/i);
                      if (lm && lm[1]) it.location = lm[1].trim();
                      else if (lm && lm[0]) it.location = lm[0].trim();
                    }

                    // If still missing, try detail page selectors
                // Post-enrichment: repair suspicious price values (e.g. year-like "2025" or numbers < 10000)
                for (let i = 0; i < results.length; i++) {
                  const it = results[i];
                  try {
                    const priceRaw = String(it.price || '').trim();
                    const looksLikeYear = /^\d{4}$/.test(priceRaw);
                    const numericVal = Number(priceRaw.replace(/[^0-9]/g, '')) || 0;
                    const tooSmall = numericVal > 0 && numericVal < 10000;
                    if (priceRaw === '' || looksLikeYear || tooSmall) {
                      let replaced = false;
                      const r2 = await axios.get(it.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 10000 }).catch(() => null);
                      if (r2 && r2.data) {
                        const $2 = cheerio.load(r2.data);
                        // Prefer authoritative tbody layout: pick Lokalita row's 2nd <a> and Cena row's <b>
                        const metaDesc2 = ($2('meta[property="og:description"]').attr('content') || $2('meta[name="description"]').attr('content') || '').trim();
                        let newPrice = '';
                        try {
                          const tbodyLocRow2 = $2('tbody tr').filter((i: any, el: any) => { return ($2(el).find('td').first().text() || '').trim().startsWith('Lokalita'); }).first();
                          if (tbodyLocRow2 && tbodyLocRow2.length) {
                            const locTd2 = tbodyLocRow2.find('td').eq(2);
                            const anchors2 = locTd2.find('a');
                            if (anchors2 && anchors2.length >= 2) {
                              const detailLoc2 = $2(anchors2[1]).text().trim();
                              if (detailLoc2) it.location = detailLoc2.replace(/\s+/g, ' ').trim();
                            }
                          }
                        } catch (e) {
                          // ignore
                        }
                        // Prefer price from tbody 'Cena' row
                        try {
                          const tbodyPriceRow2 = $2('tbody tr').filter((i: any, el: any) => { return ($2(el).find('td').first().text() || '').trim().startsWith('Cena'); }).first();
                          if (tbodyPriceRow2 && tbodyPriceRow2.length) {
                            const pb2 = tbodyPriceRow2.find('b').first().text().trim();
                            if (pb2) newPrice = pb2.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                          }
                        } catch (e) {
                          // ignore
                        }
                        if (!newPrice && metaDesc2) newPrice = extractCurrency(metaDesc2) || '';
                        if (!newPrice) {
                          const p2 = $2('.inzeratydetdel b, .inzeratycena b, .inzeratydet .cena, .price').first().text().trim();
                          if (p2) newPrice = p2.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                        }
                        if (newPrice) {
                          // accept newPrice only if it contains explicit currency token or numeric value >= MIN_BARE_PRICE
                          const hasCurrencyToken = /Kč|Kc|CZK/i.test(newPrice);
                          const digitsNew = Number(String(newPrice).replace(/[^0-9]/g, '')) || 0;
                          const MIN_BARE_PRICE = 10000;
                          if (hasCurrencyToken || (digitsNew >= MIN_BARE_PRICE)) {
                            it.price = newPrice;
                            replaced = true;
                          }
                        }
                        // if we couldn't find a sane price, clear suspicious year-like or too-small value
                        if (!replaced && (looksLikeYear || tooSmall)) it.price = '';
                      }
                    }
                  } catch (e) {
                    // ignore per-item repair errors
                  }
                }
                    if (!it.price || it.price.trim() === '') {
                      const p = $('.inzeratydetdel b, .inzeratycena b, .inzeratydet .cena, .price').first().text().trim();
                      if (p) it.price = p.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                    }
                    if (!it.location || it.location.trim() === '') {
                      const l = $('.inzeratydet tr:contains("Lokalita"), .inzeratylok, .locality').first().text().trim();
                      if (l) it.location = l.replace(/\s+/g, ' ').trim();
                    }
                  }
                } catch (e) {
                  // ignore per-item fetch errors
                }
              }
            }
          }
        } catch (e) {
          // ignore enrichment errors
        }
        // If strictLocation is requested, fetch each ad detail page to get the authoritative 'Lokalita'
        // and drop any ad whose detail-page location does not match the requested location.
        if (strict) {
          try {
            const axios = await import('axios').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
            const cheerio = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
            if (axios && cheerio) {
              const wantNorm = String(location || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
              const keep: typeof results = [];
              for (const it of results) {
                try {
                  const r = await axios.get(it.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 10000 }).catch(() => null);
                  let detailLoc = '';
                  if (r && r.data) {
                    const $ = cheerio.load(r.data);
                    // try to extract postal code from the tbody Lokalita row first <a> (postal link)
                    try {
                      const tbodyLocRow = $('tbody tr').filter((i: number, el: any) => { return ($(el).find('td').first().text() || '').trim().startsWith('Lokalita'); }).first();
                      if (tbodyLocRow && tbodyLocRow.length) {
                        const locTd = tbodyLocRow.find('td').eq(2);
                        const anchors = locTd.find('a');
                        if (anchors && anchors.length >= 1) {
                          const postalText = $(anchors[0]).text().trim();
                          if (/^\d{3,}/.test(postalText)) {
                            it.postal = postalText.replace(/\s+/g, '').trim();
                          }
                        }
                        if ((!detailLoc || detailLoc === '') && anchors && anchors.length >= 2) {
                          const detailCity = $(anchors[1]).text().trim();
                          if (detailCity) detailLoc = detailCity;
                        }
                      }
                    } catch (e) {
                      // ignore
                    }
                    const metaDesc = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim();
                    if (metaDesc && !detailLoc) {
                      const lm = metaDesc.match(/Lokalita:\s*([^,\n]+)/i) || metaDesc.match(/([A-Za-zÁ-Žá-žěščřžůĚŠČŘŽŮ\s\-]+)\s*\d{3,}/i);
                      if (lm && lm[1]) detailLoc = lm[1].trim();
                    }
                    if (!detailLoc) {
                      // try known detail selectors
                      const l = $('.inzeratydet tr:contains("Lokalita"), .inzeratylok, .locality').first().text().trim();
                      if (l) {
                        // remove label if present
                        detailLoc = l.replace(/Lokalita[:\s\-]*/i, '').trim();
                      }
                    }
                  }
                        if (detailLoc) {
                          it.location = detailLoc;
                          const norm = String(detailLoc).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
                          // If user requested a postal code (PSČ), prefer matching against extracted postal codes
                          const wantPostalRaw = String(location || '').replace(/\s+/g, '');
                          const wantIsPostal = /^\d{3,}$/.test(wantPostalRaw);
                          if (wantIsPostal) {
                            // match when the detail page provided a postal code and it starts with the requested PSČ
                            if (it.postal && it.postal.replace(/\s+/g, '').startsWith(wantPostalRaw)) {
                              keep.push(it);
                            } else if (norm.includes(wantNorm)) {
                              // fallback to text match if postal wasn't available
                              keep.push(it);
                            } else {
                              // not matching strict locality -> drop
                            }
                          } else {
                            if (norm.includes(wantNorm)) {
                              keep.push(it);
                            } else {
                              // not matching strict locality -> drop
                            }
                          }
                  } else {
                    // if we couldn't determine location from detail page, drop the item under strict mode
                  }
                } catch (e) {
                  // on any error assume not matching and drop
                }
              }
              // replace results with strictly-matching set
              results.length = 0;
              results.push(...keep);
            }
          } catch (e) {
            console.error('[scraper] strict-location detail enrichment error', e && (e as any).message ? (e as any).message : e);
            // if error, fall through to later filtering (will likely reject)
          }
        }
  // If a desired location was specified, filter results by matching location/title/description text.
  // Behavior differs when strictLocation is requested: strict -> do not relax; relaxed -> fallback when too few.
        if (location) {
          const normalize = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
          const want = normalize(String(location));
          const before = results.length;
          const filtered = results.filter(r => {
            return normalize(r.location).includes(want) || normalize(r.title).includes(want) || normalize(String(r.description || '')).includes(want);
          });
          console.log('[scraper] filtering by location (title/loc/desc)', location, 'before=', before, 'after=', filtered.length);
          if (strict) {
            // strict locality requested: only accept filtered results (could be zero)
            if (filtered.length > 0) {
              results.length = 0;
              results.push(...filtered);
            } else {
              console.log('[scraper] strict locality requested and filtering removed all results; returning EMPTY set');
              results.length = 0;
            }
          } else {
            const MIN_ACCEPT = 5; // if fewer than this after filtering, prefer the unfiltered set
            if (filtered.length >= MIN_ACCEPT) {
              results.length = 0;
              results.push(...filtered);
            } else {
              console.log('[scraper] filtered results below MIN_ACCEPT; relaxing locality and returning unfiltered set');
              // keep results as-is (unfiltered)
            }
          }
        }
        await browser.close();
      } else {
        console.log('[scraper] browser not available, will fall back to mock');
      }
    }
  } catch (e: unknown) {
    const msg = e && (typeof e === 'object' ? ((e as any).message || String(e)) : String(e));
    console.error('[scraper] runtime error', msg);
  }

  if (results.length === 0) {
    console.log('[scraper] no items from puppeteer — trying HTML fallback');
    try {
      const axios = await import('axios').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
  const cheerio = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
      if (axios && cheerio) {
  const q = encodeURIComponent(keywords);
  // use same search endpoint as puppeteer and restrict by locality
  let htmlUrl = `https://www.bazos.cz/search.php?hledat=${q}`;
  if (location) htmlUrl += `&hlokalita=${encodeURIComponent(location)}`;
  console.log('[scraper] fetching HTML', htmlUrl);
  const res = await axios.get(htmlUrl).catch((e: any) => { console.error('[scraper] axios.get error', e && e.message); return null; });
        if (res && res.data) {
          const $ = cheerio.load(res.data);
          // Anchor-driven extraction: find anchors (title links), climb up to a reasonable container
          // and extract price/location/description. This mirrors the Puppeteer logic and is more
          // resilient across category layout variants.
      const found: any[] = [];
      // Only consider likely ad title links; avoid generic <a> that point to categories
      const anchors = $('h2.nadpis a, .inzeratynadpis a, .nadpis a').toArray();
          for (let i = 0; i < anchors.length && found.length < 20; i++) {
            try {
              const a = anchors[i];
              const $a = $(a);
              const title = ($a.text() || '').trim();
              let href = ($a.attr('href') || '').trim();
              if (!title || !href) continue;
              // resolve relative URLs
              try { href = new URL(href, htmlUrl).href; } catch { /* keep as-is */ }
        // only accept links that look like ad detail pages (contain '/inzerat/')
        if (!/\/inzerat\//i.test(href)) continue;

              // climb parents up to 6 levels to find price/location elements
              let container = $a.parent();
              let tries = 0;
              let priceText = '';
              let locText = '';
              let descText = '';
              while (container && tries < 6) {
                // search for known selectors
                const p = container.find('.inzeratycena, .cena, .price, .velkaCena, .inzerat-cena').first();
                const l = container.find('.inzeratylok, .mesto, .locality, .umisteni').first();
                const d = container.find('.popis, .description, .inzerat-popis').first();
                if (p && p.length) priceText = (p.text() || '').trim();
                if (l && l.length) locText = (l.text() || '').trim();
                if (d && d.length) descText = (d.text() || '').trim();
                if (priceText || locText || descText) break;
                const parent = container.parent();
                if (!parent || parent.length === 0) break;
                container = parent;
                tries++;
              }

              // fallback: if price still empty, try to regex a currency-like token from container text
              if (!priceText && container && container.length) {
                const allText = container.text() || '';
                const c = extractCurrency(allText);
                if (c) priceText = c;
              }

              // normalize price whitespace and nbsp
              const priceNorm = typeof priceText === 'string' ? String(priceText).replace(/\u00A0/g, ' ').replace(/&nbsp;|\s+/g, ' ').trim() : '';
              const locNorm = (locText || location || '').trim();
              const descNorm = (descText || '').trim();

              found.push({ title, price: priceNorm, location: locNorm, url: href, date: new Date().toISOString(), description: descNorm });
            } catch (err) {
              // ignore per-item errors
            }
          }
          if (found.length > 0) {
            console.log('[scraper] html fallback found', found.length);
            results.push(...found.slice(0, 20));
            // After HTML fallback, attempt to repair suspicious price tokens by fetching detail pages
            try {
              const axios = await import('axios').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
              const cheerio = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
              if (axios && cheerio) {
                for (let i = 0; i < results.length; i++) {
                  const it = results[i];
                  const priceRaw = String(it.price || '').trim();
                  const looksLikeYear = /^\d{4}$/.test(priceRaw);
                  const numericVal = Number(priceRaw.replace(/[^0-9]/g, '')) || 0;
                  const tooSmall = numericVal > 0 && numericVal < 10000;
                  if (priceRaw === '' || looksLikeYear || tooSmall) {
                    let replaced = false;
                    try {
                      const r3 = await axios.get(it.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 10000 }).catch(() => null);
                      if (r3 && r3.data) {
                        const $3 = cheerio.load(r3.data);
                        // prefer tbody 'Lokalita' 2nd anchor and tbody 'Cena' <b>
                        try {
                          const tbodyLocRow3 = $3('tbody tr').filter((i: any, el: any) => { return ($3(el).find('td').first().text() || '').trim().startsWith('Lokalita'); }).first();
                          if (tbodyLocRow3 && tbodyLocRow3.length) {
                            const locTd3 = tbodyLocRow3.find('td').eq(2);
                            const anchors3 = locTd3.find('a');
                            if (anchors3 && anchors3.length >= 2) {
                              const detailLoc3 = $3(anchors3[1]).text().trim();
                              if (detailLoc3) it.location = detailLoc3.replace(/\s+/g, ' ').trim();
                            }
                          }
                        } catch (e) {
                          // ignore
                        }
                        let newPrice = '';
                        try {
                          const tbodyPriceRow3 = $3('tbody tr').filter((i: any, el: any) => { return ($3(el).find('td').first().text() || '').trim().startsWith('Cena'); }).first();
                          if (tbodyPriceRow3 && tbodyPriceRow3.length) {
                            const pb3 = tbodyPriceRow3.find('b').first().text().trim();
                            if (pb3) newPrice = pb3.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                          }
                        } catch (e) {
                          // ignore
                        }
                        const metaDesc3 = ($3('meta[property="og:description"]').attr('content') || $3('meta[name="description"]').attr('content') || '').trim();
                        if (!newPrice && metaDesc3) newPrice = extractCurrency(metaDesc3) || '';
                        if (!newPrice) {
                          const p3 = $3('.inzeratydetdel b, .inzeratycena b, .inzeratydet .cena, .price').first().text().trim();
                          if (p3) newPrice = p3.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
                        }
                        if (newPrice) {
                          const hasCurrencyToken = /Kč|Kc|CZK/i.test(newPrice);
                          const digitsNew = Number(String(newPrice).replace(/[^0-9]/g, '')) || 0;
                          const MIN_BARE_PRICE = 10000;
                          if (hasCurrencyToken || (digitsNew >= MIN_BARE_PRICE)) {
                            it.price = newPrice;
                            replaced = true;
                          }
                        }
                        if (!replaced && (looksLikeYear || tooSmall)) it.price = '';
                      }
                    } catch (e) {
                      // ignore per-item fetch errors
                    }
                  }
                }
              }
            } catch (e) {
              // ignore
            }
          } else {
            console.log('[scraper] html fallback found nothing');
          }
        }
      }
    } catch (e: unknown) {
      const m = e && (typeof e === 'object' ? ((e as any).message || String(e)) : String(e));
      console.error('[scraper] html fallback error', m);
    }

    // apply same location filtering to HTML fallback results if needed
    if (location && results.length > 0) {
      const locLower = String(location).toLowerCase();
      const before = results.length;
      const filtered = results.filter(r => (r.location || '').toLowerCase().includes(locLower) || (r.title || '').toLowerCase().includes(locLower) || (String(r.description || '')).toLowerCase().includes(locLower));
      console.log('[scraper] post-html filtering by location', location, 'before=', before, 'after=', filtered.length);
      const MIN_ACCEPT = 5;
      if (filtered.length >= MIN_ACCEPT) {
        results.length = 0;
        results.push(...filtered);
      } else {
        console.log('[scraper] post-html filtered results below MIN_ACCEPT; relaxing locality and returning unfiltered set');
        // keep results as-is
      }
    }

    if (results.length === 0) {
      if (location) {
        console.log('[scraper] no results after applying location filter; returning empty set for strict locality search');
      } else {
        // keep legacy mock fallback for non-locality searches
        results.push({
          title: `Test item matching "${keywords}"`,
          price: priceMin ? `${priceMin} Kč` : '100 Kč',
          location: location || 'Praha',
          url: `https://example.com/mock/${encodeURIComponent(keywords)}-1`,
          date: new Date().toISOString(),
        });
        results.push({
          title: `Second test item ${keywords}`,
          price: priceMax ? `${priceMax} Kč` : '200 Kč',
          location: location || 'Brno',
          url: `https://example.com/mock/${encodeURIComponent(keywords)}-2`,
          date: new Date().toISOString(),
        });
      }
    }
  }

  // Final cleanup: avoid exposing year-like or too-small numeric tokens as prices
  try {
    const MIN_BARE_PRICE = 10000;
    for (const it of results) {
      try {
        const p = String(it.price || '').trim();
        if (!p) continue;
        const looksLikeYear = /^\d{4}$/.test(p);
        const digits = Number(String(p).replace(/[^0-9]/g, '')) || 0;
        const hasCurrency = /Kč|Kc|CZK/i.test(p);
        if ((!hasCurrency && looksLikeYear) || (!hasCurrency && digits > 0 && digits < MIN_BARE_PRICE)) {
          // clear ambiguous price
          it.price = '';
        }
      } catch (e) {
        // ignore per-item
      }
    }
  } catch (e) {
    // ignore final cleanup errors
  }

  return results;
}
