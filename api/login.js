import { getRedis } from '../lib/redis.js';
import { handleLoginRequest } from '../lib/handlers.js';

export default async function handler(req, res) {
  const redis = getRedis();
  return handleLoginRequest(req, res, redis);
}
