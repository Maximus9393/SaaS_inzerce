/* Jest global teardown: close Prisma and Redis clients to avoid open handles */
module.exports = async () => {
  // close Prisma if present (try compiled dist first, then src)
  try {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const prismaMod = require('./dist/models/prismaClient').default || require('./dist/models/prismaClient') || require('./src/models/prismaClient').default || require('./src/models/prismaClient');
      if (prismaMod && typeof prismaMod.$disconnect === 'function') {
        await prismaMod.$disconnect().catch(() => null);
      }
    }
    catch (e) {
      // ignore
    }

  // close redis client explicitly using closeRedis if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const redisMod = require('./dist/utils/redisClient') || require('./src/utils/redisClient');
    if (redisMod && typeof redisMod.closeRedis === 'function') {
      await redisMod.closeRedis().catch(() => null);
    }
    else if (redisMod && typeof redisMod.getRedisClient === 'function') {
      const c = await redisMod.getRedisClient().catch(() => null);
      if (c && typeof c.disconnect === 'function') await c.disconnect().catch(() => null);
      if (c && typeof c.quit === 'function') await c.quit().catch(() => null);
    }
  }
  catch (e) {
    // ignore
  }
  }
  catch (e) {
    // final ignore
  }
};
