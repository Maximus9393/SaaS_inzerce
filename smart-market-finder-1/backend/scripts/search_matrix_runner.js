#!/usr/bin/env node
const axios = require('axios');
const fs = require('fs');

const host = process.env.BASE_URL || 'http://localhost:3000';
const cities = ['Praha','Brno','Ostrava','Plzeň','Liberec','Olomouc','Hradec Králové','Pardubice','Zlín','České Budějovice'];
const queries = ['octavia 1.9 tdi','bmw 320d','audi a3','peugeot 206','citroen c3'];
const limit = 10;

(async () => {
  const results = [];
  async function postWithRetry(url, payload, opts = {}) {
    const attempts = opts.attempts || 3;
    const baseDelay = opts.baseDelay || 800;
    let lastErr = null;
    for (let a = 1; a <= attempts; a++) {
      try {
        return await axios.post(url, payload, { timeout: opts.timeout || 30000 });
      } catch (e) {
        lastErr = e;
        // exponential backoff
        const delay = baseDelay * Math.pow(2, a - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  for (const city of cities) {
    for (const q of queries) {
  const payload = { keywords: q, location: city, sort: 'distance', order: 'asc', originPostal: '10000', limit, fast: true };
      try {
        const r = await postWithRetry(host + '/api/search', payload, { attempts: 2, baseDelay: 1000, timeout: 120000 });
        const data = r.data;
        const items = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        const stats = {
          city, query: q, count: items.length,
          thumbs: items.filter(it => it.thumbnail || (it.images && it.images.length)).length,
          withDesc: items.filter(it => it.description && String(it.description).trim().length>20).length,
          withPostal: items.filter(it => it.postal).length,
          withCoords: items.filter(it => ((it.lat!==undefined && it.lon!==undefined) || (it.distance!==undefined))).length,
          avgDescLen: Math.round(items.reduce((s,it)=>s + ((it.description||'').length),0) / (items.length||1)),
          avgDistance: (() => {
            const arr = items.filter(it=>typeof it.distance==='number').map(it=>Number(it.distance));
            if (arr.length===0) return null; return Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*10)/10;
          })(),
          sample: items.slice(0,3).map(it=>({title: it.title, location: it.location, postal: it.postal, distance: it.distance || null, thumb: !!(it.thumbnail|| (it.images && it.images.length)) }))
        };
        console.log('OK', city, q, 'count=', stats.count);
        results.push(stats);
      } catch (e) {
        // serialize AggregateError well
        let msg = '';
        try {
          if (e && typeof e === 'object') {
            if (e.response && e.response.data) msg = JSON.stringify(e.response.data);
            else if (e.name === 'AggregateError' && Array.isArray(e.errors)) msg = 'AggregateError: ' + JSON.stringify(e.errors.map(err => (err && err.message) ? err.message : String(err)));
            else if (e.message) msg = e.message;
            else msg = String(e);
            if (e.stack) msg += '\nSTACK:' + e.stack.split('\n').slice(0,4).join('\n');
          } else msg = String(e);
        } catch (se) { msg = String(e); }
        console.error('ERR', city, q, msg);
        results.push({ city, query: q, error: String(msg) });
      }
      // gentle pacing to avoid bursting the server
      await new Promise(r=>setTimeout(r, 800));
    }
  }
  const out = { runAt: new Date().toISOString(), results };
  const outPath = require('path').join(__dirname, '..', 'search_matrix_result.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('Wrote', outPath);
})();
