import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPR_KV_REST_API_URL!,
  token: process.env.UPR_KV_REST_API_TOKEN!,
});

const KEYS_SET = 'sync_keys';
const KEY_META_PREFIX = 'keymeta:';
const SYNC_PREFIX = 'sync:';

/**
 * Admin endpoint for managing sync keys.
 * All requests require the ADMIN_SECRET header.
 *
 * POST   /api/admin/keys              → Create a new sync key
 *        body: { label?: string }
 *
 * GET    /api/admin/keys              → List all sync keys with metadata
 *
 * DELETE /api/admin/keys?key=<key>    → Revoke a sync key and delete its data
 */

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  // Check Authorization header (Bearer token) or X-Admin-Secret header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader === `Bearer ${secret}`) return true;

  const headerSecret = req.headers['x-admin-secret'];
  if (headerSecret === secret) return true;

  return false;
}

function generateSyncKey(): string {
  // Generate a URL-safe random key: 32 chars of base36
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let seg = '';
    for (let i = 0; i < 6; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join('-'); // e.g. "a3bc9f-k2m4p1-x7y8z0-q1w2e3"
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const label = req.body?.label || 'Unnamed';
    const key = generateSyncKey();

    // Add to the set of valid keys
    await redis.sadd(KEYS_SET, key);

    // Store metadata
    await redis.set(`${KEY_META_PREFIX}${key}`, {
      label,
      createdAt: Date.now(),
    });

    return res.status(201).json({ key, label });
  }

  if (req.method === 'GET') {
    // List all keys with metadata
    const keys = await redis.smembers(KEYS_SET);
    const results: { key: string; label: string; createdAt: number }[] = [];

    for (const key of keys) {
      const meta = await redis.get<{ label: string; createdAt: number }>(
        `${KEY_META_PREFIX}${key}`
      );
      results.push({
        key,
        label: meta?.label || 'Unknown',
        createdAt: meta?.createdAt || 0,
      });
    }

    // Sort newest first
    results.sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ keys: results });
  }

  if (req.method === 'DELETE') {
    const key = req.query.key;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Missing ?key= parameter' });
    }

    // Remove from valid keys set
    await redis.srem(KEYS_SET, key);
    // Delete metadata
    await redis.del(`${KEY_META_PREFIX}${key}`);
    // Delete sync data
    await redis.del(`${SYNC_PREFIX}${key}`);

    return res.status(200).json({ ok: true, deleted: key });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
