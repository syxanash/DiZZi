
import { useEffect, useRef, useState } from 'react';

export function useBleSocket(url = 'ws://localhost:4567') {
  const [wsStatus, setWSStatus] = useState('connecting');
  const [device, setDevice] = useState('unknown');
  const [recording, setRecording] = useState(null);
  const wsRef = useRef(null);

  const clearRecording = () => setRecording(null);

  useEffect(() => {
    let closedByUs = false;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setWSStatus('open');
      ws.onclose = () => {
        setWSStatus('closed');
        setDevice('unknown');
        if (!closedByUs) setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'device') {
          setDevice(msg.device);
        } else if (msg.type === 'recording') {
          setRecording(msg.recording);
        }
      };
    };

    connect();
    return () => {
      closedByUs = true;
      wsRef.current?.close();
    };
  }, [url]);

  return { wsStatus, device, recording, clearRecording };
}