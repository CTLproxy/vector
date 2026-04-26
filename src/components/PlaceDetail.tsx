import { useState } from 'react';
import { PlaceType } from '../types';
import { useStore } from '../store';
import { addPendingVisit } from '../lib/storage';
import RatingInput from './RatingInput';

export default function PlaceDetail() {
  const selectedPlaceId = useStore((s) => s.selectedPlaceId);
  const places = useStore((s) => s.places);
  const savedLists = useStore((s) => s.savedLists);
  const updatePlace = useStore((s) => s.updatePlace);
  const deletePlace = useStore((s) => s.deletePlace);
  const setSelectedPlaceId = useStore((s) => s.setSelectedPlaceId);
  const favMode = useStore((s) => s.favMode);
  const markVisited = useStore((s) => s.markVisited);
  const clearVisited = useStore((s) => s.clearVisited);

  const place = places.find((p) => p.id === selectedPlaceId);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaceType>('restaurant');
  const [rating, setRating] = useState(4);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  if (!place) return null;

  const startEdit = () => {
    setName(place.name);
    setType(place.type);
    setRating(place.rating);
    setTags(place.tags.join(', '));
    setNotes(place.notes);
    setEditing(true);
  };

  const handleSave = () => {
    updatePlace(place.id, {
      name: name.trim(),
      type,
      rating,
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      notes: notes.trim(),
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`Delete "${place.name}"?`)) {
      deletePlace(place.id);
    }
  };

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

  return (
    <div className="modal-overlay" onClick={() => setSelectedPlaceId(null)}>
      <div className="place-detail" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <div className="form-row">
              <select value={type} onChange={(e) => setType(e.target.value as PlaceType)}>
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="cafe">Cafe</option>
              </select>
              <RatingInput value={rating} onChange={setRating} />
            </div>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave}>Save</button>
            </div>
          </>
        ) : (
          <>
            <h3>{place.name}</h3>
            <p className={`place-type type-${place.type}`}>{place.type}</p>
            {favMode ? (
              <p className="place-rating fav-display">
                <button
                  className={`fav-toggle ${place.rating >= 5 ? 'is-fav' : ''}`}
                  onClick={() => updatePlace(place.id, { rating: place.rating >= 5 ? 1 : 5 })}
                >
                  {place.rating >= 5 ? '❤️' : '♡'}
                </button>
                {place.rating >= 5 ? ' Favourite' : ' Not favourite'}
              </p>
            ) : (
              <p className="place-rating">{'★'.repeat(place.rating)}{'☆'.repeat(5 - place.rating)}</p>
            )}
            {place.tags.length > 0 && (
              <div className="place-tags">
                {place.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            )}
            {place.notes && <p className="place-notes">{place.notes}</p>}
            {place.sourceUrl && (
              <a className="source-link" href={place.sourceUrl} target="_blank" rel="noopener noreferrer">
                View on Maps ↗
              </a>
            )}
            {place.sourceListId && (() => {
              const list = savedLists.find((l) => l.id === place.sourceListId);
              return list ? <p className="source-list-badge">📋 {list.name}</p> : null;
            })()}
            {place.visitedAt && (
              <div className="visited-badge">
                <span>✓ Visited {new Date(place.visitedAt).toLocaleDateString()}</span>
                <button className="btn-clear-visited" onClick={() => clearVisited(place.id)}>
                  Remove
                </button>
              </div>
            )}
            {place.skipped && (
              <p className="skipped-badge">✕ Skipped</p>
            )}
            <div className="form-actions">
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
              <button className="btn-secondary" onClick={startEdit}>Edit</button>
              {!place.visitedAt && (
                <button className="btn-visited-sm" onClick={() => markVisited(place.id)}>
                  ✓ Visited
                </button>
              )}
              <a
                className="btn-primary nav-link"
                href={navUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => addPendingVisit(place.id, place.name)}
              >
                Navigate ↗
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
