import './App.css';
import Beyblade from './Beyblade';
import InfoPanel from './InfoPanel';

function App() {
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
                  <div className="flare"></div>
                </div>
              </div>
              <div className="gauge-label gauge-label--top">100</div>
              <div className="gauge-label gauge-label--bottom">100</div>
            </div>
          </div>

          <div className="main-panel">
            <div className="layout-row">
              <div className="beyblade-side">
                <Beyblade />
              </div>
              <InfoPanel />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
