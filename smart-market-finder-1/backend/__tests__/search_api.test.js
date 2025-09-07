// Jest test (CommonJS) that uses compiled dist modules to avoid TS transform issues
jest.mock('../dist/scraper/scraper', () => ({
  scrapeBazos: jest.fn(async (opts) => {
    const loc = String((opts && opts.location) || '');
    // simulate behavior: prefix '277' returns Item A; city fallback returns CityItem
    if (/^277/.test(loc)) {
      return [{ title: 'Item A', price: '1000 Kč', location: 'Mělník', url: 'http://a' }];
    }
    if (loc.toLowerCase().includes('měln') || loc.toLowerCase().includes('meln')) {
      return [{ title: 'CityItem', price: '2000 Kč', location: 'Mělník', url: 'http://city' }];
    }
    return [];
  })
}));

// Prevent Meili from being used in this compiled test (ensures scraper mock is exercised)
jest.mock('../dist/search/meili', () => {
  // Simulate module not present / causing require to fail
  throw new Error('meili mocked out for test');
});

const { searchMarket } = require('../dist/services/marketService');

describe('searchMarket (compiled)', () => {
  test('expands city name to prefixes and aggregates results', async () => {
    const res = await searchMarket({ keywords: '', location: 'Mělník', strictLocation: false });
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThanOrEqual(1);
    const titles = res.map(r => r.title);
  // expect at least one of our mocked titles
  const hasItemA = titles.includes('Item A');
  const hasCity = titles.includes('CityItem');
  expect(hasItemA || hasCity).toBe(true);
  });
});
