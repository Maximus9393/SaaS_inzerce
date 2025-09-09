// Simple geolocation helpers: Haversine distance and postal->coords mapping.
import pscData from './psc.json';
import pscCoords from './psc_coords.json';

export type LatLon = { lat: number; lon: number } | null;

export const haversine = (a: LatLon, b: LatLon) => {
  if (!a || !b) return Infinity;
  const R = 6371e3; // meters
  const toRad = (d: number) => d * Math.PI / 180;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dphi = toRad(b.lat - a.lat);
  const dlambda = toRad(b.lon - a.lon);
  const sinDphi = Math.sin(dphi/2);
  const sinDlam = Math.sin(dlambda/2);
  const c = 2 * Math.atan2(Math.sqrt(sinDphi*sinDphi + Math.cos(phi1)*Math.cos(phi2)*sinDlam*sinDlam), Math.sqrt(1 - (sinDphi*sinDphi + Math.cos(phi1)*Math.cos(phi2)*sinDlam*sinDlam)));
  const d = R * c; // meters
  return d / 1000; // return km
};

// Build a simple postal -> city map from psc.json (code->city)
const postalToCity: Record<string, string> = {};
(pscData as any[]).forEach((e: any) => { if (e && e.code) postalToCity[String(e.code)] = e.city || ''; });

// precise PSČ -> coords mapping (if available)
const postalCoords: Record<string, { lat: number; lon: number }> = (pscCoords as any) || {};

// A minimal static centroid map for major Czech cities (lat/lon). We'll fallback to city centroid by name.
const cityCentroids: Record<string, LatLon> = {
  'Praha': { lat: 50.087451, lon: 14.420671 },
  'Brno': { lat: 49.195061, lon: 16.606836 },
  'Ostrava': { lat: 49.820922, lon: 18.262524 },
  'Plzeň': { lat: 49.738431, lon: 13.373629 },
  'Hradec Králové': { lat: 50.209285, lon: 15.832974 },
  'Olomouc': { lat: 49.593778, lon: 17.250112 },
  'Liberec': { lat: 50.767143, lon: 15.05619 },
  'Zlín': { lat: 49.226441, lon: 17.670684 },
  'České Budějovice': { lat: 48.974622, lon: 14.47498 }
};

const normalizePostal = (p: string) => {
  if (!p) return '';
  return String(p).replace(/\s+/g, '').slice(0, 5);
};

export const postalToCoords = (postal: string): LatLon => {
  if (!postal) return null;
  const pnorm = normalizePostal(postal);
  // first prefer precise mapping
  if (postalCoords[pnorm]) return { lat: postalCoords[pnorm].lat, lon: postalCoords[pnorm].lon };
  // next try mapping via psc.json -> city centroid
  if (postalToCity[pnorm]) {
    const city = postalToCity[pnorm];
    if (city && cityCentroids[city]) return cityCentroids[city];
    // try to find any PSČ entry that maps to this city and use psc_coords for that code
    try {
      const pscArr = Array.isArray(pscData) ? pscData : [];
      const target = String(city).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      for (const p of pscArr) {
        if (!p || !p.city || !p.code) continue;
        const cnorm = String(p.city).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        if (cnorm === target) {
          const code = String(p.code).replace(/\s+/g, '').slice(0,5);
          if ((pscCoords as any)[code]) return { lat: (pscCoords as any)[code].lat, lon: (pscCoords as any)[code].lon };
        }
      }
    } catch (e) { /* ignore */ }
  }
  // try prefix (3 digits) fallback to any matching prefix in postalCoords
  const pref = String(pnorm).slice(0, 3);
  for (const k of Object.keys(postalCoords)) {
    if (String(k).startsWith(pref)) return { lat: postalCoords[k].lat, lon: postalCoords[k].lon };
  }
  // try prefix match in postalToCity -> centroid
  for (const k of Object.keys(postalToCity)) {
    if (String(k).startsWith(pref)) {
      const c = postalToCity[k]; if (c && cityCentroids[c]) return cityCentroids[c];
    }
  }
  const cityName = postalToCity[pnorm]; if (cityName && cityCentroids[cityName]) return cityCentroids[cityName];
  return null;
};

export const cityToCoords = (city: string): LatLon => {
  if (!city) return null;
  const key = String(city).trim();
  if (cityCentroids[key]) return cityCentroids[key];
  // try normalized match
  const normalized = key.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  for (const k of Object.keys(cityCentroids)) {
    if (k.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === normalized) return cityCentroids[k];
  }

  // fallback: try to find city in psc.json and use first matching PSČ's coords
  try {
    const pscArr = Array.isArray(pscData) ? pscData : [];
    // direct equality
    for (const p of pscArr) {
      if (!p || !p.city || !p.code) continue;
      const cnorm = String(p.city).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      if (cnorm === normalized) {
        const code = String(p.code).replace(/\s+/g, '').slice(0,5);
        if ((pscCoords as any)[code]) return { lat: (pscCoords as any)[code].lat, lon: (pscCoords as any)[code].lon };
      }
    }
    // strip trailing district numbers ("Praha 9" -> "Praha") and retry
    const stripped = normalized.replace(/\b\d+\b/g, '').replace(/[-,()]/g, '').trim();
    if (stripped && stripped !== normalized) {
      for (const p of pscArr) {
        if (!p || !p.city || !p.code) continue;
        const cnorm = String(p.city).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        if (cnorm === stripped) {
          const code = String(p.code).replace(/\s+/g, '').slice(0,5);
          if ((pscCoords as any)[code]) return { lat: (pscCoords as any)[code].lat, lon: (pscCoords as any)[code].lon };
        }
      }
    }
    // try substring inclusion
    for (const p of pscArr) {
      if (!p || !p.city || !p.code) continue;
      const cnorm = String(p.city).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      if (cnorm && normalized.includes(cnorm)) {
        const code = String(p.code).replace(/\s+/g, '').slice(0,5);
        if ((pscCoords as any)[code]) return { lat: (pscCoords as any)[code].lat, lon: (pscCoords as any)[code].lon };
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
};

export const normalizePostalCode = normalizePostal;

export default { haversine, postalToCoords, cityToCoords, normalizePostalCode };
