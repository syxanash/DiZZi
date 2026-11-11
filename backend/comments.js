import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import _ from 'lodash';

export const AUDIO_DIR = fileURLToPath(new URL('./public/audio', import.meta.url));

// single source of truth, the frontend gets it from /api/config
export const GOOD_LAUNCH_RPM = Number(process.env.GOOD_LAUNCH_RPM) || 9500;

const clips = readdirSync(AUDIO_DIR).map((file) => file.replace(/\.wav$/, ''));
const praises = clips.filter((name) => name.startsWith('praise_'));
const roasts = clips.filter((name) => name.startsWith('roast_'));

export function pickComment({ launchesValues }) {
  return _.sample(launchesValues.at(-1) >= GOOD_LAUNCH_RPM ? praises : roasts);
}
