import { filterResults } from '../../smart-market-finder-1/backend/src/utils/filter';

describe('filterResults', () => {
  test('deduplicates by url', () => {
    const items = [
      { title: 'A', url: 'u1', price: '100', location: 'X', date: new Date().toISOString() },
      { title: 'A dup', url: 'u1', price: '100', location: 'X', date: new Date().toISOString() },
      { title: 'B', url: 'u2', price: '200', location: 'Y', date: new Date().toISOString() },
    ];
    const out = filterResults(items, { method: 'dedupe' });
    expect(out.length).toBe(2);
    const urls = out.map(i => i.url);
    expect(urls).toContain('u1');
    expect(urls).toContain('u2');
  });

  test('random sampling returns at most 10 items', () => {
    const items = Array.from({ length: 25 }).map((_, i) => ({ title: `T${i}`, url: `u${i}`, price: `${i}`, location: 'L', date: new Date().toISOString() }));
    const out = filterResults(items, { method: 'random' });
    expect(out.length).toBeLessThanOrEqual(10);
    out.forEach(o => expect(items.find(it => it.url === o.url)).toBeDefined());
  });

  test('relevance sorts items with keyword in title first', () => {
    const items = [
      { title: 'Old bike for sale', url: 'u1', price: '100', location: 'X', date: new Date().toISOString() },
      { title: 'Chair', url: 'u2', price: '50', location: 'Y', date: new Date().toISOString() },
      { title: 'Bike helmet', url: 'u3', price: '30', location: 'Z', date: new Date().toISOString() },
    ];
    const out = filterResults(items, { method: 'relevance', keywords: 'bike' });
    expect(out[0].title.toLowerCase()).toMatch(/bike/);
  });
});
