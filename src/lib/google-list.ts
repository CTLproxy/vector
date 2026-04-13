import { fetchViaProxy } from './cors-proxy';
import { ParsedPlace } from './link-parser';

export interface ParsedList {
  name: string;
  places: ParsedPlace[];
}

/**
 * Detect whether HTML from a Google Maps page represents a list/collection
 * (as opposed to a single place). Checks for the getlist link tag.
 */
export function isListPageHtml(html: string): boolean {
  return /href="[^"]*entitylist\/getlist[^"]*"/.test(html);
}

/**
 * Extract the list share token from the HTML of a Google Maps list page.
 * Looks for the token in the entitylist/getlist link's pb parameter.
 */
export function extractListToken(html: string): string | null {
  const getlistMatch = html.match(
    /entitylist\/getlist[^"]*pb=[^"]*?%211s([A-Za-z0-9_-]{10,50})/,
  );
  if (getlistMatch) return getlistMatch[1];

  // Fallback: look for placelists/list/TOKEN
  const placelistMatch = html.match(/placelists\/list\/([A-Za-z0-9_-]{10,50})/);
  return placelistMatch ? placelistMatch[1] : null;
}

/**
 * Fetch all places from a Google Maps shared list using the entitylist/getlist RPC.
 * The share token is extracted from the list page HTML, then the RPC endpoint
 * is called via CORS proxy to get structured place data.
 */
export async function fetchGoogleListPlaces(
  listPageHtml: string,
  sourceUrl: string,
): Promise<ParsedList> {
  const token = extractListToken(listPageHtml);
  if (!token) {
    throw new Error('Could not find list share token in the page.');
  }

  const getlistUrl =
    `https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=us` +
    `&pb=%211m4%211s${token}%212e1%213m1%211e1%212e2%213e2%214i500`;

  const { body } = await fetchViaProxy(getlistUrl, { accept: 'application/json' });

  // Try structured JSON parse first, fall back to regex if truncated
  const { places, listName } = parseGetlistJson(body, sourceUrl) ??
    parseGetlistRegex(body, sourceUrl);

  return { name: listName || 'Imported List', places };
}

/**
 * Try to parse the getlist response as full JSON.
 * Google prefixes with )]}\' to prevent XSSI — strip it first.
 * Returns null if parsing fails (truncated by proxy).
 */
function parseGetlistJson(
  body: string,
  sourceUrl: string,
): { places: ParsedPlace[]; listName: string } | null {
  let json = body;
  // Strip anti-XSSI prefix: )]}'  followed by newline
  const prefixIdx = json.indexOf(")]}'\n");
  if (prefixIdx !== -1) {
    json = json.substring(prefixIdx + 5);
  } else if (json.startsWith(")]}'")) {
    json = json.substring(4);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) return null;

  const places: ParsedPlace[] = [];
  const listName = extractListNameJson(parsed);

  // Entries are nested in the first element's sub-arrays
  // Structure: parsed[0][8] = [[entry1], [entry2], ...]
  // Each entry: [null, [null,null,"",null,"",[null,null,LAT,LNG],[id1,id2]], "NAME", ...]
  const root = parsed[0];
  for (let i = 0; i < root.length; i++) {
    const entries = root[i];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (!Array.isArray(entry) || entry[0] !== null) continue;
      const geo = entry[1];
      if (!Array.isArray(geo) || !Array.isArray(geo[5])) continue;
      const coordArr = geo[5];
      const lat = coordArr[2];
      const lng = coordArr[3];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

      const name =
        typeof entry[2] === 'string'
          ? entry[2].replace(/\\u0026/g, '&').replace(/\\u003d/g, '=')
          : '';
      places.push({ name, lat, lng, sourceUrl });
    }

    if (places.length > 0) break;
  }

  return { places, listName };
}

function extractListNameJson(parsed: unknown[]): string {
  try {
    const root = parsed[0] as unknown[];
    // List name is a string in the metadata portion, typically at index 4
    for (let i = 3; i < Math.min(root.length, 8); i++) {
      if (typeof root[i] === 'string' && (root[i] as string).length > 0 && (root[i] as string).length < 100) {
        return root[i] as string;
      }
    }
  } catch { /* ignore */ }
  return '';
}

/**
 * Fallback: parse truncated getlist response using regex.
 * The CORS proxy may strip the first ~512 bytes, losing the first entry.
 */
function parseGetlistRegex(
  body: string,
  sourceUrl: string,
): { places: ParsedPlace[]; listName: string } {
  const places: ParsedPlace[] = [];
  const seen = new Set<string>();

  // Each place has: [null,null,LAT,LNG],["id1","id2"]],"PLACE NAME"
  const coordRegex = /\[null,null,(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/g;
  let match;

  while ((match = coordRegex.exec(body)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Name follows after: ],["id1","id2"]],"NAME"
    const afterCoords = body.substring(
      match.index + match[0].length,
      match.index + match[0].length + 400,
    );
    const nameMatch = afterCoords.match(/,\["[^"]*","[^"]*"\]\],"([^"]+)"/);
    if (!nameMatch) continue;

    // Decode \u0026 → & and similar escapes
    const name = nameMatch[1]
      .replace(/\\u0026/g, '&')
      .replace(/\\u003d/g, '=')
      .replace(/\\u003c/g, '<')
      .replace(/\\u003e/g, '>');

    places.push({ name, lat, lng, sourceUrl });
  }

  const listName = extractListNameRegex(body);
  return { places, listName };
}

/**
 * Try to extract the list name from the getlist response.
 * In full responses: ...],"LIST NAME","",null,null,[[
 * May fail if the proxy truncated the beginning.
 */
function extractListNameRegex(body: string): string {
  const match = body.match(
    /\["[^"]+","https:\/\/lh3\.googleusercontent\.com[^"]*","[^"]*"\],"([^"]{1,100})","",null,null,\[/,
  );
  return match ? match[1] : '';
}

/**
 * Fetch a Google Maps list by URL (for sync).
 * First fetches the page to get the share token, then calls the getlist RPC.
 */
export async function fetchGoogleSavedList(url: string): Promise<ParsedList> {
  const { body: html } = await fetchViaProxy(url);
  if (!isListPageHtml(html)) {
    throw new Error('URL does not appear to be a Google Maps list.');
  }
  return fetchGoogleListPlaces(html, url);
}

/**
 * Diff a newly fetched list against existing places from that list.
 * Returns which places are new and which were removed from the remote list.
 */
export function diffListPlaces(
  remotePlaces: ParsedPlace[],
  localPlaces: { id: string; lat: number; lng: number; name: string }[],
): {
  added: ParsedPlace[];
  removed: { id: string; name: string }[];
  unchanged: number;
} {
  const COORD_TOLERANCE = 0.0005; // ~50m

  const isNear = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.abs(a.lat - b.lat) < COORD_TOLERANCE && Math.abs(a.lng - b.lng) < COORD_TOLERANCE;

  const added: ParsedPlace[] = [];
  const matchedLocalIds = new Set<string>();

  for (const remote of remotePlaces) {
    const localMatch = localPlaces.find(
      (lp) => !matchedLocalIds.has(lp.id) && isNear(remote, lp),
    );
    if (localMatch) {
      matchedLocalIds.add(localMatch.id);
    } else {
      added.push(remote);
    }
  }

  const removed = localPlaces
    .filter((lp) => !matchedLocalIds.has(lp.id))
    .map((lp) => ({ id: lp.id, name: lp.name }));

  return {
    added,
    removed,
    unchanged: matchedLocalIds.size,
  };
}
