import { useState, useEffect, useRef } from 'react';
import './App.css';
import Beyblade from './Beyblade';
import InfoPanel from './InfoPanel';

function App() {
  const [beyStatus, setBeyStatus] = useState('idle');
  const flareRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setBeyStatus('attached');
    }, 1000);

    const t2 = setTimeout(() => {
      setBeyStatus('spin_fast');
    }, 2000);

    const t3 = setTimeout(() => {
      setBeyStatus('disconnected');
    }, 6000);

    const t4 = setTimeout(() => {
      setBeyStatus('idle');
    }, 8000);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  async function playTTS(text) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 256;

    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const level = avg / 255;

      flareRef.current.style.setProperty('--level', level);

      if (!audio.paused && !audio.ended) requestAnimationFrame(tick);
    }

    audio.play();
    requestAnimationFrame(tick);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      flareRef.current.style.setProperty('--level', 0);
    };
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
          <div className="crosshair" aria-hidden="true">
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
                  <div ref={flareRef} onClick={() => playTTS('This launch was not that great, try harder!')} className="flare" ></div>
                </div>
              </div>
              <div className="gauge-label gauge-label--top">100</div>
              <div className="gauge-label gauge-label--bottom">100</div>
            </div>
          </div>

          <div className="main-panel">
            <div className="layout-row">
              <div className="beyblade-side">
                <Beyblade status={beyStatus} />
              </div>
              <div className="window-frame">
                <div className="window-titlebar">
                  <span>_</span>
                  <span>□</span>
                  <span>X</span>
                </div>
                <div className="window-body">
                  <InfoPanel />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
