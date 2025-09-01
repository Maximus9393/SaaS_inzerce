import prisma from '../models/prismaClient';
// Use a loose type here to avoid tight coupling to generated types during bootstrap
export async function saveListing(data: { title: string; price: number; location?: string; source: string; url: string; thumbnail?: string }): Promise<any | null> {
  try {
    if (!prisma) return null;
  const created = await prisma.listing.create({ data: {
      title: data.title,
      price: data.price,
      location: data.location || null,
      source: data.source,
      url: data.url,
      thumbnail: data.thumbnail || null,
    } });
  return created;
  } catch (e: any) {
    // ignore unique constraint errors for idempotency
    if (e && e.code === 'P2002') return null;
    throw e;
  }
}

export async function findRecent(limit = 20) {
  if (!prisma) return [];
  return prisma.listing.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}
