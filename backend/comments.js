import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import _ from 'lodash';

export const AUDIO_DIR = fileURLToPath(new URL('./public/audio', import.meta.url));

// same threshold the frontend uses for spin_slow / spin_fast
const GOOD_LAUNCH_RPM = 5000;

const clips = readdirSync(AUDIO_DIR).map((file) => file.replace(/\.wav$/, ''));
const praises = clips.filter((name) => name.startsWith('praise_'));
const roasts = clips.filter((name) => name.startsWith('roast_'));

export function pickComment({ launchesValues }) {
  return _.sample(launchesValues.at(-1) >= GOOD_LAUNCH_RPM ? praises : roasts);
}
