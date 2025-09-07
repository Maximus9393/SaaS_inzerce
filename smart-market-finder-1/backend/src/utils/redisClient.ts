import { createClient } from 'redis';

let client: any = null;

export async function getRedisClient() {
  if (client) return client;
  const url = (process.env.REDIS_URL || 'redis://127.0.0.1:6379').trim();
  // allow opting out (tests or environments without redis)
  if (url === 'off' || url === 'none' || url === 'mock') {
    // noop client implementing the subset we use
    client = {
      get: async (_k: string) => null,
      set: async (_k: string, _v: string) => null,
      setEx: async (_k: string, _ttl: number, _v: string) => null,
      disconnect: async () => null,
      quit: async () => null,
    } as any;
    return client;
  }

  client = createClient({ url });
  client.on('error', (err: any) => console.warn('Redis error', err));
  await client.connect().catch(() => null);
  return client;
}

export async function redisGet(key: string) {
  const c = await getRedisClient().catch(() => null);
  if (!c) return null;
  return c.get(key).catch(() => null);
}

export async function redisSet(key: string, value: string, ttlSec?: number) {
  const c = await getRedisClient().catch(() => null);
  if (!c) return null;
  if (ttlSec) return c.setEx(key, ttlSec, value).catch(() => null);
  return c.set(key, value).catch(() => null);
}

export async function closeRedis() {
  if (!client) return;
  try {
    if (typeof client.disconnect === 'function') await client.disconnect().catch(() => null);
    if (typeof client.quit === 'function') await client.quit().catch(() => null);
  } catch (e) {
    // ignore
  }
  client = null;
}
