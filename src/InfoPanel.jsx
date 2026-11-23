import { memo, useEffect, useRef, useState } from 'react';
import './InfoPanel.css';

const BLOCKS = '▁▂▃▄▅▆▇█';
const MAX_COLS = 19;
const MAX_VISIBLE_RECORDINGS = 10;

const BELOW_COLORS = [
  'rgb(255, 51, 51)',   // weak
  'rgb(255, 90, 51)',
  'rgb(255, 130, 51)',
  'rgb(255, 160, 51)',
  'rgb(255, 196, 51)',
  'rgb(255, 231, 51)',  // almost there
];
const GOOD_COLOR = 'rgb(51, 255, 75)';

// Absolute color: green at/above goodLaunchRpm; below it, scale from goodLaunchRpm / 2
// (the same "weak" line backend/llm.js uses) up to goodLaunchRpm.
function rpmColor(v, goodLaunchRpm) {
  if (goodLaunchRpm == null) return 'rgb(200, 200, 200)'; // config not loaded yet
  if (v >= goodLaunchRpm) return GOOD_COLOR;
  const floor = goodLaunchRpm / 2;
  const t = Math.max(0, (v - floor) / (goodLaunchRpm - floor));
  return BELOW_COLORS[Math.min(BELOW_COLORS.length - 1, Math.floor(t * BELOW_COLORS.length))];
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

// Bar height is relative (levels); color is absolute (rpmColor), same as HistoricalData.
function Sparkline({ levels, values, goodLaunchRpm }) {
  const ref = useRef(null);
  const probeRef = useRef(null);
  const cols = useColumns(ref, probeRef, MAX_COLS);
  const recentLevels = levels.slice(-cols);
  const recentValues = values.slice(-cols);

  return (
    <p ref={ref} className="sparkline">
      <span ref={probeRef} className="sparkline-probe" aria-hidden="true">{BLOCKS.at(-1)}</span>
      {recentLevels.map((level, i) => (
        <span key={i} style={{ color: rpmColor(recentValues[i], goodLaunchRpm) }}>{BLOCKS[level]}</span>
      ))}
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

function HistoricalData({ values, goodLaunchRpm }) {
  const [showMore, setShowMore] = useState(false);
  const collapsed = values.length > MAX_VISIBLE_RECORDINGS && !showMore;

  const visible = collapsed ? values.slice(-MAX_VISIBLE_RECORDINGS) : values;
  const offset = values.length - visible.length;

  return (
    <div className="prev-recordings">
      {visible.map((item, i) => {
        const idx = offset + i;
        return (
          <span
            key={idx}
            style={{ color: rpmColor(item, goodLaunchRpm) }}
            className={idx === values.length - 1 ? 'last-score-anim' : null}
          >
            {item}
          </span>
        );
      }).toReversed()}
      {collapsed && (
        <button
          type="button"
          className="link-btn"
          title={`Show ${offset} older launches`}
          onClick={() => setShowMore(true)}
        >
          +{offset}
        </button>
      )}
    </div>
  );
}

function renderTerminalText(recording, competitive, goodLaunchRpm) {
  function isNewHighScore({ launchesValues, highScore, status }) {
    if (status !== 'launched' || launchesValues.length < 2) return false;

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
      {recording.launchesValues.length > 0 && (
        <Sparkline
          levels={allLevels}
          values={recording.launchesValues}
          goodLaunchRpm={goodLaunchRpm}
        />
      )}
      <HistoricalData values={recording.launchesValues} goodLaunchRpm={goodLaunchRpm} />
      <div className="stats-row">
        <p>Highest: <span style={{ color: 'rgb(51, 221, 255)' }}>{recording.highScore}</span></p>
        <p>Average: <span style={{ color: 'rgb(51, 221, 255)' }}>{average}</span></p>
      </div>
      {newHighScore && !competitive && <AsciiConfetti key={recording.lifetimeCounter} />}
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

export default function InfoPanel({ recording, requested, waitingText, onClose, result, player, goodLaunchRpm }) {
  const competitive = player != null;
  const [loaderDone, setLoaderDone] = useState(false);

  if (!recording && loaderDone) setLoaderDone(false);

  return (
    <div className="info-panel" style={{ padding: competitive ? 0 : '24px' }}>
      <div className="terminal-window">
        <div className="terminal-titlebar">
          <span
            className="terminal-btn terminal-btn--close"
            aria-label="Disconnect"
            onClick={onClose}>✕</span>
        </div>
        <div className="terminal">
          {competitive && (
            <p className="player-header">
              PLAYER {player}
              {result === 'win' && <span style={{ color: 'rgb(51, 255, 75)' }}> 🏆 WINNER!</span>}
              {result === 'draw' && <span style={{ color: 'rgb(255, 231, 51)' }}> DRAW!</span>}
            </p>
          )}
          {result === 'win' && <AsciiConfetti key={recording?.lifetimeCounter} />}
          {
            waitingText
              ? <div className="centered-text"><p>{waitingText} <span className="terminal-cursor">▒</span></p></div>
              : recording && loaderDone
                ? renderTerminalText(recording, competitive, goodLaunchRpm)
                : <LoaderScreen started={requested} loaded={!!recording} onDone={() => setLoaderDone(true)} />
          }
        </div>
      </div>
    </div>
  );
}
