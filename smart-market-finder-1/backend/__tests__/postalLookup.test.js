const { suggestPostal, lookupPostalPrefixes } = require('../dist/utils/postalLookup');

describe('postalLookup (compiled)', () => {
  test('suggestPostal returns PSČ suggestions for Mělník and numeric prefix sorting', () => {
    const suggestions = suggestPostal('Mělník');
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    const found = suggestions.some(s => {
      const c = String(s.city).toLowerCase();
      return c.includes('měl') || c.includes('měln') || c.includes('meln');
    });
    expect(found).toBe(true);

  const numeric = suggestPostal('277');
  expect(Array.isArray(numeric)).toBe(true);
  const codes = numeric.map(s => String(s.code));
  // All returned codes should start with the requested prefix '277'
  expect(codes.length).toBeGreaterThan(0);
  expect(codes.every(c => c.startsWith('277'))).toBe(true);
  });

  test('lookupPostalPrefixes returns prefixes for city and postal inputs', () => {
    const prefsCity = lookupPostalPrefixes('Mělník');
    expect(Array.isArray(prefsCity)).toBe(true);
    expect(prefsCity.length).toBeGreaterThan(0);

    const prefsPostal = lookupPostalPrefixes('27724');
    expect(prefsPostal).toEqual(['277']);
  });
});
