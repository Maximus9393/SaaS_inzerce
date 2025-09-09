import { drainBatch, peekCount } from '../utils/persistQueue';
import { upsertListing } from '../services/listingService';

const POLL_INTERVAL = Number(process.env.PERSIST_POLL_MS || 2000);
const BATCH_SIZE = Number(process.env.PERSIST_BATCH_SIZE || 50);

async function processBatch() {
  const batch = drainBatch(BATCH_SIZE);
  if (!batch || batch.length === 0) return 0;
  for (const item of batch) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        await upsertListing(item as any);
        break;
      } catch (e) {
        attempts++;
        const wait = 200 * Math.pow(2, attempts);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  return batch.length;
}

async function loop() {
  while (true) {
    try {
      const count = peekCount();
      if (count === 0) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }
      await processBatch();
    } catch (e) {
      // if the worker errors, wait a bit and continue
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  }
}

if (require.main === module) {
  console.log('[persistWorker] starting');
  loop().catch(e => { console.error('[persistWorker] fatal', e); process.exit(1); });
}

export default { loop };
