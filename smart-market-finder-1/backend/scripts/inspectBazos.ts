import axios from 'axios';
// require to avoid potential ESM interop issues in this quick script
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio = require('cheerio');

async function inspect() {
  const url = 'https://auto.bazos.cz/inzeraty/praha/?q=Octavia';
  console.log('fetching', url);
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartMarketFinder/1.0)' }, timeout: 15000, validateStatus: (s: number) => s < 500 });
  if (!res || !res.data) {
    console.error('no data fetched');
    return;
  }
  const $ = cheerio.load(res.data);

  const containerSelectors = ['.inzeraty.inzeratyflex', '.inzeraty', '.inzerat', '.inzerat-wrap', '.inzerat-block'];
  const containers = $(containerSelectors.join(',')).toArray();
  console.log('containers total:', containers.length);

  const anchors = $('h2.nadpis a, .inzeratynadpis a, .nadpis a, a').toArray().filter((a: any) => { const href = String((a.attribs && a.attribs.href) || '').toLowerCase(); return /\/inzerat\//.test(href); });
  console.log('anchors (detail) total:', anchors.length);

  // sample first container
  if (containers.length > 0) {
    const first = containers[0];
    console.log('--- first container snippet ---');
    const html = $(first).html() || '';
    console.log(html.slice(0, 800));
  }

  // print first 10 anchors
  console.log('--- first 10 anchors ---');
  anchors.slice(0, 10).forEach((a: any, idx: number) => {
    console.log(idx, (a.attribs && a.attribs.href) || '', 'text=', $(a).text().trim().slice(0, 80));
  });
}

inspect().catch(err => { console.error(err && err.message || err); process.exit(1); });
