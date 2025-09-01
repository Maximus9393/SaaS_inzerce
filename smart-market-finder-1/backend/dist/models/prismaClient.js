"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const globalForPrisma = global;
const prisma = globalForPrisma.__prismaClient || new client_1.PrismaClient();
if (process.env.NODE_ENV === 'development')
    globalForPrisma.__prismaClient = prisma;
exports.default = prisma;
