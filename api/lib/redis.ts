import { Redis } from '@upstash/redis';

// Initialized from UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
// Set these in Vercel project settings after creating an Upstash Redis database
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/** Prefix for sync data blobs */
export const SYNC_PREFIX = 'sync:';
/** Prefix for valid sync keys set */
export const KEYS_SET = 'sync_keys';
/** Prefix for key metadata */
export const KEY_META_PREFIX = 'keymeta:';
