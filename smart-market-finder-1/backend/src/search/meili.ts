import { MeiliSearch } from 'meilisearch';

const MEILI_HOST = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
const MEILI_KEY = process.env.MEILI_KEY || '';

const client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
const INDEX = 'rss_items';

export async function ensureIndex() {
  try {
    const idx = await client.getIndex(INDEX);
    return idx;
  } catch (e) {
    return client.createIndex(INDEX, { primaryKey: 'id' });
  }
}

export async function indexItems(items: any[]) {
  await ensureIndex();
  return client.index(INDEX).addDocuments(items);
}

export default { ensureIndex, indexItems };
