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
  if (level <= 5) return 'rgb(255, 160, 51)';
  if (level <= 7) return 'rgb(255, 231, 51)';
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

export default function InfoPanel({ recording }) {
  return (
    <div className="info-panel">
      <div className="terminal">
        {recording ? (
          <>
            <p>&gt; Trend:</p>
            {recording.launchesValues.length > 0 && <Sparkline values={recording.launchesValues} />}
            <p>&gt; Total: <span style={{ color: 'rgb(51, 221, 255)' }}>{recording.lifetimeCounter}</span></p>
            <p>&gt; Highest: <span style={{ color: 'rgb(51, 221, 255)' }}>{recording.highScore}</span></p>
            <p>&gt; Last launch:</p>
            <div style={{ textAlign: 'center' }}>
              <span className="rainbow" style={{ fontSize: 'clamp(48px, 12vw, 96px)' }}>{recording.launchesValues[recording.launchesValues.length - 1]}</span>
            </div>
          </>
        ) : (
          <p>&gt; Waiting for data...</p>
        )}<span className="terminal-cursor">▒</span>
      </div>
    </div>
  );
}
