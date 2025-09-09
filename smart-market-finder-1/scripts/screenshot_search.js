const path = require('path');
const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const buildDir = path.join(__dirname, '..', 'frontend', 'build');
  if (!fs.existsSync(buildDir)) { console.error('frontend build not found at', buildDir); process.exit(1); }

  const app = express();
  app.use(express.static(buildDir));
  app.get('*', (req, res) => res.sendFile(path.join(buildDir, 'index.html')));

  const server = app.listen(5000, async () => {
    console.log('[screenshot] frontend served at http://localhost:5000');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // go to app
  await page.goto('http://localhost:5000', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1000);

      // If app needs an initial search, attempt to fill react form
      // Try multiple selectors to be robust
      const searchSelectors = ['input[name="keywords"]', 'input[placeholder*="hledat"]', '#search-input'];
      let inputSel = null;
      for (const s of searchSelectors) {
        const el = await page.$(s);
        if (el) { inputSel = s; break; }
      }

      if (inputSel) {
        await page.click(inputSel);
        await page.type(inputSel, 'octavia 1.9 tdi', { delay: 50 });
      } else {
        console.log('[screenshot] search input not found, page snapshot only');
      }

      // submit via button or enter
      // find a submit button or any button with Czech text 'Hledat' or English 'Search'
      let btn = await page.$('button[type="submit"]');
      if (!btn) {
        const buttons = await page.$$('button');
        for (const b of buttons) {
          const txt = (await (await b.getProperty('innerText')).jsonValue()) || '';
          if (txt && /hledat|search/i.test(String(txt))) { btn = b; break; }
        }
      }
      if (btn) { await btn.click(); } else { await page.keyboard.press('Enter'); }

      await sleep(2500);

      // screenshot list view
      const outDir = path.join(__dirname, 'screenshots'); if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
      await page.screenshot({ path: path.join(outDir, 'search_results.png'), fullPage: true });

      // click first result card if present
      const first = await page.$('a.result-card, .result-card, .listing-card, .ResultsListItem');
      if (first) {
        try {
          await first.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(outDir, 'search_result_detail.png'), fullPage: true });
        } catch (e) {
          console.log('[screenshot] clicking first result failed', e.message || e);
        }
      } else {
        console.log('[screenshot] no result card selector found, saved list snapshot only');
      }

      console.log('[screenshot] done, screenshots saved to', outDir);
    } catch (e) {
      console.error('screenshot failed', e && e.message ? e.message : e);
    } finally {
      await browser.close();
      server.close(() => process.exit(0));
    }
  });
})();
