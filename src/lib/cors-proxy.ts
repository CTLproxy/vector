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
  /** The final URL after redirects */
  responseUrl: string;
}

/** Thrown when the proxy response contains a Google CAPTCHA / redirect page */
export class CaptchaError extends Error {
  /** The original URL that triggered the captcha */
  constructor(public originalUrl: string) {
    super('Google returned a CAPTCHA challenge. Please solve it to continue.');
    this.name = 'CaptchaError';
  }
}

/** Detect Google's captcha / consent pages in proxy-returned HTML */
function isCaptchaPage(html: string): boolean {
  return (
    /<!DOCTYPE html/i.test(html) &&
    (html.includes('captcha') ||
      html.includes('consent.google') ||
      html.includes('sorry/index') ||
      // Google redirect pages that wrap the real content in an HTML shell
      (/^<\!DOCTYPE html.*<title>[^<]*http/i.test(html.substring(0, 500)) &&
        !html.includes('null,null,')))
  );
}

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

/* ─── Own Vercel API proxy (primary) ─── */

async function fetchViaOwnProxy(
  url: string,
  options?: { accept?: string },
): Promise<ProxyResult> {
  const params = new URLSearchParams({ url });
  if (options?.accept) params.set('accept', options.accept);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const response = await fetch(`/api/proxy?${params}`, {
    signal: controller.signal,
  });
  clearTimeout(timer);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(err.error || `Own proxy failed (${response.status})`);
  }

  const data: { body: string; finalUrl: string; status: number } =
    await response.json();

  if (isCaptchaPage(data.body)) {
    throw new CaptchaError(url);
  }

  return { body: data.body, responseUrl: data.finalUrl };
}

/* ─── External CORS proxy (fallback) ─── */

async function fetchViaExternalProxy(
  url: string,
  options?: { accept?: string },
): Promise<ProxyResult> {
  const proxy = getCorsProxy();
  const proxyUrl = proxy + encodeURIComponent(url);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(proxyUrl, {
        headers: { Accept: options?.accept ?? 'text/html' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Proxy fetch failed (${response.status})`);
      }
      const body = await response.text();

      if (isCaptchaPage(body)) {
        throw new CaptchaError(url);
      }

      return { body, responseUrl: response.url };
    } catch (err) {
      if (err instanceof CaptchaError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.includes('(4')) throw lastError;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError ?? new Error('Proxy fetch failed');
}

/**
 * Fetch a URL through our own Vercel API proxy first,
 * falling back to the external CORS proxy if that fails.
 */
export async function fetchViaProxy(
  url: string,
  options?: { accept?: string },
): Promise<ProxyResult> {
  // Try own proxy first (only works when deployed on Vercel)
  try {
    return await fetchViaOwnProxy(url, options);
  } catch (err) {
    // If captcha, don't fallback — both proxies will hit the same issue
    if (err instanceof CaptchaError) throw err;
    // Own proxy unavailable (local dev, or Vercel down) — fall back
  }

  return fetchViaExternalProxy(url, options);
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
