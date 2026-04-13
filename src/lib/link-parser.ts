/**
 * Parse Google Maps and Apple Maps share links to extract place info.
 *
 * Supported formats:
 *   Google Maps full:  https://www.google.com/maps/place/NAME/@LAT,LNG,...
 *   Google Maps coord: https://www.google.com/maps/@LAT,LNG,...
 *   Google Maps search:https://www.google.com/maps/search/QUERY/@LAT,LNG,...
 *   Google Maps q:     https://maps.google.com/?q=LAT,LNG
 *   Apple Maps:        https://maps.apple.com/?ll=LAT,LNG&q=NAME
 *   Raw coordinates:   48.8566, 2.3522
 */

export interface ParsedPlace {
  name: string;
  lat: number;
  lng: number;
  sourceUrl: string;
}

function parseGoogleMapsUrl(url: string): ParsedPlace | null {
  // Extract @lat,lng from URL path
  const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (isNaN(lat) || isNaN(lng)) return null;

    // Extract place name from /place/NAME/ segment
    const nameMatch = url.match(/\/place\/([^/@]+)/);
    const name = nameMatch
      ? decodeURIComponent(nameMatch[1]).replace(/\+/g, ' ')
      : '';

    return { name, lat, lng, sourceUrl: url };
  }

  // Fallback: ?q=LAT,LNG
  try {
    const u = new URL(url);
    const q = u.searchParams.get('q');
    if (q) {
      const parts = q.split(',').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { name: '', lat: parts[0], lng: parts[1], sourceUrl: url };
      }
    }
  } catch {
    // not a valid URL
  }

  return null;
}

function parseAppleMapsUrl(url: string): ParsedPlace | null {
  try {
    const u = new URL(url);
    const ll = u.searchParams.get('ll');
    if (!ll) return null;

    const [lat, lng] = ll.split(',').map(Number);
    if (isNaN(lat) || isNaN(lng)) return null;

    const name = u.searchParams.get('q') || '';
    return { name: decodeURIComponent(name), lat, lng, sourceUrl: url };
  } catch {
    return null;
  }
}

function parseRawCoords(input: string): ParsedPlace | null {
  const match = input.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return null;
  return { name: '', lat, lng, sourceUrl: '' };
}

/** Check if input looks like a goo.gl short URL */
export function isShortUrl(input: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\/.+/i.test(input.trim());
}

/** Check if input looks like a Google Maps saved list URL */
export function isGoogleMapsListUrl(input: string): boolean {
  return /google\.com\/maps\/(placelists\/list|@[^/]*\/data=.*!4m.*!3m.*!1s)/i.test(input.trim());
}

/**
 * Try to parse a map link synchronously (for full URLs with embedded coords).
 * Returns null if the link needs async resolution (short URLs).
 */
export function parseMapLink(input: string): ParsedPlace | null {
  const trimmed = input.trim();

  // Raw coordinates
  const raw = parseRawCoords(trimmed);
  if (raw) return raw;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // Google Maps
  if (url.hostname.includes('google')) {
    return parseGoogleMapsUrl(trimmed);
  }

  // Apple Maps
  if (url.hostname === 'maps.apple.com') {
    return parseAppleMapsUrl(trimmed);
  }

  return null;
}

/**
 * Extract a Google Maps place URL from HTML (from resolved short URLs).
 * Tries multiple strategies since Google Maps HTML varies.
 */
export function extractMapUrlFromHtml(html: string): string | null {
  // Canonical link
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  if (canonical) return canonical[1];

  // Open Graph URL
  const ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i);
  if (ogUrl) return ogUrl[1];

  // Reverse attribute order (content before property)
  const ogUrlRev = html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:url"/i);
  if (ogUrlRev) return ogUrlRev[1];

  // Any Google Maps place URL in the HTML
  const gmaps = html.match(/(https:\/\/www\.google\.com\/maps\/place\/[^"'\s<>\\]+)/);
  if (gmaps) return gmaps[1];

  // Any Maps URL with coordinates
  const withCoords = html.match(
    /(https:\/\/www\.google\.com\/maps[^"'\s<>\\]*@-?\d+\.\d+,-?\d+\.\d+[^"'\s<>\\]*)/,
  );
  if (withCoords) return withCoords[1];

  // URL-encoded variants (common in JS strings): https:\/\/www.google.com\/maps\/...
  const escaped = html.match(
    /https:\\?\/\\?\/www\.google\.com\\?\/maps\\?\/place\\?\/([^"'\s<>]+?)\\?\/(@-?\d+\.\d+,-?\d+\.\d+)/,
  );
  if (escaped) {
    const raw = escaped[0].replace(/\\\//g, '/');
    return raw;
  }

  return null;
}

/**
 * Extract coordinates directly from HTML/JS content.
 * Google Maps embeds coordinates in various formats in its JavaScript data.
 */
export function extractCoordsFromHtml(html: string): { lat: number; lng: number } | null {
  // Strategy 1: Look for @lat,lng in any URL pattern within the HTML
  const atCoord = html.match(/@(-?\d{1,3}\.\d{4,10}),(-?\d{1,3}\.\d{4,10})/);
  if (atCoord) {
    const lat = parseFloat(atCoord[1]);
    const lng = parseFloat(atCoord[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // Strategy 2: center=LAT%2CLNG (URL-encoded comma)
  const centerEncoded = html.match(/center=(-?\d{1,3}\.\d{4,10})%2C(-?\d{1,3}\.\d{4,10})/i);
  if (centerEncoded) {
    const lat = parseFloat(centerEncoded[1]);
    const lng = parseFloat(centerEncoded[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // Strategy 3: null,null,LAT,LNG pattern (Google's protobuf-like data)
  const nullNull = html.match(/null,null,(-?\d{1,3}\.\d{4,10}),(-?\d{1,3}\.\d{4,10})/);
  if (nullNull) {
    const lat = parseFloat(nullNull[1]);
    const lng = parseFloat(nullNull[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // Strategy 4: [null,null,LAT,LNG] in JSON arrays
  const jsonArray = html.match(/\[null,null,(-?\d{1,3}\.\d{4,10}),(-?\d{1,3}\.\d{4,10})\]/);
  if (jsonArray) {
    const lat = parseFloat(jsonArray[1]);
    const lng = parseFloat(jsonArray[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // Strategy 5: ll=LAT,LNG or sll=LAT,LNG
  const llParam = html.match(/[?&]s?ll=(-?\d{1,3}\.\d{4,10}),(-?\d{1,3}\.\d{4,10})/);
  if (llParam) {
    const lat = parseFloat(llParam[1]);
    const lng = parseFloat(llParam[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // Strategy 6: "latitude":LAT,"longitude":LNG (JSON-LD structured data)
  const jsonLd = html.match(/"latitude"\s*:\s*(-?\d{1,3}\.\d{3,10})\s*,\s*"longitude"\s*:\s*(-?\d{1,3}\.\d{3,10})/);
  if (jsonLd) {
    const lat = parseFloat(jsonLd[1]);
    const lng = parseFloat(jsonLd[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // Strategy 7: window.APP_OPTIONS containing coords like [LAT, LNG]
  const appOptions = html.match(/\[(-?\d{1,2}\.\d{5,10}),(-?\d{1,3}\.\d{5,10})\]/);
  if (appOptions) {
    const lat = parseFloat(appOptions[1]);
    const lng = parseFloat(appOptions[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  return null;
}

function isValidCoord(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function isGenericMapsTitle(raw: string): boolean {
  // Normalize non-breaking spaces (\xa0) to regular spaces before comparing
  const name = raw.replace(/\u00a0/g, ' ').trim();
  return !name || name === 'Google Maps';
}

/**
 * Extract place name from HTML meta tags or JS data (for resolved short URLs).
 */
export function extractNameFromHtml(html: string): string {
  // Try og:title first (both attribute orders)
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  if (ogTitle) {
    const name = ogTitle[1].replace(/ - Google Maps$/i, '').trim();
    if (!isGenericMapsTitle(name)) return name;
  }
  const ogTitleRev = html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
  if (ogTitleRev) {
    const name = ogTitleRev[1].replace(/ - Google Maps$/i, '').trim();
    if (!isGenericMapsTitle(name)) return name;
  }

  // Title tag
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title) {
    const name = title[1].replace(/ - Google Maps$/i, '').trim();
    if (!isGenericMapsTitle(name)) return name;
  }

  // Google Maps APP_INITIALIZATION_STATE contains the place name as a string in the JS data
  // Pattern: "0x...","Place Name" in the initialization array
  const appInit = html.match(/"0x[0-9a-f]+:[0-9a-fx]+","([^"]{2,80})"/i);
  if (appInit) return appInit[1];

  // Fallback: authuser...q=Name pattern in preload link
  const preload = html.match(/[?&]q=([^&"<>]{2,80})/);
  if (preload) return decodeURIComponent(preload[1].replace(/\+/g, ' '));

  return '';
}
