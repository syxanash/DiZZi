import { KokoroTTS } from 'kokoro-js';

let ttsPromise;
export function getTTS() {
  if (!ttsPromise) {
    ttsPromise = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'cpu',
    });
  }
  return ttsPromise;
}