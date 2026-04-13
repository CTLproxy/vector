import { PlaceType } from '../types';
import { useStore } from '../store';
import { useMemo } from 'react';

const ALL_TYPES: PlaceType[] = ['restaurant', 'bar', 'cafe'];

export default function FilterBar() {
  const places = useStore((s) => s.places);
  const filter = useStore((s) => s.filter);
  const setFilterTypes = useStore((s) => s.setFilterTypes);
  const setFilterTags = useStore((s) => s.setFilterTags);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    places.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [places]);

  const toggleType = (type: PlaceType) => {
    const next = filter.types.includes(type)
      ? filter.types.filter((t) => t !== type)
      : [...filter.types, type];
    setFilterTypes(next);
  };

  const toggleTag = (tag: string) => {
    const next = filter.tags.includes(tag)
      ? filter.tags.filter((t) => t !== tag)
      : [...filter.tags, tag];
    setFilterTags(next);
  };

  return (
    <div className="filter-bar">
      <div className="filter-group">
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            className={`filter-chip ${filter.types.includes(type) ? 'active' : ''}`}
            onClick={() => toggleType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      {allTags.length > 0 && (
        <div className="filter-group">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`filter-chip tag-chip ${filter.tags.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
