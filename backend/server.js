import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { startBluetooth, bleEvents, sendReset, getRecordings } from './scanner.js';
import { pickComment, AUDIO_DIR } from './comments.js';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const HOST = process.env.HOST || '0.0.0.0';
const AI_ENABLED = process.env.AI_ENABLED === "true";

const llm = AI_ENABLED ? await import('./llm.js') : null;

const app = express();
const server = createServer(app);

let deviceStatus = 'disconnected';

app.use(express.json());

app.get('/api/config', (_req, res) => {
  res.json({ aiEnabled: AI_ENABLED });
});

app.post('/api/tts', async (req, res) => {
  if (!AI_ENABLED) return res.status(404).json({ error: 'AI disabled' });

  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const wav = await llm.speak(text, voice);
    res.set('Content-Type', 'audio/wav');
    res.send(wav);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.use('/api/audio', express.static(AUDIO_DIR));

app.post('/api/recordings', async (req, res) => {
  try {
    await getRecordings();
    res.json({ message: 'REQ SENT!' });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    await sendReset();
    res.json({ message: 'RESET OK!' });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.use(express.static(DIST));

const wss = new WebSocketServer({ server });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
}

wss.on('connection', (socket) => {
  console.log('client connected total: ', wss.clients.size);
  socket.send(JSON.stringify({ type: 'device', device: deviceStatus }));
  socket.on('close', () => console.log('client left, total: ', wss.clients.size));
});

bleEvents.on('device', (device) => {
  deviceStatus = device;
  broadcast({ type: 'device', device });
});

bleEvents.on('recording', async (recording) => {
  broadcast({ type: 'recording', recording });

  if (recording.status !== 'launched') return;

  // without AI we skip ollama entirely and pick a prerecorded clip
  if (!AI_ENABLED) {
    broadcast({ type: 'comment', comment: pickComment(recording) });
    return;
  }

  try {
    const comment = await llm.askBrain(recording);

    broadcast({ type: 'comment', comment });
  } catch (err) {
    console.error('LLM comment failed:', err.message);
  }
});

const PORT = process.env.BACKEND_PORT || 4567;

export const ready = new Promise((resolve) => {
  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    startBluetooth();

    if (AI_ENABLED) {
      console.log("Loading AI features...");
      // load both models in the background so the first launch isn't slow
      llm.speak("hello")
        .then(() => { console.log('Voice model ready'); })
        .catch((err) => console.error('Voice model warm-up failed: ', err.message));

      llm.warmUpBrain()
        .then(() => console.log('LLM model ready'))
        .catch((err) => console.error('LLM warm-up failed:', err.message));
    } else {
      console.log("AI features DISABLED, using prerecorded clips");
    }

    resolve();
  });
});
