import { PrismaClient } from '@prisma/client';

declare const global: any;

const globalForPrisma: any = global as any;

const prisma = globalForPrisma.__prismaClient || new PrismaClient();
if (process.env.NODE_ENV === 'development') globalForPrisma.__prismaClient = prisma;

export default prisma;
