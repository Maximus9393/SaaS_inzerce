import axios from 'axios';

const BASE = process.env.BASE || 'http://localhost:3000';

async function run() {
  try {
    console.log('Checking postal suggestions for Mělník...');
    const s = await axios.get(`${BASE}/api/suggest/postal`, { params: { q: 'Mělník' }, timeout: 5000 });
    const suggestions = s.data && s.data.suggestions ? s.data.suggestions : [];
    console.log('Got', suggestions.length, 'suggestions. Sample:', suggestions.slice(0,5));
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('No suggestions returned for Mělník');
    }

    // Check prefixes
    const prefixes = Array.from(new Set(suggestions.map((x: any) => String(x.code).slice(0,3))));
    console.log('Derived prefixes for Mělník:', prefixes.slice(0,6));

    // Helper to POST search
    async function postSearch(location: string, strict = false) {
      const resp = await axios.post(`${BASE}/api/search`, { keywords: '', location, strictLocation: strict }, { timeout: 20000 });
      return resp.data;
    }

    console.log('\nRunning search by city (Mělník) relaxed...');
    const byCity = await postSearch('Mělník', false);
    console.log('byCity:', { ok: byCity.ok, count: byCity.count });

    console.log('\nRunning search by postal prefix (277) relaxed...');
    const byPrefix = await postSearch('277', false);
    console.log('byPrefix:', { ok: byPrefix.ok, count: byPrefix.count });

    console.log('\nRunning search by full postal (27724) strict...');
    const byFullStrict = await postSearch('27724', true);
    console.log('byFullStrict:', { ok: byFullStrict.ok, count: byFullStrict.count });

    // Basic assertions
    const ok = suggestions.length > 0 && byCity.ok === true && typeof byCity.count === 'number' && byPrefix.ok === true;
    if (!ok) throw new Error('One or more checks failed');

    console.log('\nINTEGRATION CHECK PASSED');
    process.exit(0);
  } catch (err: any) {
    console.error('\nINTEGRATION CHECK FAILED:', err && err.message ? err.message : err);
    if (err && err.response && err.response.data) console.error('response.data=', err.response.data);
    process.exit(2);
  }
}

run();
