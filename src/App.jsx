import { useState, useEffect } from 'react';
import './App.css';
import { useBleSocket } from './useBleSocket';
import Beyblade from './Beyblade';
import InfoPanel from './InfoPanel';
import VoiceFlare from './VoiceFlare';

function App() {
  const [beyStatus, setBeyStatus] = useState('idle');
  const { wsStatus, device, recording } = useBleSocket();

  console.log(wsStatus);
  console.log(device);
  console.log(recording);

  useEffect(() => {
    const t = setTimeout(() => {
      setBeyStatus('disconnected');
    }, 1000);

    // const t2 = setTimeout(() => {
    //   setBeyStatus('spin_slow');
    // }, 2000);

    // const t3 = setTimeout(() => {
    //   setBeyStatus('disconnected');
    // }, 6000);

    // const t4 = setTimeout(() => {
    //   setBeyStatus('idle');
    // }, 8000);

    return () => {
      clearTimeout(t);
      // clearTimeout(t2);
      // clearTimeout(t3);
      // clearTimeout(t4);
    };
  }, []);

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
                  <VoiceFlare />
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
