import { memo, useEffect, useRef, useState } from 'react';
import './InfoPanel.css';

const BLOCKS = '▁▂▃▄▅▆▇█';
const MAX_COLS = 16;

function levelColor(level) {
  if (level <= 2) return '#f33';
  if (level <= 3) return 'rgb(255, 160, 51)';
  if (level <= 6) return 'rgb(255, 231, 51)';
  return 'rgb(51, 255, 75)';
}

function toLevel(v, min, max) {
  return Math.round(((v - min) / (max - min || 1)) * (BLOCKS.length - 1));
}

function Sparkline({ levels }) {
  return (
    <p className="sparkline">
      {levels.map((level, i) => (
        <span key={i} style={{ color: levelColor(level) }}>{BLOCKS[level]}</span>
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

function renderTerminalText(recording) {
  function isNewHighScore({ launchesValues, highScore }) {
    const last = launchesValues.at(-1);
    const previousBest = Math.max(0, ...launchesValues.slice(0, -1));

    return last === highScore && last > previousBest;
  }

  if (recording.status === 'launched') {
    const recent = recording.launchesValues.slice(-MAX_COLS);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const levels = recent.map((v) => toLevel(v, min, max));

    const newHighScore = isNewHighScore(recording);
    return <>
      <p>&gt; RPMs:</p>
      <div style={{ textAlign: 'center' }}>
        <ScoreCounter
          key={recording.lifetimeCounter}
          value={recording.launchesValues.at(-1)}
          newScore={newHighScore}
        />
      </div>
      {newHighScore ? <div style={{ textAlign: 'center', fontStyle: 'italic' }}><p>WOW NEW SCORE!</p></div> : null}
      <p>&gt; <span style={{ color: 'rgb(51, 221, 255)' }}>{recording.lifetimeCounter}</span> launches:</p>
      {recent.length > 0 && <Sparkline levels={levels} />}
      <div className="prev-recordings">
        {recent.map((item, i) => (
          <span key={i} style={{ fontStyle: i === recent.length - 1 ? 'italic' : 'normal', color: levelColor(levels[i]) }}>
            {item}
          </span>
        )).toReversed()}
      </div>
      <p>&gt; Highest: <span style={{ color: 'rgb(51, 221, 255)' }}>{recording.highScore}</span> <span className="terminal-cursor">▒</span></p>
      {newHighScore && <AsciiConfetti key={recording.lifetimeCounter} />}
    </>;
  } else if (recording.status === 'attached') {
    return <>
      <p><span style={{ color: 'rgb(51, 255, 75)' }}>&gt; LET IT RIP!!! <span className="terminal-cursor">▒</span></span></p>
    </>;
  } else if (recording.status === 'dropped') {
    return <>
      <p><span style={{ color: '#f33' }}>&gt; DID YOU DROP YOUR BEYBLADE? :( <span className="terminal-cursor">▒</span></span></p>
    </>;
  } else if (recording.status === 'reset') {
    return <>
      <p>&gt; The Beybattle Pass was RESET successfully! <span className="terminal-cursor">▒</span></p>
    </>;
  }
}

export default function InfoPanel({ recording }) {
  return (
    <div className="info-panel">
      <div className="terminal-window">
        <div className="terminal-titlebar" aria-hidden="true">
          <span className="terminal-btn">_</span>
          <span className="terminal-btn">□</span>
          <span className="terminal-btn">✕</span>
        </div>
        <div className="terminal">
          {recording
            ? renderTerminalText(recording)
            : (
              <p>&gt; Waiting for data... <span className="terminal-cursor">▒</span></p>
            )}
        </div>
      </div>
    </div>
  );
}
