import { useEffect, useState } from 'react';
import './ConfirmModal.css';
import './InfoPanel.css';
import './ActionsModal.css';

function Toggle({ label, checked, onChange }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="toggle"
        onClick={onChange}
      >
        <span className="toggle__knob" />
      </button>
    </div>
  );
}

export default function ActionsModal({ competitive, canManageDevice, onToggleCompetitive, mute, onToggleMute, onReset, onDisconnect, onClose }) {
  const isElectron = navigator.userAgent.includes('Electron');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullSceen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

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
          {!isElectron && (
            <Toggle label="FULLSCREEN" checked={isFullscreen} onChange={toggleFullSceen} />
          )}
          <Toggle label="MUTE DIZZI" checked={mute} onChange={onToggleMute} />
          <Toggle label="COMPETITIVE MODE" checked={competitive} onChange={onToggleCompetitive} />
          {canManageDevice && <>
            <button type="button" onClick={onReset}>CLEAR LAUNCH RECORDS</button>
            <button type="button" onClick={onDisconnect}>DISCONNECT DEVICE</button>
          </>}
        </div>
      </div>
    </div>
  );
}
