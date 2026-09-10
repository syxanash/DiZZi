import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { startBluetooth, bleEvents } from './scanner.js';

const app = express();
const server = createServer(app);

app.get('/', (_req, res) => {
  res.json({ message: 'Express is ok' });
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
  socket.on('close', () => console.log('client left, total: ', wss.clients.size));
})

bleEvents.on('packet', (payload) => {
  broadcast({ type: 'packet', payload });
});

bleEvents.on('status', (state) => {
  broadcast({ type: 'status', state });
});

const PORT = process.env.PORT || 4567;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  startBluetooth();
});