import ollama from 'ollama';

const MODEL = 'gemma3:1b';

const SYSTEM_PROMPT = `You are an sassy and sarcastic Beyblade battle commentator.
A Beyblade is a spinning top launched with a ripcord. Launch power is measured in RPM (rotations per minute).
Higher RPM is better: under 3000 is weak, 3000-7000 is good, over 7000 is excellent.
Reply with ONE short sentence (max 15 words) about how the player's launches are going.

Example: "Huge jump to 8200 RPM, that's a monster launch!"
Example: "Dropped to 2500 RPM, pull that ripcord harder!"`;

function describeLaunches(launchesValues) {
  const lastItem = launchesValues.at(-1);
  const previous = launchesValues.slice(-4, -1);

  if (previous.length === 0) {
    return `First launch: ${lastItem} RPM.`;
  }

  const avgPrevious = Math.round(previous.reduce((a, b) => a + b, 0) / previous.length);
  const diff = lastItem - avgPrevious;
  const trend = diff > 300 ? 'improving' : diff < -300 ? 'getting worse' : 'about the same';

  return `Previous launches: ${previous.join(', ')} RPM (average ${avgPrevious}).
Last launch: ${lastItem} RPM. Trend: ${trend}.`;
}

// loads the model into memory so the first real launch doesn't wait for it
export async function warmUpBrain() {
  await ollama.generate({ model: MODEL, prompt: 'hi', keep_alive: -1, options: { num_predict: 1 } });
}

function toSpeakableText(text) {
  return text
    .split('\n')[0]                        // first line only
    .replace(/[*_`#~>]/g, '')              // markdown symbols
    .replace(/\p{Extended_Pictographic}/gu, '') // emojis
    .replace(/^["']|["']$/g, '')           // surrounding quotes
    .replace(/\s+/g, ' ')                  // collapse leftover spaces
    .trim();
}

export async function askBrain({ launchesValues }) {
  const response = await ollama.chat({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: describeLaunches(launchesValues) },
    ],
    stream: false,
    keep_alive: -1,
    options: { num_predict: 40, temperature: 0.8 },
  });

  const comment = toSpeakableText(response.message.content);

  return comment;
}
