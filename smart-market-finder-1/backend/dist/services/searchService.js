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
exports.searchListings = searchListings;
const marketService_1 = require("./marketService");
function searchListings(query, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const criteria = {
            keywords: query || undefined,
            location: (opts === null || opts === void 0 ? void 0 : opts.location) || undefined,
            strictLocation: Boolean(opts === null || opts === void 0 ? void 0 : opts.strict),
            pageSize: opts === null || opts === void 0 ? void 0 : opts.pageSize,
            saveToDb: Boolean(opts === null || opts === void 0 ? void 0 : opts.saveToDb),
        };
        return yield (0, marketService_1.searchMarket)(criteria);
    });
}
exports.default = { searchListings };
