// Verify that searchMarket returns images[] when scraper provides images
jest.mock('../dist/scraper/scraper', () => ({
  scrapeBazos: jest.fn(async (opts) => {
    return [{ title: 'HasImages', price: '1000 Kč', location: 'Praha', url: 'http://img', images: ['https://example.com/1.jpg', '/relative/2.jpg'], thumbnail: 'https://example.com/1.jpg' }];
  })
}));

// Prevent Meili
jest.mock('../dist/search/meili', () => { throw new Error('meili mocked out for test'); });

const { searchMarket } = require('../dist/services/marketService');

describe('images propagation', () => {
  test('searchMarket returns images array', async () => {
    const res = await searchMarket({ keywords: 'test', location: 'Praha', pageSize: 5 });
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThan(0);
    const item = res[0];
    expect(Array.isArray(item.images)).toBe(true);
    expect(item.images.length).toBeGreaterThanOrEqual(1);
    // thumbnail should be present as fallback too
    expect(item.thumbnail || (item.images && item.images[0])).toBeTruthy();
  });
});
