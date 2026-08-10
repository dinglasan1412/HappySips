const PREFIX = 'happysips:';

// Reads work regardless of whether the SDK auto-deserializes JSON or hands
// back a raw string (this has changed across @upstash/redis versions), and
// seed the key with `seedFn()` the first time it's ever read.
export async function readKey(redis, key, seedFn) {
  const raw = await redis.get(PREFIX + key);
  if (raw === null || raw === undefined) {
    const seeded = await seedFn();
    await redis.set(PREFIX + key, JSON.stringify(seeded));
    return seeded;
  }
  if (typeof raw === 'string') {
    return JSON.parse(raw);
  }
  return raw; // already an object — some SDK versions auto-deserialize
}

export async function writeKey(redis, key, value) {
  await redis.set(PREFIX + key, JSON.stringify(value));
}
