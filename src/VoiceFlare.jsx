// VIBECODE: Voice flare canvas animation was vibecoded

import { useRef, useImperativeHandle } from 'react';

import './VoiceFlare.css';

const PEAKS = 9;
const STREAKS = 14;
const BLUE = '120, 210, 255';
const ORANGE = '255, 120, 50';

function shuffledIndexes(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function VoiceFlare({ ref }) {
  const flareRef = useRef(null);
  const innerFlareRef = useRef(null);
  const canvasRef = useRef(null);
  const peakMap = useRef(shuffledIndexes(PEAKS));
  const streakMap = useRef(shuffledIndexes(STREAKS));
  const peakLevels = useRef(new Array(PEAKS).fill(0));
  const streakLevels = useRef(new Array(STREAKS).fill(0));

  function drawHalf(ctx, w, h, dir, color) {
    const cy = h / 2;

    // streaks fanning out from the centre of the horizon
    const len = h * 0.6;
    const grad = ctx.createRadialGradient(w / 2, cy, 0, w / 2, cy, len);
    grad.addColorStop(0, `rgba(${color}, 0.9)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    streakLevels.current.forEach((lvl, i) => {
      const a = (-0.42 + (i / (STREAKS - 1)) * 0.84) * Math.PI; // spread over ~150deg
      const spread = 0.06;
      ctx.globalAlpha = Math.min(1, lvl * 1.4);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(w / 2, cy);
      ctx.lineTo(w / 2 + Math.sin(a - spread) * len, cy + dir * Math.cos(a - spread) * len);
      ctx.lineTo(w / 2 + Math.sin(a + spread) * len, cy + dir * Math.cos(a + spread) * len);
      ctx.closePath();
      ctx.fill();
    });

    // flame-like peaks rising from the horizon
    const step = w / (PEAKS - 1);
    peakLevels.current.forEach((lvl, i) => {
      const x = i * step;
      const ph = lvl * h * 0.45;
      const pg = ctx.createLinearGradient(0, cy, 0, cy + dir * ph);
      pg.addColorStop(0, `rgba(${color}, 1)`);
      pg.addColorStop(1, `rgba(${color}, 0.15)`);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.moveTo(x - step * 0.75, cy);
      ctx.lineTo(x, cy + dir * ph);
      ctx.lineTo(x + step * 0.75, cy);
      ctx.closePath();
      ctx.fill();
    });

    // solid glow band hugging the horizon
    const band = ctx.createLinearGradient(0, cy, 0, cy + dir * h * 0.12);
    band.addColorStop(0, `rgba(${color}, 0.95)`);
    band.addColorStop(1, `rgba(${color}, 0)`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = band;
    ctx.fillRect(0, dir > 0 ? cy : cy - h * 0.12, w, h * 0.12);
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.filter = `blur(${Math.round(w / 60)}px)`;
    ctx.globalCompositeOperation = 'lighter';
    drawHalf(ctx, w, h, -1, BLUE);
    drawHalf(ctx, w, h, 1, ORANGE);
    ctx.restore();
  }

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

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;

    // voice energy lives mostly in the lower ~60% of the bins
    const usable = Math.floor(data.length * 0.6);
    const sample = (map, i, n) => data[Math.floor((map[i] / n) * usable)] / 255;
    const smooth = (prev, v) => prev * 0.65 + v * (0.6 + Math.random() * 0.8) * 0.35;

    function tick() {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const level = avg / 255;

      flareRef.current.style.setProperty('--level', level);
      innerFlareRef.current.style.setProperty('--level', level);

      for (let i = 0; i < PEAKS; i++) {
        peakLevels.current[i] = smooth(peakLevels.current[i], sample(peakMap.current, i, PEAKS));
      }
      for (let i = 0; i < STREAKS; i++) {
        streakLevels.current[i] = smooth(streakLevels.current[i], sample(streakMap.current, i, STREAKS));
      }
      draw();

      if (!audio.paused && !audio.ended) requestAnimationFrame(tick);
    }

    innerFlareRef.current.classList.add('speaking');
    canvas.classList.add('speaking');
    audio.play();
    requestAnimationFrame(tick);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      flareRef.current.style.setProperty('--level', 0);
      innerFlareRef.current.style.setProperty('--level', 0);
      innerFlareRef.current.classList.remove('speaking');
      canvas.classList.remove('speaking');
      peakLevels.current.fill(0);
      streakLevels.current.fill(0);
      audioCtx.close();
    };
  }

  useImperativeHandle(ref, () => ({ playTTS }));

  return <div>
    <div className="flare" ref={flareRef} />
    <div className="inner-flare" ref={innerFlareRef} />
    <canvas className="voice-rays" ref={canvasRef} />
  </div>;
}

export default VoiceFlare;
