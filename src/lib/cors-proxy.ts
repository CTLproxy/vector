const PROXY_KEY = 'vector_cors_proxy';
const DEFAULT_PROXY = 'https://api.codetabs.com/v1/proxy?quest=';

export function getCorsProxy(): string {
  return localStorage.getItem(PROXY_KEY) || DEFAULT_PROXY;
}

export function setCorsProxy(proxy: string): void {
  localStorage.setItem(PROXY_KEY, proxy);
}

export interface ProxyResult {
  body: string;
  /** The browser-visible response URL (may contain the final redirect target in the proxy URL) */
  responseUrl: string;
}

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

/**
 * Fetch a URL through a CORS proxy. The proxy follows redirects
 * and returns the final page HTML.  Retries on fetch failures.
 */
export async function fetchViaProxy(url: string): Promise<ProxyResult> {
  const proxy = getCorsProxy();
  const proxyUrl = proxy + encodeURIComponent(url);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(proxyUrl, {
        headers: { Accept: 'text/html' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Proxy fetch failed (${response.status})`);
      }
      return {
        body: await response.text(),
        responseUrl: response.url,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on non-transient errors (4xx)
      if (lastError.message.includes('(4')) throw lastError;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError ?? new Error('Proxy fetch failed');
}

/**
 * Try to extract the final redirect target URL from the proxy response URL.
 * Some CORS proxies (corsproxy.io) redirect from
 *   proxy/?SHORT_URL → proxy/?FINAL_URL
 * so the browser sees the final URL encoded in response.url.
 */
export function extractProxiedUrl(responseUrl: string): string | null {
  const proxy = getCorsProxy();
  if (!responseUrl.startsWith(proxy)) return null;
  const encoded = responseUrl.slice(proxy.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}
