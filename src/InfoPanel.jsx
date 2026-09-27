import { useBleSocket } from './useBleSocket';

import './InfoPanel.css';

export default function InfoPanel() {
  const { wsStatus, device, recording } = useBleSocket();

  return (
    <div className="info-panel">
      <h2>DiZZi</h2>
      <p>WS Server: {wsStatus}</p>
      <p>Device: {device}</p>
      <pre>{recording ? JSON.stringify(recording, null, 2) : 'no data yet'}</pre>
      <p>Some text next to the beyblade.</p>
    </div>
  );
}