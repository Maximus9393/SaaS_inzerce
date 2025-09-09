const axios = require('axios');

const cities = ['Praha','Brno','Ostrava','Plzeň','Olomouc','Liberec','Ústí nad Labem','Hradec Králové','Pardubice','Zlín'];
const queries = ['octavia 1.9 tdi','bmw 320d','audi a3','peugeot','citroen c3'];

async function run() {
  const base = process.env.API_BASE || 'http://localhost:3000';
  for (const city of cities) {
    for (const q of queries) {
      try {
        const res = await axios.post(base + '/api/search', { keywords: q, location: city, pageSize: 5 }, { timeout: 20000 });
        const items = (res.data && res.data.results) || [];
        console.log('---', city, '|', q, '| results=', items.length);
        for (let i=0;i<Math.min(items.length,3);i++) {
          const it = items[i];
          console.log(`#${i+1}`, it.title ? it.title.slice(0,120) : '<no-title>', '| price=', it.price || '', '| location=', it.location || '', '| thumb=', Boolean(it.thumbnail || (it.images && it.images[0])), '| descLen=', (it.description ? String(it.description).length : 0));
        }
      } catch (err) {
        console.error('ERR', city, q, err.message);
      }
    }
  }
}

run().catch(e=>{console.error(e); process.exit(1);});
