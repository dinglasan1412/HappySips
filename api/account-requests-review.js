import { getRedis } from '../lib/redis.js';
import { handleAccountRequestReview } from '../lib/handlers.js';

export default async function handler(req, res) {
  const redis = getRedis();
  return handleAccountRequestReview(req, res, redis);
}
