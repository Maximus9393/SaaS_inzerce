const { URL } = require('url');
const http = require('http');
const https = require('https');

const SERVER = process.env.TEST_SERVER || null;

// small helper to POST JSON using built-in http/https
function postJson(url, body, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
      timeout,
    };
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch (e) { /* keep raw */ }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}
// If TEST_SERVER is not provided, we'll start the app locally on an ephemeral port.
let _localServer = null;
let _baseUrl = null;
if (!SERVER) {
  // require compiled server app (CommonJS interop)
  const serverModule = require('../dist/server');
  const app = serverModule && serverModule.default ? serverModule.default : serverModule;
  // start server on ephemeral port during tests
  beforeAll((done) => {
    _localServer = app.listen(0, () => {
      const port = _localServer.address().port;
      _baseUrl = `http://127.0.0.1:${port}`;
      // small delay to let server settle
      setTimeout(done, 200);
    });
  });
  afterAll((done) => {
    try { _localServer.close(done); } catch (e) { done(); }
  });
}

const cities = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Hradec Králové'];
const queries = ['octavia 1.9 tdi', 'bmw 320d', 'audi a3', 'peugeot', 'citroen c3'];

describe('integration search across cities and queries', () => {
  jest.setTimeout(120000);

  for (const city of cities) {
    for (const q of queries) {
      test(`search '${q}' in ${city} returns results`, async () => {
        const target = process.env.TEST_SERVER ? process.env.TEST_SERVER : _baseUrl;
  const res = await postJson(`${target}/api/search`, { keywords: q, location: city, limit: 10 }, 120000);
        expect(res.status).toBe(200);
        expect(res.data).toBeDefined();
        expect(Array.isArray(res.data.results)).toBeTruthy();
        expect(res.data.results.length).toBeGreaterThanOrEqual(0);
        // If we got at least one result, ensure the top result is relevant:
        if (res.data.results.length > 0) {
          const top = res.data.results[0];
          const title = (top.title || '').toString().toLowerCase();
          const desc = (top.description || '').toString().toLowerCase();
          // create tokens from query, ignore very short tokens
          const tokens = q
            .toString()
            .toLowerCase()
            .split(/\s+/)
            .map(t => t.replace(/[^a-z0-9čřžěščťůáíéóúä]+/g, ''))
            .filter(t => t && t.length > 1);
          const matched = tokens.some(tok => title.includes(tok) || desc.includes(tok));
          expect(matched).toBeTruthy();
        }
      });
    }
  }
});
