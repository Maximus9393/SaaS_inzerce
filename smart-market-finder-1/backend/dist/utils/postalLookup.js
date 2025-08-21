"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupPostalPrefixes = void 0;
// Simple postal code lookup for Czech cities. Map city (lowercase, diacritics removed) -> array of PSČ prefixes
const postalMap = {
    // Mělník: common PSČs in the district
    'melnick': ['277', '278'],
    'praha': ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '100', '101', '102', '103'],
    'brno': ['60', '61', '62'],
    'ostrava': ['70', '71', '72', '73', '74'],
    // add more cities as needed
};
function normalizeCity(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim();
}
function lookupPostalPrefixes(cityOrPostal) {
    if (!cityOrPostal)
        return [];
    const raw = String(cityOrPostal).trim();
    // if already a postal prefix (3 digits or more), return as-is
    const num = raw.replace(/\s+/g, '');
    if (/^\d{3,}$/.test(num))
        return [num.slice(0, 3)];
    const key = normalizeCity(raw);
    if (postalMap[key])
        return postalMap[key];
    // fallback: try first word
    const first = key.split(' ')[0];
    if (postalMap[first])
        return postalMap[first];
    return [];
}
exports.lookupPostalPrefixes = lookupPostalPrefixes;
exports.default = lookupPostalPrefixes;
