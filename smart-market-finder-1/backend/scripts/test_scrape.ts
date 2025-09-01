import { scrapeBazos } from '../src/scraper/scraper';

async function run() {
  console.log('Running scrapeBazos for location=27724 (no keywords)');
  const items = await scrapeBazos({ keywords: '', location: '27724', strictLocation: false });
  console.log('Scraped items count=', items.length);
  for (let i = 0; i < Math.min(5, items.length); i++) {
    const it = items[i];
    console.log(i, { title: it.title, price: it.price, location: it.location, url: it.url });
  }
}

run().catch(e => { console.error('test_scrape error', e); process.exit(2); });
