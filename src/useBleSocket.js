
import { useEffect, useRef, useState } from 'react';

export function useBleSocket(url = 'ws://localhost:4567') {
  const [status, setStatus] = useState('connecting');
  const [device, setDevice] = useState('unknown');
  const [lastPacket, setLastPacket] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let closedByUs = false;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setStatus('open');
      ws.onclose = () => {
        setStatus('closed');
        setDevice('unknown');
        if (!closedByUs) setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'status') {
          setDevice(msg.state);
        } else if (msg.type === 'packet') {
          setLastPacket(msg.payload);
        }
      };
    };

    connect();
    return () => {
      closedByUs = true;
      wsRef.current?.close();
    };
  }, [url]);

  return { status, device, lastPacket };
}