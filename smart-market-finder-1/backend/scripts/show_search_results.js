#!/usr/bin/env node
const axios = require('axios');

// usage: node scripts/show_search_results.js [CITY] [QUERY] [LIMIT]
const city = process.argv[2] || 'Praha';
const query = process.argv[3] || 'octavia 1.9 tdi';
const limit = Number(process.argv[4] || 10);

async function main() {
  // require compiled server app (CommonJS interop)
  const serverModule = require('../dist/server');
  const app = serverModule && serverModule.default ? serverModule.default : serverModule;

  const server = app.listen(0, async () => {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`server listening on ${baseUrl} — querying for "${query}" in ${city} (limit=${limit})`);

    try {
      const res = await axios.post(baseUrl + '/api/search', { location: city, keywords: query, limit }, { timeout: 180000 });
      if (res && res.data && Array.isArray(res.data.results)) {
        const items = res.data.results;
        console.log(`\nFound ${items.length} items (count=${res.data.count})\n`);
        items.forEach((it, i) => {
          console.log(`${i + 1}. ${it.title || '<no title>'}`);
          if (it.price) console.log(`   price: ${it.price}`);
          if (it.location) console.log(`   location: ${it.location}`);
          if (it.postal) console.log(`   postal: ${it.postal}`);
          if (it.url) console.log(`   url: ${it.url}`);
          if (it.description) console.log(`   desc: ${String(it.description).slice(0, 160)}`);
          console.log('');
        });
      } else {
        console.log('No results or unexpected response shape:', res.data);
      }
    } catch (err) {
      console.error('Error querying /api/search', err && (err.response ? err.response.status : err.code || err.message));
      if (err && err.response && err.response.data) console.error(err.response.data);
    } finally {
      server.close(() => process.exit(0));
    }
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
