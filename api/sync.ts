import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redis, SYNC_PREFIX, KEYS_SET } from './lib/redis';

/**
 * Sync endpoint: GET and PUT sync data, authenticated by sync key.
 *
 * GET  /api/sync?key=<sync-key>  → returns sync data JSON
 * PUT  /api/sync?key=<sync-key>  → stores sync data JSON, returns { ok: true }
 *
 * Max payload: 5MB (Vercel serverless limit)
 */

const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5MB

async function isValidKey(key: string): Promise<boolean> {
  return (await redis.sismember(KEYS_SET, key)) === 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for the PWA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = req.query.key;
  if (!key || typeof key !== 'string' || key.length < 8) {
    return res.status(400).json({ error: 'Missing or invalid ?key= parameter' });
  }

  // Validate the sync key
  if (!(await isValidKey(key))) {
    return res.status(403).json({ error: 'Invalid or revoked sync key' });
  }

  const redisKey = `${SYNC_PREFIX}${key}`;

  if (req.method === 'GET') {
    const data = await redis.get(redisKey);
    if (!data) {
      return res.status(200).json(null);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);
  }

  // PUT — store sync data
  if (req.method === 'PUT') {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be JSON' });
    }

    // Basic size check
    const raw = JSON.stringify(body);
    if (raw.length > MAX_BODY_SIZE) {
      return res.status(413).json({ error: 'Payload too large (max 5MB)' });
    }

    // Store with no TTL — data persists until manually deleted
    await redis.set(redisKey, body);
    return res.status(200).json({ ok: true });
  }
}
