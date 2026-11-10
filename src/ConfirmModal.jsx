import { useEffect } from 'react';
import './ConfirmModal.css';

export default function ConfirmModal({ message, onYes, onNo }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onNo();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNo]);

  return (
    <div className="modal-backdrop" onClick={onNo}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" onClick={onYes}>YES</button>
          <button type="button" onClick={onNo} autoFocus>NO</button>
        </div>
      </div>
    </div>
  );
}
