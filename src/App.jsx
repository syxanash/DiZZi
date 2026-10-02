import { useState, useEffect, useRef } from 'react';
import './App.css';
import { useBleSocket } from './useBleSocket';
import Beyblade from './Beyblade';
import InfoPanel from './InfoPanel';
import VoiceFlare from './VoiceFlare';

const IDLE_AFTER_MS = {
  dropped: 5000,
  launched: 10000,
};

function getBeyStatus(recording, wsStatus, device, isExpired) {
  if (wsStatus !== 'open' || device !== 'connected' ) return 'disconnected';
  if (!recording || recording.status === 'reset' || isExpired) return 'idle';
  if (recording.status === 'launched') {
    return recording.launchesValues.at(-1) < 5000 ? 'spin_slow' : 'spin_fast';
  }
  return recording.status;
}

function App() {
  // the recording whose animation already timed out back to idle
  const [expiredRecording, setExpiredRecording] = useState(null);
  const voiceRef = useRef(null);
  const { wsStatus, device, recording, clearRecording } = useBleSocket({
    onRecording: (rec) => {
      if (rec.status === 'attached') {
        voiceRef.current?.playTTS('3, 2, 1, go shoot!!!');
      } else if (rec.status === 'dropped') {
        voiceRef.current?.playTTS('Did you just drop your beyblade?');
      } else if (rec.status === 'launched') {
        const lastLaunch = rec.launchesValues.at(-1);

        voiceRef.current?.playTTS(lastLaunch < 5000
          ? 'that was a very sloppy launch!'
          : 'wow fast launch right there!');
      }
    },
  });

  useEffect(() => {
    const delay = IDLE_AFTER_MS[recording?.status];
    if (!delay) return;

    const idleTimeout = setTimeout(() => setExpiredRecording(recording), delay);
    return () => clearTimeout(idleTimeout);
  }, [recording]);

  const beyStatus = getBeyStatus(recording, wsStatus, device, expiredRecording === recording);

  async function sendResetRequest() {
    const res = await fetch('/api/reset', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    if (data.message === 'RESET OK!') {
      clearRecording();
    }
  }

  return (
    <>
      <div className="stage">
        {/* glowing perspective grid */}
        <div className="grid-bg" aria-hidden="true"></div>

        {/* HUD chrome */}
        <div className="hud">
          {/* decorative panel behind the title / gauge / ai-tab (style only) */}
          <div className="side-panel" aria-hidden="true"></div>

          {/* title */}
          <div className="title-plate">
            <div className="title-pill">
              <span className="title-text">DiZZi<span className="dot">.</span><span className="ver">02</span></span>
            </div>
          </div>

          {/* little crosshair glyph */}
          <div className="crosshair" aria-hidden="true" onClick={sendResetRequest}>
            <span></span><span></span>
          </div>

          {/* ai interface tab */}
          <div className="ai-tab">
            <span className="ai-tab__big">ai</span>
            <span className="ai-tab__small">INTERFACE</span>
          </div>

          {/* circular gauge */}
          <div className="gauge">
            <div className="gauge-bezel">
              <div className="gauge-ring">
                <div className="gauge-lens">
                  <VoiceFlare ref={voiceRef} />
                </div>
              </div>
              <div className="gauge-label gauge-label--top">100</div>
              <div className="gauge-label gauge-label--bottom">100</div>
            </div>
          </div>

          <div className="main-panel">
            <div className="beyblade-side">
              <Beyblade status={beyStatus} />
            </div>
            <InfoPanel recording={recording} />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
