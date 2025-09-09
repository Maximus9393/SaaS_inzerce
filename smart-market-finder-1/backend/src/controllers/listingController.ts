import { Request, Response } from 'express';
import axios from 'axios';
// dynamic cheerio import used below
import { saveListing, findRecent } from '../services/listingService';

export async function createListing(req: Request, res: Response) {
  try {
    const { title, price, location, source, url, thumbnail } = req.body || {};
    const created = await saveListing({ title, price: Number(price) || 0, location, source: source || 'unknown', url, thumbnail });
    if (!created) return res.status(409).json({ error: 'already exists or not saved' });
    return res.json(created);
  } catch (e: any) {
    return res.status(500).json({ error: e && e.message ? e.message : 'error' });
  }
}

export async function listRecent(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit || 20) || 20;
    const rows = await findRecent(limit);
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ error: e && e.message ? e.message : 'error' });
  }
}

// New: return raw DB listings (paginated) for verification/debugging.
export async function listFromDb(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit || 50) || 50;
    // reuse findRecent which queries Prisma
    const rows = await findRecent(limit);
    return res.json({ ok: true, count: Array.isArray(rows) ? rows.length : 0, results: rows });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : 'error' });
  }
}

export async function getListing(req: Request, res: Response) {
  try {
    const { url, id } = req.query as any;
    if (!url && !id) return res.status(400).json({ ok: false, error: 'url or id required' });
    const { findByUrl, findById } = await import('../services/listingService');
    if (url) {
      const u = String(url);
      let row = await findByUrl(u);
      if (!row) {
        // Attempt on-demand scrape when enabled (guarded by env var)
        const allow = String(process.env.ALLOW_ONDEMAND_SCRAPE || '').toLowerCase() === 'true';
        if (!allow) return res.status(404).json({ ok: false, error: 'not found' });
        try {
          // fetch and parse page
          const resp = await axios.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 15000 }).catch(() => null);
          if (resp && resp.data) {
            const cheerioMod = await import('cheerio').then(m => (m && (m as any).default) ? (m as any).default : m).catch(() => null);
            if (cheerioMod) {
              const $ = cheerioMod.load(String(resp.data));
              const title = ($('meta[property="og:title"]').attr('content') || $('title').text() || '').trim();
              const descriptionHtml = ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('.description').first().html() || $('.popis').first().html() || '').toString();
              // images
              const images: string[] = [];
              const ogImg = ($('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content') || '').trim();
              if (ogImg) images.push(ogImg);
              try {
                const ld = $('script[type="application/ld+json"]').toArray();
                for (const s of ld) {
                  try {
                    const txt = $(s).text(); if (!txt) continue; const j = JSON.parse(txt); const obj = Array.isArray(j) ? j[0] : j;
                    if (obj && obj.image) {
                      if (typeof obj.image === 'string') images.push(obj.image);
                      else if (Array.isArray(obj.image)) images.push(...obj.image);
                    }
                  } catch (e) { /* ignore per-script */ }
                }
              } catch (e) {}
              // <img> tags
              try { $('img').toArray().slice(0, 12).forEach((el: any) => { const src = $(el).attr('src') || $(el).attr('data-src') || ''; if (src) images.push(src); }); } catch (e) {}
              const uniqImages = Array.from(new Set(images)).map((s: string) => { try { return new URL(s, u).href; } catch { return s; } });

              // price extraction (simple): look for meta price or itemprop
              let priceNum: number | null = null;
              try {
                const metaPrice = ($('meta[itemprop="price"]').attr('content') || $('meta[property="product:price:amount"]').attr('content') || '').trim();
                if (metaPrice) { const digits = Number(String(metaPrice).replace(/[^0-9.]/g, '')); if (!isNaN(digits)) priceNum = digits; }
              } catch (e) {}

              // location/postal/coords
              let location = '';
              let postal: any = null;
              let lat: any = null; let lon: any = null;
              try {
                const loc = $('.locality, .region, .town, .ad-location, .inzeratylok').first().text() || '';
                if (loc) location = loc.trim();
                // postal regex (cz)
                const m = String(resp.data).match(/\b(\d{3}\s?\d{2})\b/);
                if (m && m[1]) postal = m[1].replace(/\s+/g, '');
                const metaGeo = ($('meta[name="geo.position"]').attr('content') || $('meta[name="ICBM"]').attr('content') || '') as string;
                if (metaGeo && /[0-9\.\-]+[ ,]+[0-9\.\-]+/.test(metaGeo)) { const parts = metaGeo.split(/[ ,]+/).map(s => Number(String(s).replace(',', '.'))); if (!isNaN(parts[0]) && !isNaN(parts[1])) { lat = parts[0]; lon = parts[1]; } }
              } catch (e) {}

              const parsed = {
                title: title || '',
                price: priceNum || 0,
                location: location || '',
                source: new URL(u).hostname.replace(/^www\./, ''),
                url: u,
                thumbnail: uniqImages.length ? uniqImages[0] : null,
                images: uniqImages.length ? uniqImages : null,
                description: descriptionHtml || '',
                postal: postal || null,
                lat: lat || null,
                lon: lon || null,
              } as any;

              // save via service
              try {
                await saveListing({ title: parsed.title || 'Inzerát', price: Number(parsed.price) || 0, location: parsed.location || '', source: parsed.source || 'tipcars', url: parsed.url, thumbnail: parsed.thumbnail || undefined, images: parsed.images || undefined, description: parsed.description || undefined, postal: parsed.postal || undefined, lat: parsed.lat || undefined, lon: parsed.lon || undefined });
                // re-query
                row = await findByUrl(u);
              } catch (e) { /* ignore save errors */ }
            }
          }
        } catch (e) {
          // swallow fetch errors and return not found
        }
      }
      if (!row) return res.status(404).json({ ok: false, error: 'not found' });
      return res.json({ ok: true, result: row });
    }
    if (id) {
      const row = await findById(Number(id));
      if (!row) return res.status(404).json({ ok: false, error: 'not found' });
      return res.json({ ok: true, result: row });
    }
    return res.status(400).json({ ok: false, error: 'invalid request' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : 'error' });
  }
}
