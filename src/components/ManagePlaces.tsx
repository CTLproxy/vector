import { useState, useMemo, useEffect } from 'react';
import { Place, PlaceType } from '../types';
import { useStore } from '../store';
import { haversineKm } from '../lib/scoring';
import RatingInput from './RatingInput';

type SortKey = 'name' | 'type' | 'rating' | 'created';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const CLUSTER_RADIUS_KM = 15;

interface PlaceCluster {
  label: string;
  centroidLat: number;
  centroidLng: number;
  places: Place[];
}

/** Simple leader-based clustering */
function clusterPlaces(places: Place[], radiusKm: number): PlaceCluster[] {
  const clusters: { lat: number; lng: number; places: Place[] }[] = [];

  for (const p of places) {
    let assigned = false;
    for (const c of clusters) {
      if (haversineKm({ lat: c.lat, lng: c.lng }, { lat: p.lat, lng: p.lng }) <= radiusKm) {
        c.places.push(p);
        // Update centroid
        const n = c.places.length;
        c.lat = c.lat + (p.lat - c.lat) / n;
        c.lng = c.lng + (p.lng - c.lng) / n;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      clusters.push({ lat: p.lat, lng: p.lng, places: [p] });
    }
  }

  return clusters.map((c) => ({
    label: '',
    centroidLat: c.lat,
    centroidLng: c.lng,
    places: c.places,
  }));
}

/** Reverse geocode a lat/lng to a city/town name */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      zoom: '10',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'Accept-Language': 'en' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const addr = data.address;
    return addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || '';
  } catch {
    return '';
  }
}

interface Props {
  onClose: () => void;
}

export default function ManagePlaces({ onClose }: Props) {
  const places = useStore((s) => s.places);
  const updatePlace = useStore((s) => s.updatePlace);
  const deletePlace = useStore((s) => s.deletePlace);
  const favMode = useStore((s) => s.favMode);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [filterType, setFilterType] = useState<PlaceType | ''>('');
  const [groupByLocation, setGroupByLocation] = useState(false);
  const [clusterLabels, setClusterLabels] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<PlaceType>('restaurant');
  const [editRating, setEditRating] = useState(3);
  const [editTags, setEditTags] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Filter and sort
  const filtered = useMemo(() => {
    let list = places;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.type.includes(q) ||
          p.tags.some((t) => t.includes(q)) ||
          p.notes.toLowerCase().includes(q),
      );
    }
    if (filterType) {
      list = list.filter((p) => p.type === filterType);
    }

    const sorted = [...list];
    switch (sortKey) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'type':
        sorted.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
        break;
      case 'created':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }
    return sorted;
  }, [places, search, filterType, sortKey]);

  // Clustering
  const clusters = useMemo(() => {
    if (!groupByLocation) return null;
    return clusterPlaces(filtered, CLUSTER_RADIUS_KM);
  }, [filtered, groupByLocation]);

  // Reverse geocode cluster centroids
  useEffect(() => {
    if (!clusters) return;
    let cancelled = false;
    const toGeocode = clusters.filter(
      (c) => !clusterLabels[`${c.centroidLat.toFixed(2)},${c.centroidLng.toFixed(2)}`],
    );
    // Fetch sequentially to respect Nominatim rate limits
    (async () => {
      for (const c of toGeocode) {
        if (cancelled) break;
        const key = `${c.centroidLat.toFixed(2)},${c.centroidLng.toFixed(2)}`;
        const name = await reverseGeocode(c.centroidLat, c.centroidLng);
        if (!cancelled && name) {
          setClusterLabels((prev) => ({ ...prev, [key]: name }));
        }
        // Rate limit: 1 req/sec
        await new Promise((r) => setTimeout(r, 1100));
      }
    })();
    return () => { cancelled = true; };
  }, [clusters, clusterLabels]);

  const startEdit = (p: Place) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditType(p.type);
    setEditRating(p.rating);
    setEditTags(p.tags.join(', '));
    setEditNotes(p.notes);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updatePlace(editingId, {
      name: editName.trim(),
      type: editType,
      rating: editRating,
      tags: editTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      notes: editNotes.trim(),
    });
    setEditingId(null);
  };

  const handleDelete = (p: Place) => {
    if (confirm(`Delete "${p.name}"?`)) {
      deletePlace(p.id);
    }
  };

  const renderPlaceRow = (p: Place) => {
    if (editingId === p.id) {
      return (
        <div key={p.id} className="manage-row manage-row-edit">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
          <div className="manage-edit-row">
            <select value={editType} onChange={(e) => setEditType(e.target.value as PlaceType)}>
              <option value="restaurant">Restaurant</option>
              <option value="bar">Bar</option>
              <option value="cafe">Cafe</option>
            </select>
            <RatingInput value={editRating} onChange={setEditRating} />
          </div>
          <input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="Tags (comma separated)" />
          <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Notes" />
          <div className="manage-row-actions">
            <button className="btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
            <button className="btn-primary btn-sm" onClick={saveEdit}>Save</button>
          </div>
        </div>
      );
    }

    return (
      <div key={p.id} className="manage-row">
        <div className="manage-row-main" onClick={() => startEdit(p)}>
          <div className="manage-row-header">
            <span className="place-name">{p.name}</span>
            <span className={`place-type type-${p.type}`}>{p.type}</span>
          </div>
          <div className="manage-row-meta">
            <span className="place-rating">
              {favMode
                ? (p.rating >= 5 ? '❤️' : '♡')
                : '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating)}
            </span>
            {p.tags.length > 0 && (
              <span className="manage-tags">
                {p.tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </span>
            )}
          </div>
        </div>
        <button className="manage-delete-btn" onClick={() => handleDelete(p)} title="Delete">
          ✕
        </button>
      </div>
    );
  };

  return (
    <div className="manage-overlay">
      <div className="manage-panel">
        <div className="manage-header">
          <h3>Manage Places</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* Search */}
        <input
          className="manage-search"
          type="text"
          placeholder="Search places…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {/* Controls bar */}
        <div className="manage-controls">
          <div className="manage-sort">
            {(['name', 'type', 'rating', 'created'] as SortKey[]).map((k) => (
              <button
                key={k}
                className={`sort-btn ${sortKey === k ? 'active' : ''}`}
                onClick={() => setSortKey(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="manage-filters">
            <button
              className={`filter-chip ${filterType === '' ? 'active' : ''}`}
              onClick={() => setFilterType('')}
            >
              All
            </button>
            {(['restaurant', 'bar', 'cafe'] as PlaceType[]).map((t) => (
              <button
                key={t}
                className={`filter-chip ${filterType === t ? 'active' : ''}`}
                onClick={() => setFilterType(filterType === t ? '' : t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Group toggle */}
        <label className="toggle-label manage-group-toggle">
          <input
            type="checkbox"
            checked={groupByLocation}
            onChange={(e) => setGroupByLocation(e.target.checked)}
          />
          Group by location
        </label>

        {/* Place count */}
        <p className="settings-hint">{filtered.length} of {places.length} places</p>

        {/* Place list */}
        <div className="manage-list">
          {groupByLocation && clusters ? (
            clusters.map((cluster, ci) => {
              const key = `${cluster.centroidLat.toFixed(2)},${cluster.centroidLng.toFixed(2)}`;
              const label = clusterLabels[key] || `Area ${ci + 1}`;
              return (
                <div key={ci} className="manage-cluster">
                  <div className="manage-cluster-header">
                    <span className="manage-cluster-name">📍 {label}</span>
                    <span className="manage-cluster-count">{cluster.places.length} place{cluster.places.length !== 1 ? 's' : ''}</span>
                  </div>
                  {cluster.places.map(renderPlaceRow)}
                </div>
              );
            })
          ) : (
            filtered.map(renderPlaceRow)
          )}
          {filtered.length === 0 && (
            <p className="empty-state">No places match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
