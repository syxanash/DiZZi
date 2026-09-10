import { useBleSocket } from './useBleSocket';

import './InfoPanel.css';

export default function InfoPanel() {
  const { status, device, lastPacket } = useBleSocket();

  return (
    <div className="info-panel">
      <h2>DiZZi</h2>
      <p>Server: {status}</p>
      <p>Device: {device}</p>
      <pre>{lastPacket ? JSON.stringify(lastPacket, null, 2) : 'no data yet'}</pre>
      <p>Some text next to the beyblade.</p>
    </div>
  );
}