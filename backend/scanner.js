import noble from '@abandonware/noble';
import EventEmitter from 'events';
import { battlepassDecoder } from './decoder.js';

export const bleEvents = new EventEmitter();

const peripheralName = 'BEYBLADE_TOOL01';
const subChar = '55c4f002f8eb11ecb9390242ac120002';
const writeChar = '55c4f001f8eb11ecb9390242ac120002';

const CONNECT_TIMEOUT_MS = 10000;
const READ_TIMEOUT_MS = 3000;

const HEADER_FLUSH_MS = 150;
const BODY_FLUSH_MS = 1000;

const MAX_DEVICES = 2;

const devices = new Map();
let connecting = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function freeSlot() {
  const used = [...devices.values()].map((d) => d.slot);
  const slots = Array.from({ length: MAX_DEVICES }, (_, i) => i + 1);
  return slots.find((s) => !used.includes(s)) ?? null;
}

function getDevice(id) {
  if (id) return devices.get(id);
  return devices.size === 1 ? [...devices.values()][0] : null;
}

function createDevice(peripheral, slot) {
  return {
    id: peripheral.id,
    peripheral,
    writeCharacteristic: null,
    expectingHistory: false,
    dataStream: [],
    flushTimer: undefined,
    decoderCtx: {},
    slot,
  };
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function sendReset(id) {
  const device = getDevice(id);
  if (!device?.writeCharacteristic) throw new Error('Beyblade tool not connected');
  await device.writeCharacteristic.writeAsync(Buffer.from([0x75]), true);
}

export async function getRecordings(id) {
  const device = getDevice(id);
  if (!device?.writeCharacteristic) throw new Error('Beyblade tool not connected');
  await device.writeCharacteristic.writeAsync(Buffer.from([0x51]), true);
  await delay(700);
  if (!device?.writeCharacteristic) throw new Error('Beyblade tool not connected');
  // set before writing: notifications can arrive before the write is ACKed
  device.expectingHistory = true;
  try {
    await device.writeCharacteristic.writeAsync(Buffer.from([0x74]), true);
  } catch (err) {
    device.expectingHistory = false;
    throw err;
  }
}

// release the BLE link before quitting: noble's native macOS binding
// deadlocks if it's still active when Electron tears down Node
export async function stopBluetooth() {
  noble.removeAllListeners();
  await noble.stopScanningAsync().catch(() => { });
  for (const d of devices.values()) {
    d.peripheral.removeAllListeners('disconnect');
    await d.peripheral.disconnectAsync().catch(() => { });
  }
  devices.clear();
}

export async function disconnectDevice(id) {
  const device = getDevice(id);
  if (!device) throw new Error('Beybattle Pass not connected');
  await device.peripheral.disconnectAsync();
}

export function startBluetooth() {
  function processPayload(payload, d) {
    try {
      const battlePass = battlepassDecoder(payload, d.decoderCtx);
      // lone headers the decoder can't classify (e.g. the 0x51 reply) aren't worth showing
      if (battlePass.status === 'unknown') return;
      bleEvents.emit('recording', { ...battlePass, deviceId: d.id, slot: d.slot });
    } catch (err) {
      console.error('Decode failed:', err.message);
      console.error(payload.map((p) => p.toString('hex')));
    }
  }

  noble.on('stateChange', state => {
    console.log('Bluetooth state:', state);
    if (state === 'poweredOn') {
      noble.startScanning([], true);
    }
  });

  noble.on('discover', async (peripheral) => {
    const name = peripheral.advertisement.localName;

    if (!name) return;

    console.log(`Found: ${name} | RSSI: ${peripheral.rssi}`);

    if (name !== peripheralName || connecting) return;
    if (devices.has(peripheral.id) || devices.size >= MAX_DEVICES) return;
    connecting = true;
    const device = createDevice(peripheral, freeSlot());

    try {
      await noble.stopScanningAsync();
      await withTimeout(peripheral.connectAsync(), CONNECT_TIMEOUT_MS, 'connect');
      devices.set(device.id, device);

      console.log(`Connected to ${peripheralName}, GATT map below:`);

      peripheral.once('disconnect', () => {
        console.log(`Bluetooth ${peripheralName} disconnected...`);
        bleEvents.emit('device', { id: device.id, slot: device.slot, device: 'disconnected' });
        clearTimeout(device.flushTimer);
        devices.delete(device.id);
        noble.startScanningAsync([], true);
      });

      const services = await withTimeout(peripheral.discoverServicesAsync([]), CONNECT_TIMEOUT_MS, 'discover services');

      for (const service of services) {
        console.log(`\nService UUID: ${service}`);

        const characteristics = await withTimeout(service.discoverCharacteristicsAsync([]), CONNECT_TIMEOUT_MS, 'discover characteristics');

        for (const char of characteristics) {
          console.log(`  └─ Characteristic: ${char.uuid}`);
          console.log(`     Properties:     [ ${char.properties.join(', ')} ]`);

          if (char.properties.includes('read')) {
            try {
              const data = await withTimeout(char.readAsync(), READ_TIMEOUT_MS, 'read');
              console.log(`     Read Value:     ${Buffer.from(data.toString('hex'), 'hex').toString('utf8')}`);
            } catch (e) {
              console.log(`     Read Value:     Failed to read (${e.message})`);
            }
          }

          if (char.uuid == subChar) {
            function flush() {
              clearTimeout(device.flushTimer);
              device.expectingHistory = false;
              const payload = device.dataStream;
              device.dataStream = [];
              if (payload.length) processPayload(payload, device);
            }

            char.on('data', (data) => {
              device.dataStream.push(data);
              clearTimeout(device.flushTimer);

              const lastPage = device.expectingHistory ? 0xb7 : 0x73;
              if (data[0] === lastPage) return flush();

              const midBody = device.dataStream.some((page) => page[0] !== 0xa0);
              device.flushTimer = setTimeout(flush, midBody ? BODY_FLUSH_MS : HEADER_FLUSH_MS);
            });

            await withTimeout(char.subscribeAsync(), CONNECT_TIMEOUT_MS, 'subscribe');
            console.log(`Subscribed to: ${subChar}`);
          }

          if (char.uuid == writeChar) {
            device.writeCharacteristic = char;
          }
        }
      }

      // the link may have dropped while we were still discovering
      if (peripheral.state !== 'connected') throw new Error('peripheral disconnected during setup');

      connecting = false;
      if (devices.size < MAX_DEVICES) noble.startScanningAsync([], true);

      bleEvents.emit('device', { id: device.id, slot: device.slot, device: 'connected' });
    } catch (err) {
      console.error(`BLE setup failed: ${err.message}, retrying...`);
      devices.delete(device.id);
      peripheral.removeAllListeners('disconnect');
      connecting = false;
      peripheral.disconnectAsync().catch(() => { });
      noble.startScanningAsync([], true);
    }

    // console.log('\n==========================================\n');
    // await peripheral.disconnectAsync();
    // console.log('Disconnected. Recon complete.');
    // process.exit(0);
  });
}
