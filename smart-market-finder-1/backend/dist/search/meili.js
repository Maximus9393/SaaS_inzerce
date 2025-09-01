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
exports.ensureIndex = ensureIndex;
exports.indexItems = indexItems;
const meilisearch_1 = require("meilisearch");
const MEILI_HOST = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
const MEILI_KEY = process.env.MEILI_KEY || '';
const client = new meilisearch_1.MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
const INDEX = 'rss_items';
function ensureIndex() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const idx = yield client.getIndex(INDEX);
            return idx;
        }
        catch (e) {
            return client.createIndex(INDEX, { primaryKey: 'id' });
        }
    });
}
function indexItems(items) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureIndex();
        return client.index(INDEX).addDocuments(items);
    });
}
exports.default = { ensureIndex, indexItems };
