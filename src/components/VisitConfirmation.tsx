import { PendingVisit } from '../types';
import { useStore } from '../store';

interface Props {
  pendingVisits: PendingVisit[];
  onDismiss: (placeId: string) => void;
  onDone: () => void;
}

export default function VisitConfirmation({ pendingVisits, onDismiss, onDone }: Props) {
  const markVisited = useStore((s) => s.markVisited);
  const places = useStore((s) => s.places);

  if (pendingVisits.length === 0) return null;

  const handleVisited = (placeId: string) => {
    markVisited(placeId);
    onDismiss(placeId);
  };

  const handleNo = (placeId: string) => {
    onDismiss(placeId);
  };

  return (
    <div className="modal-overlay">
      <div className="visit-confirmation">
        <h3>Welcome back!</h3>
        <p className="visit-confirmation-hint">Did you visit these places?</p>
        <div className="visit-confirmation-list">
          {pendingVisits.map((pv) => {
            const place = places.find((p) => p.id === pv.placeId);
            const name = place?.name ?? pv.placeName;
            return (
              <div key={pv.placeId} className="visit-confirmation-item">
                <div className="visit-confirmation-info">
                  <span className="visit-confirmation-name">{name}</span>
                  <span className="visit-confirmation-date">
                    Navigated {new Date(pv.navigatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="visit-confirmation-actions">
                  <button className="btn-visited-sm" onClick={() => handleVisited(pv.placeId)}>
                    ✓ Yes
                  </button>
                  <button className="btn-secondary" onClick={() => handleNo(pv.placeId)}>
                    No
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn-secondary close-btn" onClick={onDone}>
          Dismiss All
        </button>
      </div>
    </div>
  );
}
