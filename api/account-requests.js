import { getRedis } from '../lib/redis.js';
import { handleAccountRequestSubmit, handleAccountRequestList } from '../lib/handlers.js';

export default async function handler(req, res) {
  const redis = getRedis();
  if (req.method === 'GET') return handleAccountRequestList(req, res, redis);
  return handleAccountRequestSubmit(req, res, redis);
}
