import { getRedis } from '../lib/redis.js';
import { handleDataRequest } from '../lib/handlers.js';

export default async function handler(req, res) {
  const redis = getRedis();
  return handleDataRequest(req, res, redis);
}
