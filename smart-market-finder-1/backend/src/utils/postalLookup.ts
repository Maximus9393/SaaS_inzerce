// Load a small PSČ dataset (psc.json) and provide lookup utilities.
let pscData: any[] = [];
const tryLoadJson = (p: string) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(p);
    // If the compiled dist placeholder was injected, it's not a valid array
    if (Array.isArray(mod)) return mod;
    return [];
  } catch (e) {
    return [];
  }
};

// prefer static import (works with resolveJsonModule)
// try local relative file first
pscData = tryLoadJson('./psc.json');
if (!pscData || pscData.length === 0) {
  const fs = require('fs');
  const path = require('path');
  const candidates = [
    path.join(__dirname, 'psc.json'),
    // when running from dist, src may be adjacent
  path.join(__dirname, '..', 'src', 'utils', 'psc.json'),
  // compiled layout: dist/utils -> go up twice to project src
  path.join(__dirname, '..', '..', 'src', 'utils', 'psc.json'),
    // common project-root relative paths
    path.join(process.cwd(), 'src', 'utils', 'psc.json'),
    path.join(process.cwd(), 'dist', 'src', 'utils', 'psc.json'),
    path.join(process.cwd(), 'backend', 'src', 'utils', 'psc.json'),
  path.join(process.cwd(), 'backend', 'dist', 'src', 'utils', 'psc.json'),
  // dist sibling locations
  path.join(__dirname, '..', '..', 'dist', 'src', 'utils', 'psc.json')
  ];
  for (const c of candidates) {
    try {
      if (!fs.existsSync(c)) continue;
      const raw = fs.readFileSync(c, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        pscData = parsed;
        break;
      }
    } catch (e) {
      // try next
    }
  }
}

type PscEntry = { code: string; city: string };

function normalizeCity(s: string) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim();
}

// Build indexes: by 3-digit prefix -> entries, and by normalized city -> entries
const byPrefix: Record<string, PscEntry[]> = {};
const byCity: Record<string, PscEntry[]> = {};

(pscData as PscEntry[]).forEach(e => {
  const prefix = String(e.code).slice(0, 3);
  byPrefix[prefix] = byPrefix[prefix] || [];
  byPrefix[prefix].push(e);
  const cityKey = normalizeCity(e.city);
  byCity[cityKey] = byCity[cityKey] || [];
  byCity[cityKey].push(e);
});

// Suggestion object returned to client
export type PostalSuggestion = { code: string; city: string; label: string };

export function suggestPostal(q: string): PostalSuggestion[] {
  if (!q) return [];
  const raw = String(q).trim();
  const num = raw.replace(/\s+/g, '');
  // Exact postal code or 3+ digits -> return matching prefix entries
  if (/^\d{3,}$/.test(num)) {
    const prefix = num.slice(0, 3);
    const list = byPrefix[prefix] || [];
    return list.map(e => ({ code: e.code, city: e.city, label: `${e.code} ${e.city}` }));
  }

  // Short numeric prefix (1-2 digits) -> match prefixes that startWith
  if (/^\d{1,2}$/.test(num)) {
    const want = num;
    const matches: PscEntry[] = [];
    Object.keys(byPrefix).forEach(pref => { if (pref.startsWith(want)) matches.push(...(byPrefix[pref] || [])); });
    return matches.slice(0, 20).map(e => ({ code: e.code, city: e.city, label: `${e.code} ${e.city}` }));
  }

  const key = normalizeCity(raw);
  // Direct city match
  if (byCity[key]) {
    // Dedupe by 3-digit prefix and return a small representative set so the frontend can pick a PSČ
    const seenPref = new Set<string>();
    const out: PscEntry[] = [];
    for (const e of byCity[key]) {
      const p = String(e.code).slice(0, 3);
      if (seenPref.has(p)) continue;
      seenPref.add(p);
      out.push(e);
      if (out.length >= 8) break;
    }
    return out.map(e => ({ code: e.code, city: e.city, label: `${e.code} ${e.city}` }));
  }

  // Try a simple spelling variant fallback: replace trailing 'ck' or 'c' with 'k' (users sometimes type 'Melnick' vs 'Melnik')
  if (!byCity[key]) {
    // 'melnick' -> 'melnik' (replace trailing 'ick' -> 'ik')
    if (key.endsWith('ick')) {
      const alt = key.slice(0, -3) + 'ik';
      if (byCity[alt]) return byCity[alt].slice(0, 20).map(e => ({ code: e.code, city: e.city, label: `${e.code} ${e.city}` }));
    }
    // trailing stray 'c' -> remove
    if (key.endsWith('c')) {
      const alt = key.slice(0, -1);
      if (byCity[alt]) return byCity[alt].slice(0, 20).map(e => ({ code: e.code, city: e.city, label: `${e.code} ${e.city}` }));
    }
  }

  // Partial city match (startsWith/includes)
  const matches: PscEntry[] = [];
  for (const k of Object.keys(byCity)) {
    if (k.startsWith(key) || key.startsWith(k) || k.includes(key)) {
      matches.push(...byCity[k]);
    }
  }
  if (matches.length > 0) return matches.slice(0, 30).map(e => ({ code: e.code, city: e.city, label: `${e.code} ${e.city}` }));

  // Fuzzy match via Levenshtein distance on normalized city keys (allow small typos)
  function levenshtein(a: string, b: string) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  const scored: Array<{ entry: PscEntry; dist: number }> = [];
  for (const k of Object.keys(byCity)) {
    const d = levenshtein(k, key);
    // threshold: allow distance up to 1 for short keys, up to 2 for longer keys
    const threshold = key.length <= 5 ? 1 : 2;
    if (d <= threshold) {
      byCity[k].forEach(e => scored.push({ entry: e, dist: d }));
    }
  }
  scored.sort((a, b) => a.dist - b.dist);
  return scored.slice(0, 50).map(s => ({ code: s.entry.code, city: s.entry.city, label: `${s.entry.code} ${s.entry.city}` }));
}

// Backwards-compatible helper used internally when only prefixes are needed
export function lookupPostalPrefixes(cityOrPostal: string): string[] {
  if (!cityOrPostal) return [];
  const q = String(cityOrPostal).trim();
  const num = q.replace(/\s+/g, '');
  if (/^\d{3,}$/.test(num)) return [num.slice(0, 3)];
  if (/^\d{1,2}$/.test(num)) {
    const want = num;
    return Object.keys(byPrefix).filter(p => p.startsWith(want)).slice(0, 20);
  }
  const key = normalizeCity(q);
  if (byCity[key]) return Array.from(new Set(byCity[key].map(e => e.code.slice(0, 3))));
  const starts = new Set<string>();
  for (const k of Object.keys(byCity)) {
    if (k.startsWith(key) || key.startsWith(k) || k.includes(key)) {
      byCity[k].forEach(e => starts.add(e.code.slice(0, 3)));
    }
  }
  return Array.from(starts).slice(0, 20);
}

export default lookupPostalPrefixes;
