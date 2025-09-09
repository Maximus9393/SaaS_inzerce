#!/usr/bin/env node
// Minimal Meili indexer: reads listings from Prisma and indexes into Meili
const { PrismaClient } = require('@prisma/client');
const { MeiliSearch } = require('meilisearch');

async function main() {
  const prisma = new PrismaClient();
  try {
    const MEILI_HOST = process.env.MEILI_HOST;
    const MEILI_KEY = process.env.MEILI_KEY || '';
    if (!MEILI_HOST) {
      console.error('MEILI_HOST is not set. Aborting.');
      process.exit(2);
    }
    const client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
    const INDEX_NAME = process.env.MEILI_INDEX || 'listings';
    // ensure index
    try { await client.getIndex(INDEX_NAME); } catch (e) { await client.createIndex(INDEX_NAME, { primaryKey: 'id' }); }

    // fetch listings
    const rows = await prisma.listing.findMany();
    if (!rows || rows.length === 0) {
      console.log('No listings found to index.');
      return;
    }

    // Map rows to simple objects Meili can index
    const docs = rows.map(r => ({ id: r.id, title: r.title || '', description: r.description || '', price: r.price || 0, location: r.location || '', url: r.url || '', postal: r.postal || '' }));
    const index = client.index(INDEX_NAME);
    const task = await index.addDocuments(docs);
    console.log('Indexing enqueued:', task);
  } catch (e) {
    console.error('indexing error', e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

main();
