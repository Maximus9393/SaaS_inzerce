#!/usr/bin/env node
// Periodically run the index_meili.js script to keep Meili in sync.
const { spawn } = require('child_process');
const INTERVAL = Number(process.env.MEILI_SYNC_INTERVAL || 300) * 1000; // seconds -> ms
const MEILI_HOST = process.env.MEILI_HOST;

if (!MEILI_HOST) {
  console.log('[meili_sync_loop] MEILI_HOST not set; exiting');
  process.exit(0);
}

console.log('[meili_sync_loop] starting; interval (s):', INTERVAL / 1000);

function runIndexer() {
  return new Promise((resolve) => {
    console.log('[meili_sync_loop] running indexer');
    const env = Object.assign({}, process.env);
    const p = spawn('node', ['scripts/index_meili.js'], { env, stdio: 'inherit' });
    p.on('close', (code) => { console.log('[meili_sync_loop] indexer exited with code', code); resolve(code); });
    p.on('error', (err) => { console.error('[meili_sync_loop] indexer spawn error', err); resolve(1); });
  });
}

(async () => {
  try { await runIndexer(); } catch (e) { console.error('[meili_sync_loop] startup indexer failed', e); }
  setInterval(() => { runIndexer().catch(e => console.error('[meili_sync_loop] periodic indexer failed', e)); }, INTERVAL);
})();
