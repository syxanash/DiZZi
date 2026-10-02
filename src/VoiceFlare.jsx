import { useRef, useImperativeHandle } from 'react';

import './VoiceFlare.css';

function VoiceFlare({ ref }) {
  const flareRef = useRef(null);
  const innerFlareRef = useRef(null);
  async function playTTS(text) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 256;

    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const level = avg / 255;

      flareRef.current.style.setProperty('--level', level);
      innerFlareRef.current.style.setProperty('--level', level);

      if (!audio.paused && !audio.ended) requestAnimationFrame(tick);
    }

    audio.play();
    requestAnimationFrame(tick);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      flareRef.current.style.setProperty('--level', 0);
      innerFlareRef.current.style.setProperty('--level', 0);
      audioCtx.close();
    };
  }

  useImperativeHandle(ref, () => ({ playTTS }));

  return <div>
    <div className="flare" ref={flareRef} />
    <div className="inner-flare" ref={innerFlareRef} />
  </div>;
}

export default VoiceFlare;
