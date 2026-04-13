import { useState } from 'react';
import { PlaceType } from '../types';
import { useStore } from '../store';

export default function PlaceDetail() {
  const selectedPlaceId = useStore((s) => s.selectedPlaceId);
  const places = useStore((s) => s.places);
  const updatePlace = useStore((s) => s.updatePlace);
  const deletePlace = useStore((s) => s.deletePlace);
  const setSelectedPlaceId = useStore((s) => s.setSelectedPlaceId);

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
              <div className="rating-input">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`star-btn ${v <= rating ? 'filled' : ''}`}
                    onClick={() => setRating(v)}
                  >
                    ★
                  </button>
                ))}
              </div>
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
            <p className="place-rating">{'★'.repeat(place.rating)}{'☆'.repeat(5 - place.rating)}</p>
            {place.tags.length > 0 && (
              <div className="place-tags">
                {place.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            )}
            {place.notes && <p className="place-notes">{place.notes}</p>}
            <div className="form-actions">
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
              <button className="btn-secondary" onClick={startEdit}>Edit</button>
              <a className="btn-primary nav-link" href={navUrl} target="_blank" rel="noopener noreferrer">
                Navigate ↗
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
