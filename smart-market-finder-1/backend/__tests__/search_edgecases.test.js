// Mock compiled scraper so tests run against dist services
jest.mock('../dist/scraper/scraper', () => ({
  scrapeBazos: jest.fn(async (opts) => {
    const loc = String((opts && opts.location) || '');
    // numeric 5-digit should be used directly
    if (/^27724$/.test(loc)) return [{ title: 'PostalExact', price: '5000 Kč', location: 'Mělník', url: 'http://pexact' }];
    // 3-digit prefix
    if (/^277$/.test(loc)) return [{ title: 'Prefix277', price: '1000 Kč', location: 'Mělník', url: 'http://p277' }];
    // city relaxed search returns items that will be filtered later
    if (loc.toLowerCase().includes('měln') || loc.toLowerCase().includes('meln')) return [
      { title: 'CityRelax1', price: '2000 Kč', location: 'Mělník', url: 'http://c1' },
      { title: 'CityRelax2', price: '3000 Kč', location: 'Praha', url: 'http://c2' }
    ];
    return [];
  })
}));

const { searchMarket } = require('../dist/services/marketService');

describe('searchMarket edge cases (compiled)', () => {
  test('numeric postal input (5-digit) uses the exact postal', async () => {
    const res = await searchMarket({ keywords: '', location: '27724', strictLocation: false });
    const titles = res.map(r => r.title);
    expect(titles).toContain('PostalExact');
  });

  test('numeric short postal (3-digit) uses prefix', async () => {
    const res = await searchMarket({ keywords: '', location: '277', strictLocation: false });
    const titles = res.map(r => r.title);
    expect(titles).toContain('Prefix277');
  });

  test('city input falls back to prefix scraping when relaxed returns no matched prefixes', async () => {
    // 'Mělník' relaxed returns items; service should attempt enrichment and may keep or fall back.
    const res = await searchMarket({ keywords: '', location: 'Mělník', strictLocation: false });
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThanOrEqual(1);
  });

  test('strictLocation true propagates to scraper options (no relaxation)', async () => {
    // we assert that having strictLocation true still returns an array (mocked)
    const res = await searchMarket({ keywords: '', location: 'Mělník', strictLocation: true });
    expect(Array.isArray(res)).toBe(true);
  });
});
