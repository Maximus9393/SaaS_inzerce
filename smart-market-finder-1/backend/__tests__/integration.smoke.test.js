const axios = require('axios');

// require compiled server app (CommonJS interop)
const serverModule = require('../dist/server');
const app = serverModule && serverModule.default ? serverModule.default : serverModule;

// shorter overall timeout for smoke test
jest.setTimeout(15 * 60 * 1000);

describe('smoke integration: frontend + /api/search (PR-friendly)', () => {
  let server;
  let baseUrl;

  beforeAll((done) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      setTimeout(done, 200);
    });
  });

  afterAll((done) => {
    try { server.close(done); } catch (e) { done(); }
  });

  test('serves frontend root (GET /)', async () => {
    const res = await axios.get(baseUrl + '/', { timeout: 20000 });
    expect(res.status).toBe(200);
  });

  const cities = ['Praha', 'Brno', 'Ostrava'];
  const queries = ['octavia 1.9 tdi', 'bmw 320d'];

  for (const city of cities) {
    for (const q of queries) {
      test(`${city} - ${q}`, async () => {
        const res = await axios.post(baseUrl + '/api/search', { location: city, keywords: q, limit: 5 }, { timeout: 120000 });
        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('results');
        expect(Array.isArray(res.data.results)).toBe(true);
      });
    }
  }
});
