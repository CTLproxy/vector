import { useState } from 'react';
import { PlaceType } from '../types';
import { useStore } from '../store';
import {
  parseMapLink,
  isShortUrl,
  extractMapUrlFromHtml,
  extractNameFromHtml,
  extractCoordsFromHtml,
  ParsedPlace,
} from '../lib/link-parser';
import { fetchViaProxy, extractProxiedUrl, CaptchaError } from '../lib/cors-proxy';
import RatingInput from './RatingInput';
import { isListPageHtml, fetchGoogleListPlaces } from '../lib/google-list';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Extract a place query from URLs in a redirect chain (?q=... parameter) */
function extractQueryFromChain(chain?: string[]): string | null {
  if (!chain) return null;
  for (const url of chain) {
    try {
      const u = new URL(url);
      const q = u.searchParams.get('q');
      if (q && q.length > 2) return q;
    } catch { /* ignore */ }
  }
  return null;
}

/** Geocode a text query via Nominatim, returns { lat, lng } or null */
async function geocodeQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({ q: query, format: 'json', limit: '1' });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'Accept-Language': 'en' },
    });
    if (!res.ok) return null;
    const data: { lat: string; lon: string }[] = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

type Step = 'paste' | 'resolving' | 'confirm' | 'confirm-list' | 'captcha' | 'error';

export default function ImportLinkModal({ onClose }: { onClose: () => void }) {
  const addPlace = useStore((s) => s.addPlace);
  const addPlaces = useStore((s) => s.addPlaces);
  const addSavedList = useStore((s) => s.addSavedList);

  const [link, setLink] = useState('');
  const [step, setStep] = useState<Step>('paste');
  const [error, setError] = useState('');

  // Single place state
  const [parsed, setParsed] = useState<ParsedPlace | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaceType>('restaurant');
  const [rating, setRating] = useState(4);
  const [tags, setTags] = useState('');

  // List import state
  const [listPlaces, setListPlaces] = useState<ParsedPlace[]>([]);
  const [listName, setListName] = useState('');
  const [listType, setListType] = useState<PlaceType>('restaurant');
  const [listRating, setListRating] = useState(4);





  const handlePaste = async () => {
    const input = link.trim();
    if (!input) return;

    // Try direct parse first (full URLs with coords)
    const direct = parseMapLink(input);
    if (direct) {
      setParsed(direct);
      setName(direct.name);
      setStep('confirm');
      return;
    }

    // Short URL — resolve via proxy
    if (isShortUrl(input)) {
      setStep('resolving');
      try {
        const { body: html, responseUrl, redirectChain } = await fetchViaProxy(input);

        // Check if this is a list page
        if (isListPageHtml(html)) {
          try {
            const list = await fetchGoogleListPlaces(html, input);
            if (list.places.length === 0) {
              setError('This list appears to be empty or could not be parsed.');
              setStep('error');
              return;
            }
            setListPlaces(list.places);
            setListName(list.name);
            setStep('confirm-list');
            return;
          } catch (err) {
            if (err instanceof CaptchaError) {
              setStep('captcha');
              return;
            }
            setError(`Failed to import list: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setStep('error');
            return;
          }
        }

        // Try parsing the final URL and each URL in the redirect chain
        const urlsToTry = [responseUrl, ...(redirectChain || [])];
        for (const u of urlsToTry) {
          const parsed = parseMapLink(u);
          if (parsed) {
            if (!parsed.name) parsed.name = extractNameFromHtml(html);
            parsed.sourceUrl = input;
            setParsed(parsed);
            setName(parsed.name);
            setStep('confirm');
            return;
          }
        }

        // Try extracting from the external proxy URL format
        const proxiedUrl = extractProxiedUrl(responseUrl);
        if (proxiedUrl && proxiedUrl !== input) {
          const fromProxy = parseMapLink(proxiedUrl);
          if (fromProxy) {
            if (!fromProxy.name) fromProxy.name = extractNameFromHtml(html);
            fromProxy.sourceUrl = input;
            setParsed(fromProxy);
            setName(fromProxy.name);
            setStep('confirm');
            return;
          }
        }

        // Strategy: Extract a full Maps URL from the returned HTML
        const resolvedUrl = extractMapUrlFromHtml(html);
        if (resolvedUrl) {
          const result = parseMapLink(resolvedUrl);
          if (result) {
            if (!result.name) result.name = extractNameFromHtml(html);
            result.sourceUrl = input;
            setParsed(result);
            setName(result.name);
            setStep('confirm');
            return;
          }
        }

        // Strategy: Geocode using the place query from the redirect chain
        // (Google Maps short links redirect through ?q=Place+Name URLs)
        const placeQuery = extractQueryFromChain(redirectChain);
        if (placeQuery) {
          const geocoded = await geocodeQuery(placeQuery);
          if (geocoded) {
            const placeName = extractNameFromHtml(html) || placeQuery.split(',')[0].trim();
            const result: ParsedPlace = { name: placeName, ...geocoded, sourceUrl: input };
            setParsed(result);
            setName(result.name);
            setStep('confirm');
            return;
          }
        }

        // Last resort: Extract coordinates directly from HTML/JS data
        // (may be inaccurate when fetched from a server in another region)
        const coords = extractCoordsFromHtml(html);
        if (coords) {
          const coordName = extractNameFromHtml(html);
          const result: ParsedPlace = { name: coordName, ...coords, sourceUrl: input };
          setParsed(result);
          setName(coordName);
          setStep('confirm');
          return;
        }

        setError('Could not extract place data from this link. Try pasting the full (non-shortened) URL.');
        setStep('error');
      } catch (err) {
        if (err instanceof CaptchaError) {
          setStep('captcha');
          return;
        }
        setError(`Failed to resolve link: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setStep('error');
      }
      return;
    }

    setError(
      'Unrecognized link format. Supported:\n• Google Maps place link\n• Apple Maps link\n• Raw coordinates (lat, lng)',
    );
    setStep('error');
  };

  const handleConfirmSingle = () => {
    if (!parsed || !name.trim()) return;
    addPlace({
      name: name.trim(),
      type,
      lat: parsed.lat,
      lng: parsed.lng,
      rating,
      tags: tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      notes: '',
      sourceUrl: parsed.sourceUrl,
    });
    onClose();
  };

  const handleConfirmList = () => {
    if (listPlaces.length === 0) return;
    const savedList = addSavedList({
      name: listName || 'Imported List',
      url: link.trim(),
      lastSyncedAt: Date.now(),
      placeCount: listPlaces.length,
    });
    addPlaces(
      listPlaces.map((p) => ({
        name: p.name,
        type: listType,
        lat: p.lat,
        lng: p.lng,
        rating: listRating,
        tags: [],
        notes: '',
        sourceUrl: p.sourceUrl,
        sourceListId: savedList.id,
      })),
    );
    onClose();
  };



  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        {step === 'paste' && (
          <>
            <h3>Import from Link</h3>
            <p className="settings-hint">
              Paste a Google Maps or Apple Maps share link, or raw coordinates.
            </p>
            <textarea
              className="import-input"
              placeholder="https://maps.app.goo.gl/... or https://maps.apple.com/..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="form-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handlePaste} disabled={!link.trim()}>
                Import
              </button>
            </div>
          </>
        )}

        {step === 'resolving' && (
          <div className="import-status">
            <div className="spinner" />
            <p>Resolving link…</p>
          </div>
        )}

        {step === 'confirm' && parsed && (
          <>
            <h3>Add Place</h3>
            <p className="form-coords">
              {parsed.lat.toFixed(5)}, {parsed.lng.toFixed(5)}
            </p>
            <input
              type="text"
              placeholder="Place name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <div className="form-row">
              <select value={type} onChange={(e) => setType(e.target.value as PlaceType)}>
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="cafe">Cafe</option>
              </select>
              <RatingInput value={rating} onChange={setRating} />
            </div>
            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <div className="form-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleConfirmSingle} disabled={!name.trim()}>
                Save
              </button>
            </div>
          </>
        )}

        {step === 'confirm-list' && listPlaces.length > 0 && (
          <>
            <h3>Import List</h3>
            <input
              type="text"
              placeholder="List name"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              autoFocus
            />
            <p className="settings-hint">
              {listPlaces.length} place{listPlaces.length !== 1 ? 's' : ''} found.
              All will be imported with the type and rating below.
            </p>
            <div className="list-preview-items">
              {listPlaces.map((p, i) => (
                <div key={i} className="list-preview-item">
                  <span className="list-preview-name">{p.name}</span>
                  <span className="list-preview-coords">
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
            <div className="form-row">
              <select value={listType} onChange={(e) => setListType(e.target.value as PlaceType)}>
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="cafe">Cafe</option>
              </select>
              <RatingInput value={listRating} onChange={setListRating} />
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleConfirmList}>
                Import {listPlaces.length} Places
              </button>
            </div>
          </>
        )}

        {step === 'captcha' && (
          <>
            <h3>Temporarily Blocked</h3>
            <p className="settings-hint">
              Google is blocking requests from the proxy server. This usually resolves on its own — wait a minute and retry.
            </p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={() => setStep('paste')}>
                Retry
              </button>
            </div>
          </>
        )}

        {step === 'error' && (
          <>
            <h3>Import Failed</h3>
            <p className="error-text">{error}</p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={() => setStep('paste')}>
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
