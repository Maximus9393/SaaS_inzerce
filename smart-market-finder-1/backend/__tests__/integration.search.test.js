const axios = require('axios');

// require compiled server app (CommonJS interop)
const serverModule = require('../dist/server');
const app = serverModule && serverModule.default ? serverModule.default : serverModule;

// allow much longer for crawling/scraping (tests perform live scraping)
jest.setTimeout(60 * 60 * 1000); // 60 minutes

// Only run the full matrix in NIGHTLY runs. For PRs/normal CI, set NIGHTLY=true to enable.
if (process.env.NIGHTLY !== 'true') {
  console.log('Skipping full integration matrix (set NIGHTLY=true to run).');
  // Register a skipped test so Jest treats this file as present but skipped in normal runs
  describe.skip('nightly integration matrix (skipped)', () => {
    test('nightly disabled', () => {});
  });
} else {

// small helpers: sleep and post with retry/backoff to reduce 429s
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function postWithRetry(url, payload, opts = {}) {
  const maxAttempts = opts.maxAttempts || 4;
  const baseDelay = opts.baseDelay || 3000; // ms
  const timeout = opts.timeout || 180000; // 3 minutes per attempt

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await axios.post(url, payload, { timeout });
      return res;
    } catch (err) {
      const status = err && err.response && err.response.status;
      const isRetryable = !err.response || status === 429 || err.code === 'ECONNABORTED' || err.code === 'ECONNRESET';
      if (!isRetryable || attempt === maxAttempts) throw err;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      // jitter
      const jitter = Math.floor(Math.random() * 1000);
      await sleep(delay + jitter);
    }
  }
}

describe('integration: frontend + /api/search', () => {
  let server;
  let baseUrl;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      // small delay so that server is fully ready
      setTimeout(done, 200);
    });
  });

  afterAll((done) => {
    try {
      server.close(done);
    } catch (e) {
      done();
    }
  });

  test('serves frontend root (GET /)', async () => {
    const res = await axios.get(baseUrl + '/', { timeout: 60000 });
    expect(res.status).toBe(200);
    expect(typeof res.data).toBe('string');
    expect(res.headers['content-type']).toMatch(/html/);
  });

  const cities = [
    'Praha',
    'Brno',
    'Ostrava',
    'Plzeň',
    'Liberec',
    'Olomouc',
    'Ústí nad Labem',
    'Hradec Králové',
    'Pardubice',
    'České Budějovice'
  ];

  const queries = [
    'octavia 1.9 tdi',
    'bmw 320d',
    'audi a3',
    'peugeot',
    'citroen c3'
  ];

  // run a test for each city+query combination
  cities.forEach((city) => {
    queries.forEach((q) => {
      test(`${city} - ${q}`, async () => {
        const payload = { location: city, keywords: q, limit: 10 };
        await sleep(500);
        const res = await postWithRetry(baseUrl + '/api/search', payload, { maxAttempts: 4, baseDelay: 4000, timeout: 180000 });
        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('results');
        expect(Array.isArray(res.data.results)).toBe(true);
        expect(res.data).toHaveProperty('count');
        expect(typeof res.data.count).toBe('number');

        // If there are any results, ensure they contain at least a title or url
        if (res.data.results.length > 0) {
          const hasUseful = res.data.results.some((r) => r && (r.title || r.url));
          expect(hasUseful).toBe(true);
        }
      });
    });
  });

  // Komplexní relevance test for one city/query
  test('relevance: Praha - octavia 1.9 tdi', async () => {
    const payload = { location: 'Praha', keywords: 'octavia 1.9 tdi', limit: 10, sort: 'distance', order: 'asc' };
    const res = await postWithRetry(baseUrl + '/api/search', payload, { maxAttempts: 4, baseDelay: 4000, timeout: 180000 });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('results');
    const results = res.data.results;
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Check that top results are relevant: title/desc contains keywords
    const keywords = ['octavia', 'tdi', '1.9'];
    const top = results.slice(0, 5);
    top.forEach(r => {
      const text = ((r.title || '') + ' ' + (r.description || '')).toLowerCase();
      const matches = keywords.filter(k => text.includes(k));
      expect(matches.length).toBeGreaterThanOrEqual(2); // at least 2 keywords present
      expect(r.price).toBeGreaterThan(10000); // realistic price
      expect(r.location).toMatch(/praha/i);
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.images).toBeDefined();
      expect(r.thumbnail || r.images.length > 0).toBeTruthy();
      expect(typeof r.distance === 'number').toBe(true);
      expect(r.distance).toBeLessThan(100); // should be within 100km
    });

    // Check sorting by distance (ascending)
    for (let i = 1; i < top.length; ++i) {
      expect(top[i].distance).toBeGreaterThanOrEqual(top[i-1].distance);
    }

    // Check that irrelevant results (missing keywords, far away) are not present in top 5
    const irrelevant = results.filter(r => {
      const text = ((r.title || '') + ' ' + (r.description || '')).toLowerCase();
      return !keywords.some(k => text.includes(k)) || (r.distance && r.distance > 200);
    });
    expect(irrelevant.length).toBeLessThan(results.length / 2);
  });
});

}
