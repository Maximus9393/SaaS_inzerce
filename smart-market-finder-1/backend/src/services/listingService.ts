import prisma from '../models/prismaClient';
// Use a loose type here to avoid tight coupling to generated types during bootstrap
export async function saveListing(data: { title: string; price: number; location?: string; source: string; url: string; thumbnail?: string; images?: string[]; description?: string; postal?: string; lat?: number; lon?: number }): Promise<any | null> {
  // delegate to upsert which will create or update existing record
  return upsertListing(data as any).catch((e) => { if (e && (e as any).code === 'P2002') return null; throw e; });
}

export async function upsertListing(listing: { title?: string; price?: number | null; location?: string | null; source?: string; url: string; thumbnail?: string | null; images?: any[] | null; description?: string | null; postal?: string | null; lat?: number | null; lon?: number | null }) {
  if (!prisma) throw new Error('Prisma client not available');
  if (!listing || !listing.url) throw new Error('listing.url is required');
  const data = {
    title: listing.title || '',
    price: listing.price ?? null,
    location: listing.location || null,
    description: listing.description || null,
    postal: listing.postal || null,
    lat: listing.lat ?? null,
    lon: listing.lon ?? null,
    source: listing.source || 'unknown',
    thumbnail: listing.thumbnail || null,
    images: listing.images && listing.images.length ? listing.images : null,
  }
  // Use upsert to be idempotent and allow incremental enrichment
  const upserted = await prisma.listing.upsert({
    where: { url: listing.url },
    create: { url: listing.url, ...data },
    update: { ...data },
  });

  // Best-effort: push single document to Meili for near-real-time searchability
  try {
    if (process.env.MEILI_HOST && process.env.MEILI_KEY) {
      // small runtime fetch to Meili to add/update single doc
      const host = String(process.env.MEILI_HOST).replace(/\/$/, '');
      const key = String(process.env.MEILI_KEY);
      const doc = {
        id: upserted.id,
        title: upserted.title,
        description: upserted.description || '',
        price: upserted.price || 0,
        city: upserted.location || '',
        postal: upserted.postal || null,
        url: upserted.url,
        images: upserted.images || (upserted.thumbnail ? [upserted.thumbnail] : []),
        pubDate: upserted.createdAt ? new Date(upserted.createdAt).toISOString() : new Date().toISOString(),
      };
      // Use global fetch (Node >=18) — if not present, skip Meili push
      const fetchImpl = (globalThis as any).fetch;
      const docsUrl = host + '/indexes/listings/documents';
      let resp: any = null;
      if (typeof fetchImpl === 'function') {
        try { resp = await fetchImpl(docsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Meili-API-Key': key }, body: JSON.stringify([doc]) }); } catch (err) { resp = null; }
      }
      if (!resp || !resp.ok) {
        // try create index then retry
        try {
          const createIdx = await fetch(host + '/indexes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Meili-API-Key': key }, body: JSON.stringify({ uid: 'listings', primaryKey: 'id' }) }).catch(() => null);
          if (!createIdx || !(createIdx.ok || createIdx.status === 409)) {
            // ignore
          } else {
            resp = await fetch(docsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Meili-API-Key': key }, body: JSON.stringify([doc]) }).catch(() => null);
          }
        } catch (e) {
          // ignore
        }
      }
      if (resp && resp.ok) {
        // best-effort log
        try { console.info('[listingService] meili upsert ok for id=', upserted.id); } catch (e) { }
      }
    }
  } catch (e) {
    try { console.warn('[listingService] meili push failed', (e && (e as any).message) || e); } catch {}
  }

  return upserted;
}

export async function findRecent(limit = 20) {
  if (!prisma) return [];
  return prisma.listing.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}

export async function searchSaved(keywords?: string | null, location?: string | null, limit = 20) {
  if (!prisma) return [];
  const where: any = {};
  const and: any[] = [];
  if (keywords && keywords.trim().length) {
    const q = String(keywords).trim();
    and.push({ OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] });
  }
  if (location && String(location).trim().length) {
    const loc = String(location).trim();
    and.push({ location: { contains: loc, mode: 'insensitive' } });
  }
  if (and.length) where.AND = and;
  try {
    return await prisma.listing.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
  } catch (e) {
    // fallback to recent if query fails
    try { return await findRecent(limit); } catch (ee) { return []; }
  }
}

export async function findByUrl(url: string) {
  if (!prisma) return null;
  if (!url) return null;
  return prisma.listing.findUnique({ where: { url } as any });
}

export async function findById(id: number) {
  if (!prisma) return null;
  if (!id) return null;
  return prisma.listing.findUnique({ where: { id } as any });
}
