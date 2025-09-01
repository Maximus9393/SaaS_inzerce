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
exports.getRedisClient = getRedisClient;
exports.redisGet = redisGet;
exports.redisSet = redisSet;
const redis_1 = require("redis");
let client = null;
function getRedisClient() {
    return __awaiter(this, void 0, void 0, function* () {
        if (client)
            return client;
        const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        client = (0, redis_1.createClient)({ url });
        client.on('error', (err) => console.warn('Redis error', err));
        yield client.connect().catch(() => null);
        return client;
    });
}
function redisGet(key) {
    return __awaiter(this, void 0, void 0, function* () {
        const c = yield getRedisClient().catch(() => null);
        if (!c)
            return null;
        return c.get(key).catch(() => null);
    });
}
function redisSet(key, value, ttlSec) {
    return __awaiter(this, void 0, void 0, function* () {
        const c = yield getRedisClient().catch(() => null);
        if (!c)
            return null;
        if (ttlSec)
            return c.setEx(key, ttlSec, value).catch(() => null);
        return c.set(key, value).catch(() => null);
    });
}
