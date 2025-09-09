import { MeiliSearch } from 'meilisearch';

const MEILI_HOST = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
const MEILI_KEY = process.env.MEILI_KEY || '';

const client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
const INDEX = process.env.MEILI_INDEX || 'listings';

export async function ensureIndex() {
  try {
    // ensure index exists; return the index instance
    try { await client.getIndex(INDEX); } catch (e) { await client.createIndex(INDEX, { primaryKey: 'id' }); }
    return client.index(INDEX);
  } catch (e) {
    throw e;
  }
}

export async function indexItems(items: any[]) {
  await ensureIndex();
  return client.index(INDEX).addDocuments(items);
}

export default { ensureIndex, indexItems };
