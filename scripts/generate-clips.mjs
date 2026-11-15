// Generates the prerecorded voice clips in backend/public/audio with Kokoro TTS.
// Usage: node scripts/generate-clips.mjs            (only missing clips)
//        node scripts/generate-clips.mjs --force    (regenerate everything listed)
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from 'kokoro-js';

const AUDIO_DIR = fileURLToPath(new URL('../backend/public/audio/', import.meta.url));
const VOICE = 'af_heart'; // same voice used for the original clips

// clip name => text. Add new lines here and rerun the script.
const CLIPS = {
  win_p1_1: 'Player 1 takes the round!',
  win_p1_2: 'Victory goes to Player 1!',
  win_p1_3: 'Player 1 is the champion of this battle!',
  win_p2_1: 'Player 2 wins! What a launch!',
  win_p2_2: 'Player 2 rips it! Winner!',
  win_p2_3: 'Victory goes to Player 2!',
  draw_1: "It's a draw! Launch again!",
  draw_2: 'Dead even! Rematch!',
};

const force = process.argv.includes('--force');

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
});

for (const [name, text] of Object.entries(CLIPS)) {
  const file = `${AUDIO_DIR}${name}.wav`;
  if (existsSync(file) && !force) {
    console.log(`skip ${name} (exists)`);
    continue;
  }
  const audio = await tts.generate(text, { voice: VOICE });
  await audio.save(file);
  console.log(`wrote ${name}.wav  "${text}"`);
}
