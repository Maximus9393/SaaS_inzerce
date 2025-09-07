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
  return upserted;
}

export async function findRecent(limit = 20) {
  if (!prisma) return [];
  return prisma.listing.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}
