import { useState, useEffect, useRef } from 'react';
import { sample } from 'lodash';
import './App.css';
import { useBleSocket } from './useBleSocket';
import Beyblade from './Beyblade';
import InfoPanel from './InfoPanel';
import VoiceFlare from './VoiceFlare';

const IDLE_AFTER_MS = {
  dropped: 10000,
  launched: 15000,
};

async function requestRecordings() {
  const res = await fetch('/api/recordings', { method: 'POST' });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error);

  if (data.message === 'REQ SENT!') {
    console.log('Requested Recordings!');
    return true;
  }
  return false;
}

function getBeyStatus(recording, wsStatus, device, isExpired) {
  if (wsStatus !== 'open' || device !== 'connected') return 'disconnected';
  if (!recording || recording.status === 'reset' || isExpired) return 'idle';
  if (recording.status === 'launched') {
    return recording.launchesValues.at(-1) < 5000 ? 'spin_slow' : 'spin_fast';
  }
  return recording.status;
}

const toggleFullSceen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

function App() {
  const [expiredRecording, setExpiredRecording] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [battery, setBattery] = useState(undefined);
  const [requested, setRequested] = useState(false);

  const voiceRef = useRef(null);

  // with AI we generate the line via TTS, otherwise we play the prerecorded clip
  const say = (text, clip) => {
    if (aiEnabled) {
      voiceRef.current?.playTTS(text);
    } else {
      voiceRef.current?.playClip(clip);
    }
  };

  const { wsStatus, device, recording, clearRecording } = useBleSocket({
    onRecording: (rec) => {
      if (rec.battery != null && (rec.status === 'history' || rec.status === 'attached')) {
        setBattery(Math.floor(rec.battery));
      }

      if (rec.status === 'attached') {
        say(...sample([['3, 2, 1, go shoot!!!', 'shoot1'], ['Let it rip!!!', 'shoot2']]));
      } else if (rec.status === 'dropped') {
        say('Did you just drop your beyblade?', 'drop');
      } else if (rec.status === 'reset') {
        say('Reset successful!', 'reset');
      } else if (rec.status === 'history') {
        say('LP data loaded successfully!', 'load');
      }
    },
    // the backend sends a sentence when AI is on, or a clip name when it's off
    onComment: (comment) => say(comment, comment),
  });

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => setAiEnabled(cfg.aiEnabled));
  }, []);

  useEffect(() => {
    if (device === 'connected') {
      requestRecordings().then(setRequested).catch(console.error);
    } else {
      setRequested(false);
    }
  }, [device]);

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
          <div className="side-panel-top" aria-hidden="true"></div>
          <div className="side-panel-bottom" aria-hidden="true"></div>

          {/* title */}
          <div className="title-plate">
            <div className="title-pill" onClick={toggleFullSceen}>
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
              <div className="gauge-label gauge-label--top">{battery ?? '--'}</div>
              <div className="gauge-label gauge-label--bottom">{battery ?? '--'}</div>
            </div>
          </div>

          <div className="main-panel">
            <div className="beyblade-side">
              <Beyblade status={beyStatus} />
            </div>
            <InfoPanel recording={recording} requested={requested} />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
