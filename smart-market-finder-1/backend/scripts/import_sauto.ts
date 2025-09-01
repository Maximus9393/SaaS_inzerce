import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// xmlrpc package doesn't ship types here; use require and any-typed client
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xmlrpc = require('xmlrpc');
type XmlRpcClientType = any;
import pgHelper from '../src/db/postgres';
import meiliHelper from '../src/search/meili';

/*
  Simple scaffold for importing ads into sauto.cz via their XML-RPC import.
  - Reads SAUTO_USER and SAUTO_PASS from env
  - Can fetch /import/list and /import/schema endpoints to validate mappings
  - Implements challenge-response auth skeleton (per public docs)
  - Demonstrates upsert into Postgres and Meili using existing helpers

  Usage (dry-run without credentials):
    SAUTO_USER=youruser SAUTO_PASS=yourpass npm run import:sauto
*/

const SAUTO_HOST = process.env.SAUTO_HOST || 'https://www.sauto.cz';
const SAUTO_USER = process.env.SAUTO_USER || '';
const SAUTO_PASS = process.env.SAUTO_PASS || '';

function md5Hex(input: string) {
  return crypto.createHash('md5').update(input).digest('hex');
}

async function fetchJson(url: string) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(url, { headers: { 'User-Agent': 'smart-market-finder/1.0' } });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return res.json();
}

async function tryFetchLists() {
  const lists = ['carList', 'regionList', 'equipmentList'];
  for (const l of lists) {
    const url = `${SAUTO_HOST}/import/${l}`;
    try {
      console.log('Fetching list', url);
      const data = await fetchJson(url);
      console.log(`  -> ${l} items:`, Array.isArray(data) ? data.length : 'unknown');
    } catch (e) {
      console.warn(`  fetch ${url} failed:`, String(e).slice(0, 200));
    }
  }
}

async function xmlrpcAuth(client: any) {
  if (!SAUTO_USER || !SAUTO_PASS) {
    console.warn('SAUTO_USER/SAUTO_PASS not provided — skipping auth and running in dry-run mode');
    return null;
  }
  return new Promise((resolve, reject) => {
    // According to public docs: client requests a challenge, then computes md5(challenge + md5(password))
    client.methodCall('sauto.getChallenge', [SAUTO_USER], (err: any, challenge: any) => {
      if (err) return reject(err);
      try {
        const pwdMd5 = md5Hex(SAUTO_PASS);
        const answer = md5Hex(challenge + pwdMd5);
        client.methodCall('sauto.login', [SAUTO_USER, answer], (err2: any, session: any) => {
          if (err2) return reject(err2);
          resolve(session);
        });
      } catch (e) { reject(e); }
    });
  });
}

async function run() {
  console.log('sauto import scaffold starting');
  try {
    await tryFetchLists();
  } catch (e) {
    console.warn('list fetch step failed', String(e));
  }

  // Prepare xmlrpc client
  const rpcUrl = (SAUTO_HOST || '').replace(/^https?:/, 'http:');
  const xmlClient: XmlRpcClientType = xmlrpc.createClient({ url: `${rpcUrl}/import/xmlrpc`, headers: { 'User-Agent': 'smart-market-finder/1.0' } });

  try {
    const session = await xmlrpcAuth(xmlClient);
    console.log('Auth session:', session ? 'OK' : 'skipped/dryrun');
  } catch (e) {
    console.warn('XML-RPC auth failed or skipped:', String(e).slice(0, 300));
  }

  // Example normalized ad — in real use convert from source scraper/feed
  const sampleAd = {
    id: 'local-sample-1',
    source: 'sauto-scaffold',
    source_id: 'sample-1',
    link: 'https://example.local/sample-1',
    title: 'Sample car for import',
    description: 'This is a scaffold ad for testing import flow.',
    price: 123456,
    currency: 'CZK',
    city: 'Praha',
    postal: '11000',
    lat: null,
    lon: null,
    category: 'osobni',
    pubDate: new Date().toISOString(),
    crawledAt: new Date().toISOString(),
    raw: { _scaffold: true }
  };

  // Upsert into Postgres if configured
  try {
    if (process.env.PG_CONN || process.env.DATABASE_URL) {
      console.log('Initializing Postgres and upserting sample');
      await pgHelper.init();
      await pgHelper.upsertItem(sampleAd as any);
      console.log('Postgres upsert OK');
    } else {
      console.log('PG_CONN not set — skipping Postgres upsert (dry-run)');
    }
  } catch (e) {
    console.warn('Postgres upsert failed:', String(e).slice(0, 400));
  }

  // Index into Meili if configured
  try {
    if (process.env.MEILI_HOST) {
      console.log('Indexing sample into Meilisearch');
      await meiliHelper.indexItems([{
        id: sampleAd.id,
        title: sampleAd.title,
        description: sampleAd.description,
        price: sampleAd.price,
        city: sampleAd.city,
        postal: sampleAd.postal,
        url: sampleAd.link
      }]);
      console.log('Meili index OK');
    } else {
      console.log('MEILI_HOST not set — skipping Meili indexing (dry-run)');
    }
  } catch (e) {
    console.warn('Meili indexing failed:', String(e).slice(0, 400));
  }

  console.log('sauto import scaffold finished');
}

run().catch(e => { console.error('import_sauto runtime error', e); process.exit(2); });
