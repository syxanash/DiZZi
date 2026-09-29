import './InfoPanel.css';

export default function InfoPanel({ recording }) {
  return (
    <div className="info-panel">
      <div className="terminal">
        {recording ? (
          <>
            <p>&gt; Last score: {recording.launchesValues[recording.launchesValues.length - 1]}</p>
            <p>&gt; Highest: {recording.highScore}</p>
            <p>&gt; Total: {recording.lifetimeCounter}</p>
          </>
        ) : (
          <p>&gt; Waiting for data...</p>
        )}
        <span className="terminal-cursor">█</span>
      </div>
    </div>
  );
}
