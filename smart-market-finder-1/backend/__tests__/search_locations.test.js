// Mock compiled scraper so tests run against compiled services in dist
jest.mock('../dist/scraper/scraper', () => ({
  scrapeBazos: jest.fn(async (opts) => {
    const loc = String((opts && opts.location) || '').toLowerCase();
    if (loc.includes('praha')) return [{ title: 'PrahaItem', price: '10000 Kč', location: 'Praha', url: 'http://praha' }];
    if (loc.includes('měln') || loc.includes('meln') || /^277/.test(loc)) return [{ title: 'MelnikItem', price: '2000 Kč', location: 'Mělník', url: 'http://meln' }];
    if (loc.includes('brno')) return [{ title: 'BrnoItem', price: '3000 Kč', location: 'Brno', url: 'http://brno' }];
    return [];
  })
}));

const { searchMarket } = require('../dist/services/marketService');

describe('searchMarket locations (compiled)', () => {
  test('returns Praha results for Praha query', async () => {
    const res = await searchMarket({ keywords: '', location: 'Praha', strictLocation: false });
    const titles = res.map(r => r.title);
    expect(titles).toContain('PrahaItem');
  });

  test('returns Mělník results for Mělník and Melnik queries', async () => {
    const res1 = await searchMarket({ keywords: '', location: 'Mělník', strictLocation: false });
    const res2 = await searchMarket({ keywords: '', location: 'Melnik', strictLocation: false });
    const titles = [...res1, ...res2].map(r => r.title);
    expect(titles).toContain('MelnikItem');
  });

  test('returns Brno results for Brno query', async () => {
    const res = await searchMarket({ keywords: '', location: 'Brno', strictLocation: false });
    const titles = res.map(r => r.title);
    expect(titles).toContain('BrnoItem');
  });
});
