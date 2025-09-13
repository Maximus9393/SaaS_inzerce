import { test, expect } from '@playwright/test';
import express from 'express';
import path from 'path';

// Simple mock backend used only in test: serves postal suggestions and search results
test.beforeEach(async ({}, testInfo) => {
  // noop
});

test('search button works, suggestions (naseptavac) appear and nearby listings show distances', async ({ page, baseURL }) => {
  // Start mock API server
  const app = express();
  app.use(express.json());
  app.get('/api/suggest/postal', (req, res) => {
    const q = String(req.query.q || '');
    const suggestions = [
      { code: '10000', city: 'Praha', label: '10000 Praha' },
      { code: '11000', city: 'Praha 1', label: '11000 Praha 1' },
      { code: '15000', city: 'Prague', label: '15000 Prague' }
    ].filter(s => s.label.toLowerCase().includes(q.toLowerCase()) || String(s.code).startsWith(q));
    res.json({ suggestions });
  });

  app.post('/api/search', (req, res) => {
    // Return deterministic results; include distance values so UI shows them
    const results = [
      { title: 'Car A', price: 100000, location: 'Praha', url: 'http://a', images: [], description: 'Near', distance: 5.2 },
      { title: 'Car B', price: 120000, location: 'Praha', url: 'http://b', images: [], description: 'Far', distance: 42.7 },
      { title: 'Car C', price: 90000, location: 'Praha', url: 'http://c', images: [], description: 'Medium', distance: 12.3 }
    ];
    res.json(results);
  });

  // Serve both API and static build from the same app on port 5000 so relative /api calls work
  const expressStatic = require('express').static;
  const buildPath = path.resolve(__dirname, '..', '..', 'build');
  app.use(expressStatic(buildPath));
  const server = app.listen(5000);
  const srv = { stop: () => server.close() };

  try {
    await page.goto(baseURL || 'http://localhost:5000');

    // Type into location to trigger suggestions
  await page.fill('input[placeholder="Město nebo PSČ (např. Praha, 10000)"]', 'Praha');
    // Wait for suggestions to appear
    await page.waitForSelector('.postal-suggestions .postal-item', { timeout: 3000 });
    const items = await page.$$('.postal-suggestions .postal-item');
    expect(items.length).toBeGreaterThan(0);

    // Click the first suggestion
    await items[0].click();

    // Type a keyword and click search
  await page.fill('input[placeholder="Zadejte značku nebo model auta (např. Octavia, BMW 320d)"]', 'Octavia');
    await page.click('button[type="submit"]');

    // Wait for results; expect result cards to render and show distances
    await page.waitForSelector('.ResultsListItem, .result-card, .listing-card', { timeout: 5000 });

    // Check that at least one distance string is rendered in the page
    const text = await page.textContent('body');
    expect(text).toContain('km');

  } finally {
  srv.stop && srv.stop();
  }
});
