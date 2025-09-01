import axios from 'axios';

const BASE = process.env.BASE || 'http://localhost:3000';

const cities = [
  'Praha',
  'Brno',
  'Ostrava',
  'Plzeň',
  'České Budějovice',
  'Olomouc',
  'Hradec Králové',
  'Pardubice',
  'Zlín',
  'Mělník',
  'Tábor',
  'Karlovy Vary',
  'Ústí nad Labem',
  'Jihlava',
  'Trutnov'
];

async function suggest(city: string) {
  const resp = await axios.get(`${BASE}/api/suggest/postal`, { params: { q: city }, timeout: 5000 });
  return resp.data && resp.data.suggestions ? resp.data.suggestions : [];
}

async function postSearch(location: string, strict = false) {
  const resp = await axios.post(`${BASE}/api/search`, { keywords: '', location, strictLocation: strict }, { timeout: 20000 });
  return resp.data || { ok: false };
}

async function run() {
  console.log('Bulk location check starting...');
  for (const city of cities) {
    try {
      const suggestions = await suggest(city);
      const suggestionCount = suggestions.length;
      const sampleCodes = suggestions.slice(0, 5).map((s: any) => s.code);
      const prefixes = Array.from(new Set(suggestions.map((s: any) => String(s.code).slice(0, 3))));
      const prefixSample = prefixes[0] || '';
      const fullSample = sampleCodes[0] || '';

      const resCity = await postSearch(city, false);
  const resPrefix = prefixSample ? await postSearch(String(prefixSample), false) : { ok: false as const, count: 0 };
  const resFullRelaxed = fullSample ? await postSearch(String(fullSample), false) : { ok: false as const, count: 0 };
  const resFullStrict = fullSample ? await postSearch(String(fullSample), true) : { ok: false as const, count: 0 };

      console.log('\n===', city, '===');
      console.log('suggestions:', suggestionCount, 'sample codes:', sampleCodes.slice(0,3));
      console.log('prefixes sample:', prefixes.slice(0,3));
      console.log('search city (relaxed): ok=', resCity.ok, 'count=', resCity.count);
      console.log(`search prefix (${prefixSample}) (relaxed): ok=${resPrefix.ok} count=${resPrefix.count}`);
      console.log(`search full (${fullSample}) (relaxed): ok=${resFullRelaxed.ok} count=${resFullRelaxed.count}`);
      console.log(`search full (${fullSample}) (strict): ok=${resFullStrict.ok} count=${resFullStrict.count}`);
    } catch (e: any) {
      console.error('Error checking', city, e && e.message ? e.message : e);
    }
  }
  console.log('\nBulk check complete');
}

run().catch(e => { console.error('fatal', e); process.exit(2); });
