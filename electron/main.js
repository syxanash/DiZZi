import { app, BrowserWindow } from 'electron';
import { stopBluetooth } from '../backend/scanner.js';

let quitting = false;

app.whenReady().then(async () => {
  // set env before the server module loads; it reads these at import time
  process.env.AI_ENABLED = 'false';
  process.env.HOST = '127.0.0.1';
  process.env.BACKEND_PORT ??= '4567';

  const { ready } = await import('../backend/server.js');
  await ready;

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    show: false, // wait for first paint to avoid a white flash
    backgroundColor: '#000',
    autoHideMenuBar: true,
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://localhost:${process.env.BACKEND_PORT}`);
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', async (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  await Promise.race([
    stopBluetooth(),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
  process.reallyExit(0);
});