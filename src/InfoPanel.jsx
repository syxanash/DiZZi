import { memo, useEffect, useRef } from 'react';
import './InfoPanel.css';

const BLOCKS = '▁▂▃▄▅▆▇█';
const MAX_COLS = 19;

function bucket(values, maxCols) {
  if (values.length <= maxCols) return values;
  const size = values.length / maxCols;
  const result = [];
  for (let i = 0; i < maxCols; i++) {
    const slice = values.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    result.push(slice.reduce((sum, v) => sum + v, 0) / slice.length);
  }
  return result;
}

function levelColor(level) {
  if (level <= 2) return '#f33';
  if (level <= 3) return 'rgb(255, 160, 51)';
  if (level <= 6) return 'rgb(255, 231, 51)';
  return 'rgb(51, 255, 75)';
}

function Sparkline({ values }) {
  const cols = bucket(values, MAX_COLS);
  const min = Math.min(...cols);
  const max = Math.max(...cols);
  return (
    <p className="sparkline">
      {cols.map((v, i) => {
        const level = Math.round(((v - min) / (max - min || 1)) * (BLOCKS.length - 1));
        return <span key={i} style={{ color: levelColor(level) }}>{BLOCKS[level]}</span>;
      })}
    </p>
  );
}

const ScoreCounter = memo(function ScoreCounter({ value, duration = 800 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = value;
      return;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out: fast start, slows near the target
      el.textContent = Math.round(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span ref={ref} className="rainbow" style={{ fontSize: 'clamp(48px, 12vw, 96px)' }}>0</span>
  );
});

function renderTerminalText(recording) {
  if (recording.status === 'launched') {
    return <>
      <p>&gt; Trend:</p>
      {recording.launchesValues.length > 0 && <Sparkline values={recording.launchesValues} />}
      <p>&gt; Total: <span style={{ color: 'rgb(51, 221, 255)' }}>{recording.lifetimeCounter}</span></p>
      <p>&gt; Highest: <span style={{ color: 'rgb(51, 221, 255)' }}>{recording.highScore}</span></p>
      <p>&gt; Last launch:</p>
      <div style={{ textAlign: 'center' }}>
        <ScoreCounter
          key={recording.lifetimeCounter}
          value={recording.launchesValues[recording.launchesValues.length - 1]}
        />
      </div>
    </>;
  } else if (recording.status === 'attached') {
    return <>
      <p><span style={{ color: 'rgb(51, 255, 75)' }}>&gt; LET IT RIP!!!</span></p>
    </>;
  } else if (recording.status === 'dropped') {
    return <>
      <p><span style={{ color: 'rgb(51, 255, 75)' }}>&gt; DID YOU DROP YOUR BEYBLADE? :(</span></p>
    </>;
  }
}

export default function InfoPanel({ recording }) {
  return (
    <div className="info-panel">
      <div className="terminal">
        {recording
          ? renderTerminalText(recording)
          : (
            <p>&gt; Waiting for data...</p>
          )}<span className="terminal-cursor">▒</span>
      </div>
    </div>
  );
}
