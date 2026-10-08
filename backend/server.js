import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { getTTS } from './tts.js';
import { startBluetooth, bleEvents, sendReset, getRecordings } from './scanner.js';
import { askBrain, warmUpBrain } from './llm.js';

let deviceStatus = 'disconnected';

const AI_ENABLED = process.env.AI_ENABLED === "true";

const app = express();
const server = createServer(app);

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Express is ok' });
});

app.get('/api/config', (_req, res) => {
  res.json({ aiEnabled: AI_ENABLED });
});

app.post('/api/tts', async (req, res) => {
  const { text, voice = 'af_heart' } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const tts = await getTTS();
  const audio = await tts.generate(text, { voice });
  const buffer = Buffer.from(audio.toWav());

  res.set('Content-Type', 'audio/wav');
  res.send(buffer);
});

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

  if (recording.status === 'launched' && AI_ENABLED) {
    try {
      const comment = await askBrain(recording);

      broadcast({ type: 'comment', comment });
    } catch (err) {
      console.error('LLM comment failed:', err.message);
    }
  }
});

const PORT = process.env.BACKEND_PORT || 4567;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  startBluetooth();

  if (process.env.AI_ENABLED === "true") {
    console.log("Loading AI features...");
    // load both models in the background so the first launch isn't slow
    getTTS().then(() => console.log('TTS model ready'));
    warmUpBrain()
      .then(() => console.log('LLM model ready'))
      .catch((err) => console.error('LLM warm-up failed:', err.message));
  } else {
    console.log("AI features DISABLED");
  }
});
