import { useState } from 'react';
import { PlaceType } from '../types';
import { useStore } from '../store';

export default function AddPlaceForm() {
  const addingPosition = useStore((s) => s.addingPosition);
  const addPlace = useStore((s) => s.addPlace);
  const setIsAddingPlace = useStore((s) => s.setIsAddingPlace);
  const setAddingPosition = useStore((s) => s.setAddingPosition);

  const [name, setName] = useState('');
  const [type, setType] = useState<PlaceType>('restaurant');
  const [rating, setRating] = useState(4);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  if (!addingPosition) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addPlace({
      name: name.trim(),
      type,
      lat: addingPosition.lat,
      lng: addingPosition.lng,
      rating,
      tags: tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      notes: notes.trim(),
    });
  };

  const handleCancel = () => {
    setIsAddingPlace(false);
    setAddingPosition(null);
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <form className="add-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Add Place</h3>
        <p className="form-coords">
          {addingPosition.lat.toFixed(5)}, {addingPosition.lng.toFixed(5)}
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

        <input
          type="text"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
