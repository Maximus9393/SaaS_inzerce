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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveListing = saveListing;
exports.findRecent = findRecent;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
// Use a loose type here to avoid tight coupling to generated types during bootstrap
function saveListing(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!prismaClient_1.default)
                return null;
            const created = yield prismaClient_1.default.listing.create({ data: {
                    title: data.title,
                    price: data.price,
                    location: data.location || null,
                    source: data.source,
                    url: data.url,
                    thumbnail: data.thumbnail || null,
                } });
            return created;
        }
        catch (e) {
            // ignore unique constraint errors for idempotency
            if (e && e.code === 'P2002')
                return null;
            throw e;
        }
    });
}
function findRecent() {
    return __awaiter(this, arguments, void 0, function* (limit = 20) {
        if (!prismaClient_1.default)
            return [];
        return prismaClient_1.default.listing.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    });
}
