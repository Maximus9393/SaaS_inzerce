#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');

const host = process.env.BASE_URL || 'http://localhost:4000';
const cities = ['Praha','Brno','Ostrava','Plzeň','Liberec','Olomouc','Hradec Králové','Pardubice','Zlín','České Budějovice'];
const queries = ['octavia 1.9 tdi','bmw 320d','audi a3','peugeot 206','citroen c3'];
const limit = 20;

(async () => {
  const results = [];
  for (const city of cities) {
    for (const q of queries) {
      const payload = { keywords: q, location: city, sort: 'distance', order: 'asc', originPostal: '10000', limit };
      try {
        const r = await axios.post(host + '/api/search', payload, { timeout: 20000 });
        const data = r.data;
        const items = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        const stats = {
          city, query: q, count: items.length,
          thumbs: items.filter(it => it.thumbnail || (it.images && it.images.length)).length,
          withDesc: items.filter(it => it.description && String(it.description).trim().length>20).length,
          withPostal: items.filter(it => it.postal).length,
          withCoords: items.filter(it => (it.lat!==undefined && it.lon!==undefined) || (it.distance!==undefined)).length,
          avgDescLen: items.reduce((s,it)=>s + ((it.description||'').length),0) / (items.length||1),
          avgDistance: items.filter(it=>typeof it.distance==='number').reduce((s,it)=>s + Number(it.distance),0) / Math.max(1, items.filter(it=>typeof it.distance==='number').length),
          sample: items.slice(0,3).map(it=>({title: it.title, location: it.location, postal: it.postal, distance: it.distance || null, thumb: !!(it.thumbnail|| (it.images && it.images.length)) }))
        };
        console.log('OK', city, q, 'count=', stats.count);
        results.push(stats);
      } catch (e) {
        console.error('ERR', city, q, e && e.message);
        results.push({ city, query: q, error: String(e && e.message) });
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
  const out = { runAt: new Date().toISOString(), results };
  fs.writeFileSync('search_matrix_result.json', JSON.stringify(out, null, 2));
  console.log('Wrote search_matrix_result.json');
})();
