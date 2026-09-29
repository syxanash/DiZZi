import './InfoPanel.css';

export default function InfoPanel({ recording }) {
  const { launchesValues, highScore, lifetimeCounter } = recording;

  return (
    <div className="info-panel">
      <h2>DiZZi</h2>
      <p>Last score: {launchesValues[launchesValues.length - 1]}</p>
      <p>Highest: {highScore}</p>
      <p>Total: {lifetimeCounter}</p>
    </div>
  );
}