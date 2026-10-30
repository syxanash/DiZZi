import { memo, useEffect, useRef, useState } from 'react';
import './InfoPanel.css';

const BLOCKS = '▁▂▃▄▅▆▇█';
const MAX_COLS = 19;
const MAX_VISIBLE_RECORDINGS = 10;

function levelColor(level) {
  if (level <= 2) return '#f33';
  if (level <= 3) return 'rgb(255, 160, 51)';
  if (level <= 6) return 'rgb(255, 231, 51)';
  return 'rgb(51, 255, 75)';
}

function toLevel(v, min, max) {
  return Math.round(((v - min) / (max - min || 1)) * (BLOCKS.length - 1));
}

function useColumns(ref, probeRef, maxCols) {
  const [cols, setCols] = useState(maxCols);

  useEffect(() => {
    const el = ref.current;
    const probe = probeRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const charWidth = probe.getBoundingClientRect().width || 1;
      setCols(Math.max(1, Math.min(maxCols, Math.floor(entry.contentRect.width / charWidth))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, probeRef, maxCols]);

  return cols;
}

function Sparkline({ values }) {
  const ref = useRef(null);
  const probeRef = useRef(null);
  const cols = useColumns(ref, probeRef, MAX_COLS);
  const recent = values.slice(-cols);
  const min = Math.min(...recent);
  const max = Math.max(...recent);

  return (
    <p ref={ref} className="sparkline">
      <span ref={probeRef} className="sparkline-probe" aria-hidden="true">{BLOCKS.at(-1)}</span>
      {recent.map((v, i) => {
        const level = toLevel(v, min, max);
        return <span key={i} style={{ color: levelColor(level) }}>{BLOCKS[level]}</span>;
      })}
    </p>
  );
}

const CONFETTI_CHARS = ['*', '+', 'o', '.', '~', '#', '%', '@'];
const CONFETTI_COLORS = ['#f33', 'rgb(255, 160, 51)', 'rgb(255, 231, 51)', 'rgb(51, 255, 75)', 'rgb(51, 221, 255)'];

function makeConfetti(count = 40) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    char: CONFETTI_CHARS[Math.floor(Math.random() * CONFETTI_CHARS.length)],
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 1.5 + Math.random() * 1.5,
  }));
}

function AsciiConfetti() {
  const [pieces] = useState(() => makeConfetti());

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            color: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.char}
        </span>
      ))}
    </div>
  );
}

const ScoreCounter = memo(function ScoreCounter({ value, duration = 800, newScore }) {
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
    <span ref={ref} className={`${newScore ? 'new-score' : 'rainbow'} score-counter`}>0</span>
  );
});

function HistoricalData({ levels, values }) {
  const [showMore, setShowMore] = useState(false);
  const collapsed = values.length > MAX_VISIBLE_RECORDINGS && !showMore;

  const items = values.map((item, i) => (
    <span key={i} style={{ color: levelColor(levels[i]) }} className={i === values.length - 1 ? 'last-score-anim' : null}>
      {item}
    </span>
  )).toReversed();

  return (
    <div className="prev-recordings">
      {collapsed ? items.slice(0, MAX_VISIBLE_RECORDINGS) : items}
      {collapsed && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          style={{
            color: 'rgb(51, 221, 255)',
            textDecoration: 'underline',
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          ...
        </button>
      )}
    </div>
  );
}

function renderTerminalText(recording) {
  function isNewHighScore({ launchesValues, highScore }) {
    const last = launchesValues.at(-1);
    const previousBest = Math.max(0, ...launchesValues.slice(0, -1));

    return last === highScore && last > previousBest;
  }

  if (recording.status === 'launched' || recording.status === 'history') {
    const allMin = Math.min(...recording.launchesValues);
    const allMax = Math.max(...recording.launchesValues);
    const allLevels = recording.launchesValues.map((v) => toLevel(v, allMin, allMax));
    const average = recording.launchesValues.length === 0 ? 0 : Math.round(recording.launchesValues.reduce((a, b) => a + b, 0) / recording.launchesValues.length);

    const newHighScore = isNewHighScore(recording);
    return <>
      {recording.status === 'launched' ?
        <><p>Launch Power:</p>
          <div style={{ textAlign: 'center' }}>
            <ScoreCounter
              key={recording.lifetimeCounter}
              value={recording.launchesValues.at(-1)}
              newScore={newHighScore}
            />
          </div></>
        : <div style={{ textAlign: 'center' }}><p>Launches Recorded</p></div>
      }
      {newHighScore ? <div style={{ textAlign: 'center', fontStyle: 'italic' }}><p>WOW NEW SCORE!</p></div> : null}
      <p><span style={{ color: 'rgb(51, 221, 255)' }}>{recording.lifetimeCounter}</span> launches:</p>
      {recording.launchesValues.length > 0 && <Sparkline values={recording.launchesValues} />}
      <HistoricalData levels={allLevels} values={recording.launchesValues} />
      <div className="stats-row">
        <p>Highest: <span style={{ color: 'rgb(51, 221, 255)' }}>{recording.highScore}</span></p>
        <p>Average: <span style={{ color: 'rgb(51, 221, 255)' }}>{average}</span></p>
      </div>
      {newHighScore && <AsciiConfetti key={recording.lifetimeCounter} />}
    </>;
  } else if (recording.status === 'attached') {
    return <div className='centered-text'>
      <p><span style={{ color: 'rgb(51, 255, 75)' }}>LET IT RIP!!! <span className="terminal-cursor">▒</span></span></p>
    </div>;
  } else if (recording.status === 'dropped') {
    return <div className='centered-text'>
      <p><span style={{ color: '#f33' }}>DID YOU DROP YOUR BEYBLADE? <span className="terminal-cursor">▒</span></span></p>
    </div>;
  } else if (recording.status === 'reset') {
    return <div className='centered-text'>
      <p>RESET COMPLETED! <span className="terminal-cursor">▒</span></p>
    </div>;
  }
}

function LoaderScreen({ started, loaded, onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!started) return;
    const frame = requestAnimationFrame(() => setProgress((p) => Math.max(p, 95)));
    return () => cancelAnimationFrame(frame);
  }, [started]);

  useEffect(() => {
    if (loaded) setProgress(100);
  }, [loaded]);

  return <div className='terminal-loader centered-text'>
    <span>Loading data...</span>
    <div className='loaderbar-container'>
      <div
        className={`loaderbar-content${progress === 100 ? ' loaderbar-finish' : ''}`}
        style={{ width: `${progress}%` }}
        onTransitionEnd={() => progress === 100 && onDone()}
      />
    </div>
  </div>;
}

export default function InfoPanel({ recording, requested }) {
  const [loaderDone, setLoaderDone] = useState(false);

  if (!recording && loaderDone) setLoaderDone(false);

  return (
    <div className="info-panel">
      <div className="terminal-window">
        <div className="terminal-titlebar" aria-hidden="true">
          <span className="terminal-btn">_</span>
          <span className="terminal-btn">□</span>
          <span className="terminal-btn">✕</span>
        </div>
        <div className="terminal">
          {recording && loaderDone
            ? renderTerminalText(recording)
            : <LoaderScreen started={requested} loaded={!!recording} onDone={() => setLoaderDone(true)} />
          }
        </div>
      </div>
    </div>
  );
}
