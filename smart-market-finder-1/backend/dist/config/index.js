"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATABASE_URL = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load .env if present
const envPath = path_1.default.join(__dirname, '..', '..', '.env');
if (fs_1.default.existsSync(envPath)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config({ path: envPath });
}
exports.DATABASE_URL = process.env.DATABASE_URL || '';
