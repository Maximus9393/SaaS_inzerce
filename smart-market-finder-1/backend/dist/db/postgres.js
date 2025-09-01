"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.init = init;
exports.upsertItem = upsertItem;
exports.existsById = existsById;
const pg_1 = require("pg");
const SQL_INIT = `
CREATE TABLE IF NOT EXISTS rss_items (
  id TEXT PRIMARY KEY,
  source TEXT,
  source_id TEXT,
  url TEXT,
  title TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT,
  city TEXT,
  postal TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  category TEXT,
  published_at TIMESTAMP,
  fetched_at TIMESTAMP NOT NULL,
  raw JSONB
);

CREATE INDEX IF NOT EXISTS idx_rss_city ON rss_items(city);
CREATE INDEX IF NOT EXISTS idx_rss_postal ON rss_items(postal);
`;
let pool = null;
function getPool(conn) {
    if (pool)
        return pool;
    const connectionString = conn || process.env.PG_CONN || process.env.DATABASE_URL || '';
    if (!connectionString)
        throw new Error('Postgres connection string not provided in PG_CONN or DATABASE_URL');
    pool = new pg_1.Pool({ connectionString });
    return pool;
}
function init(conn) {
    return __awaiter(this, void 0, void 0, function* () {
        const p = getPool(conn);
        yield p.query(SQL_INIT);
    });
}
function upsertItem(item) {
    return __awaiter(this, void 0, void 0, function* () {
        const p = getPool();
        const q = `INSERT INTO rss_items (id, source, source_id, url, title, description, price, currency, city, postal, lat, lon, category, published_at, fetched_at, raw)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title,
  description=EXCLUDED.description,
  price=EXCLUDED.price,
  currency=EXCLUDED.currency,
  city=EXCLUDED.city,
  postal=EXCLUDED.postal,
  lat=EXCLUDED.lat,
  lon=EXCLUDED.lon,
  category=EXCLUDED.category,
  published_at=EXCLUDED.published_at,
  fetched_at=EXCLUDED.fetched_at,
  raw=EXCLUDED.raw;
`;
        const vals = [item.id, item.source || null, item.source_id || null, item.link, item.title, item.description, item.price || null, item.currency || null, item.city || null, item.postal || null, item.lat || null, item.lon || null, item.category || null, item.pubDate ? new Date(item.pubDate) : null, item.crawledAt ? new Date(item.crawledAt) : new Date(), JSON.stringify(item.raw || {})];
        yield p.query(q, vals);
    });
}
function existsById(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const p = getPool();
        const r = yield p.query('SELECT 1 FROM rss_items WHERE id = $1 LIMIT 1', [id]);
        return (r.rowCount || 0) > 0;
    });
}
exports.default = { init, upsertItem, existsById };
