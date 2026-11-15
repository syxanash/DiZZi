import { useState, useEffect, useEffectEvent, useRef } from 'react';
import { sample } from 'lodash';
import './App.css';
import { useBleSocket } from './useBleSocket';
import Beyblade from './Beyblade';
import InfoPanel from './InfoPanel';
import VoiceFlare from './VoiceFlare';
import ConfirmModal from './ConfirmModal';
import ActionsModal from './ActionsModal';

// prerecorded clips from scripts/generate-clips.mjs
const RESULT_CLIPS = {
  1: ['win_p1_1', 'win_p1_2', 'win_p1_3'],
  2: ['win_p2_1', 'win_p2_2', 'win_p2_3'],
  draw: ['draw_1', 'draw_2'],
};

const IDLE_AFTER_MS = {
  dropped: 10000,
  launched: 15000,
};

async function requestRecordings(deviceId) {
  const res = await fetch('/api/recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error);

  if (data.message === 'REQ SENT!') {
    console.log('Requested Recordings!');
    return true;
  }
  return false;
}

function getBeyStatus(recording, wsStatus, device, isExpired, goodLaunchRpm) {
  if (wsStatus !== 'open' || device !== 'connected') return 'disconnected';
  if (!recording || recording.status === 'reset' || isExpired) return 'idle';
  if (recording.status === 'launched') {
    return recording.launchesValues.at(-1) >= goodLaunchRpm ? 'spin_fast' : 'spin_slow';
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
  const [goodLaunchRpm, setGoodLaunchRpm] = useState(null);
  const [battery, setBattery] = useState(undefined);
  const [requested, setRequested] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [competitive, setCompetitive] = useState(false);
  const [round, setRound] = useState({});

  const ask = (message, action) => setConfirm({ message, action });

  const voiceRef = useRef(null);

  const say = (text, clip) => {
    if (competitive) return;

    if (aiEnabled) {
      voiceRef.current?.playTTS(text);
    } else {
      voiceRef.current?.playClip(clip);
    }
  };

  async function sendDisconnect(deviceId) {
    const res = await fetch('/api/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    setBattery(undefined);
    setExpiredRecording(null);
  }

  const requestedIds = useRef(new Set());

  const { wsStatus, device, recording, recordings, clearRecording, devices } = useBleSocket({
    onRecording: (rec) => {
      if (competitive && rec.slot) {
        if (rec.status === 'launched') {
          setRound((r) => ({ ...r, [rec.slot]: rec.launchesValues.at(-1) }));
        } else if (rec.status === 'attached') {
          setRound((r) => (r[1] != null && r[2] != null ? {} : r));
        }
      }

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
      .then((cfg) => {
        setAiEnabled(cfg.aiEnabled);
        setGoodLaunchRpm(cfg.goodLaunchRpm);
      });

    fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitive: false }),
    }).catch(console.error);
  }, []);

  if (device !== 'connected' && requested) setRequested(false);

  useEffect(() => {
    const list = Object.values(devices);
    if (list.length === 0) requestedIds.current.clear();

    for (const d of list) {
      if (d.status !== 'connected') {
        requestedIds.current.delete(d.id);
      } else if (!requestedIds.current.has(d.id)) {
        requestedIds.current.add(d.id);
        requestRecordings(d.id).then(setRequested).catch(console.error);
      }
    }
  }, [devices]);

  useEffect(() => {
    const delay = IDLE_AFTER_MS[recording?.status];
    if (!delay) return;

    const idleTimeout = setTimeout(() => setExpiredRecording(recording), delay);
    return () => clearTimeout(idleTimeout);
  }, [recording]);

  const connectedCount = Object.values(devices).filter((d) => d.status === 'connected').length;

  const roundDone = round[1] != null && round[2] != null && connectedCount === 2;
  const winner = !roundDone ? null
    : round[1] === round[2] ? 'draw'
      : round[1] > round[2] ? 1 : 2;

  // the round result is the only thing the voice says in competitive mode
  const announceResult = useEffectEvent((result) => {
    if (aiEnabled) {
      const text = result === 'draw'
        ? `It's a draw! Both at ${round[1]} RPM!`
        : `Player ${result} wins by ${Math.abs(round[1] - round[2])} RPM!`;
      voiceRef.current?.playTTS(text);
    } else {
      voiceRef.current?.playClip(sample(RESULT_CLIPS[result]));
    }
  });

  useEffect(() => {
    if (winner) announceResult(winner);
  }, [winner]);

  const beyStatus = getBeyStatus(recording, wsStatus, device, expiredRecording === recording, goodLaunchRpm);

  // switching mode starts from a clean slate: drop every connected Battle Pass
  async function switchMode() {
    const next = !competitive;

    const connected = Object.values(devices).filter((d) => d.status === 'connected');
    for (const d of connected) {
      await sendDisconnect(d.id).catch(console.error);
    }

    await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitive: next }),
    }).catch(console.error);

    setCompetitive(next);
    setRound({});
  }

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
          <div className="crosshair" aria-label="Options" onClick={() => setActionsOpen(true)}>
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
              <div className="gauge-label gauge-label--top">{competitive ? '--' : battery ?? '--'}</div>
              <div className="gauge-label gauge-label--bottom">{competitive ? '--' : battery ?? '--'}</div>
            </div>
          </div>

          <div className="main-panel">
            {competitive ? (
              [1, 2].map((slot) => {
                const dev = devices[slot];
                const connected = dev?.status === 'connected';
                return (
                  <InfoPanel
                    key={slot}
                    player={slot}
                    result={!winner ? null : winner === 'draw' ? 'draw' : winner === slot ? 'win' : 'lose'}
                    recording={recordings[slot]}
                    requested={connected}
                    waitingText={connected ? null : `WAITING FOR PLAYER ${slot}`}
                    onClose={() => connected && ask(`Disconnect player ${slot}?`, () => sendDisconnect(dev.id))}
                  />
                );
              })
            ) : (
              <>
                <div className="beyblade-side">
                  <Beyblade status={beyStatus} />
                </div>
                <InfoPanel
                  recording={recording}
                  requested={requested && device === 'connected'}
                  onClose={() => ask('Disconnect device?', sendDisconnect)}
                />
              </>)}
          </div>
        </div>
      </div>

      {actionsOpen && (
        <ActionsModal
          canManageDevice={connectedCount === 1}
          competitive={competitive}
          onToggleCompetitive={() => {
            if (connectedCount === 0) return switchMode();
            setActionsOpen(false);
            ask('Switching mode will disconnect all devices. Continue?', switchMode);
          }}
          onClose={() => setActionsOpen(false)}
          onReset={() => {
            setActionsOpen(false);
            ask('Reset internal launch records?', sendResetRequest);
          }}
          onDisconnect={() => {
            setActionsOpen(false);
            ask('Disconnect device?', sendDisconnect);
          }}
        />
      )}

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onNo={() => setConfirm(null)}
          onYes={() => {
            setConfirm(null);
            confirm.action().catch(console.error);
          }}
        />
      )}
    </>
  );
}

export default App;
