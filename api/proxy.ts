import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless proxy for resolving Google Maps short links
 * and fetching Google Maps data (lists, place pages).
 *
 * Manually follows redirects to capture all intermediate URLs,
 * which often contain the place name/query that the final page lacks.
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
const MAX_REDIRECTS = 10;

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
    const acceptHeader = (req.query.accept as string) || 'text/html';

    // Manually follow redirects to capture all URLs in the chain
    let currentUrl = url;
    const redirectChain: string[] = [url];

    for (let i = 0; i < MAX_REDIRECTS; i++) {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VectorApp/1.0)',
          Accept: acceptHeader,
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        // Resolve relative redirects
        currentUrl = new URL(location, currentUrl).href;
        redirectChain.push(currentUrl);
        continue;
      }

      // Final response (not a redirect)
      clearTimeout(timer);
      const body = await response.text();

      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        body,
        finalUrl: currentUrl,
        redirectChain,
        status: response.status,
      });
    }

    clearTimeout(timer);
    return res.status(502).json({ error: 'Too many redirects' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(502).json({ error: `Fetch failed: ${message}` });
  }
}
