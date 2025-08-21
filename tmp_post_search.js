const http = require('http');
const data = JSON.stringify({keywords:'kolo', location:'Praha', portal:'bazos', filterMethod:'relevance'});
const opts = { hostname: '127.0.0.1', port: 3000, path: '/api/search', method: 'POST', headers: { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(data) } };
const req = http.request(opts, res => { let body=''; res.on('data', c=>body+=c); res.on('end', ()=>{ console.log('STATUS', res.statusCode); try{ console.log(JSON.parse(body)); }catch(e){ console.log(body); } process.exit(0); }); });
req.on('error', e=>{ console.error('ERR', e.message); process.exit(2); });
req.write(data); req.end();
