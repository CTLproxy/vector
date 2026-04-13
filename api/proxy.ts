import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless proxy for resolving Google Maps short links
 * and fetching Google Maps data (lists, place pages).
 *
 * Only allows requests to Google domains for security.
 */

const ALLOWED_HOSTS = [
  'maps.app.goo.gl',
  'goo.gl',
  'www.google.com',
  'maps.google.com',
  'google.com',
];

const TIMEOUT_MS = 15_000;

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h),
    );
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  if (!isAllowedUrl(url)) {
    return res.status(403).json({ error: 'URL not allowed. Only Google Maps domains are supported.' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VectorApp/1.0)',
        Accept: (req.query.accept as string) || 'text/html',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    const body = await response.text();

    // Return the final URL after redirects + the body
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      body,
      finalUrl: response.url,
      status: response.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(502).json({ error: `Fetch failed: ${message}` });
  }
}
