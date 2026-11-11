import { useEffect } from 'react';
import './ConfirmModal.css';
import './InfoPanel.css';
import './ActionsModal.css';

export default function ActionsModal({ onReset, onDisconnect, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="terminal-window actions-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="terminal-titlebar">
          <span
            className="terminal-btn terminal-btn--close"
            aria-label="Close"
            onClick={onClose}>✕</span>
        </div>
        <div className="terminal actions-modal__body">
          <button type="button" onClick={onReset}>CLEAR LAUNCH RECORDS</button>
          <button type="button" onClick={onDisconnect}>DISCONNECT DEVICE</button>
        </div>
      </div>
    </div>
  );
}
