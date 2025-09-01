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
exports.createListing = createListing;
exports.listRecent = listRecent;
const listingService_1 = require("../services/listingService");
function createListing(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { title, price, location, source, url, thumbnail } = req.body || {};
            const created = yield (0, listingService_1.saveListing)({ title, price: Number(price) || 0, location, source: source || 'unknown', url, thumbnail });
            if (!created)
                return res.status(409).json({ error: 'already exists or not saved' });
            return res.json(created);
        }
        catch (e) {
            return res.status(500).json({ error: e && e.message ? e.message : 'error' });
        }
    });
}
function listRecent(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const limit = Number(req.query.limit || 20) || 20;
            const rows = yield (0, listingService_1.findRecent)(limit);
            return res.json(rows);
        }
        catch (e) {
            return res.status(500).json({ error: e && e.message ? e.message : 'error' });
        }
    });
}
