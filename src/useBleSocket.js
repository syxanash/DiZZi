
import { useEffect, useEffectEvent, useRef, useState } from 'react';

export function useBleSocket({ url = `ws://${location.host}/ws`, onRecording, onComment } = {}) {
  const notifyRecording = useEffectEvent((rec) => onRecording?.(rec));
  const notifyComment = useEffectEvent((comment) => onComment?.(comment));

  const [devices, setDevices] = useState({});
  const [recordings, setRecordings] = useState({});
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
        setRecording(null);
        setDevices({});
        setRecordings({});
        if (!closedByUs) setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'device') {
          if (msg.slot) {
            setDevices((d) => ({ ...d, [msg.slot]: { id: msg.id, status: msg.device } }));
            if (msg.device !== 'connected') setRecordings((r) => ({ ...r, [msg.slot]: null }));
          }
          setDevice(msg.device);
          if (msg.device !== 'connected') setRecording(null);
        } else if (msg.type === 'recording') {
          setRecordings((r) => ({ ...r, [msg.recording.slot]: msg.recording }));
          setRecording(msg.recording);
          notifyRecording(msg.recording);
        } else if (msg.type === 'comment') {
          notifyComment(msg.comment);
        }
      };
    };

    connect();
    return () => {
      closedByUs = true;
      wsRef.current?.close();
    };
  }, [url]);

  const anyConnected = Object.values(devices).some((d) => d.status === 'connected');

  return {
    wsStatus,
    device: anyConnected ? 'connected' : device,
    recording,
    recordings,
    devices,
    clearRecording
  };
}