import noble from '@abandonware/noble';
import EventEmitter from 'events';
import { battlepassDecoder } from './decoder.js';

export const bleEvents = new EventEmitter();

const peripheralName = 'BEYBLADE_TOOL01';
const subChar = '55c4f002f8eb11ecb9390242ac120002';
const writeChar = '55c4f001f8eb11ecb9390242ac120002';

const CONNECT_TIMEOUT_MS = 10000;
const READ_TIMEOUT_MS = 3000;

const HEADER_FLUSH_MS = 150; // lone a0 events (attach/drop)
const BODY_FLUSH_MS = 1000;

let writeCharacteristic = null;
let connecting = false;
let expectingHistory = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function sendReset() {
  if (!writeCharacteristic) throw new Error('Beyblade tool not connected');
  await writeCharacteristic.writeAsync(Buffer.from([0x75]), true);
}

export async function getRecordings() {
  if (!writeCharacteristic) throw new Error('Beyblade tool not connected');
  await writeCharacteristic.writeAsync(Buffer.from([0x51]), true);
  await delay(700);
  if (!writeCharacteristic) throw new Error('Beyblade tool not connected');
  // set before writing: notifications can arrive before the write is ACKed
  expectingHistory = true;
  try {
    await writeCharacteristic.writeAsync(Buffer.from([0x74]), true);
  } catch (err) {
    expectingHistory = false;
    throw err;
  }
}

export function startBluetooth() {
  let dataStream = [];
  let flushTimer = undefined;

  function processPayload(payload) {
    try {
      const battlePass = battlepassDecoder(payload);
      bleEvents.emit('recording', battlePass);
    } catch (err) {
      console.error('Decode failed:', err.message);
      console.error(payload.map((p) => p.toString('hex')));
    }
  }

  noble.on('stateChange', state => {
    console.log('Bluetooth state:', state);
    if (state === 'poweredOn') {
      noble.startScanning([], false);
    }
  });

  noble.on('discover', async (peripheral) => {
    const name = peripheral.advertisement.localName;

    if (!name) return;

    console.log(`Found: ${name} | RSSI: ${peripheral.rssi}`);

    if (name !== peripheralName || connecting) return;
    connecting = true;

    try {
      await noble.stopScanningAsync();
      await withTimeout(peripheral.connectAsync(), CONNECT_TIMEOUT_MS, 'connect');

      console.log(`Connected to ${peripheralName}, GATT map below:`);

      peripheral.once('disconnect', () => {
        console.log(`Bluetooth ${peripheralName} disconnected...`);
        bleEvents.emit('device', 'disconnected');
        writeCharacteristic = null;
        connecting = false;
        expectingHistory = false;
        noble.startScanningAsync([], false);
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
              clearTimeout(flushTimer);
              expectingHistory = false;
              const payload = dataStream;
              dataStream = [];
              if (payload.length) processPayload(payload);
            }

            char.on('data', (data) => {
              dataStream.push(data);
              clearTimeout(flushTimer);

              const lastPage = expectingHistory ? 0xb7 : 0x73;
              if (data[0] === lastPage) return flush();

              const midBody = dataStream.some((page) => page[0] !== 0xa0);
              flushTimer = setTimeout(flush, midBody ? BODY_FLUSH_MS : HEADER_FLUSH_MS);
            });

            await withTimeout(char.subscribeAsync(), CONNECT_TIMEOUT_MS, 'subscribe');
            console.log(`Subscribed to: ${subChar}`);
          }

          if (char.uuid == writeChar) {
            writeCharacteristic = char;
          }
        }
      }

      // the link may have dropped while we were still discovering
      if (peripheral.state !== 'connected') throw new Error('peripheral disconnected during setup');

      bleEvents.emit('device', 'connected');
    } catch (err) {
      console.error(`BLE setup failed: ${err.message}, retrying...`);
      writeCharacteristic = null;
      peripheral.removeAllListeners('disconnect');
      connecting = false;
      peripheral.disconnectAsync().catch(() => {});
      noble.startScanningAsync([], false);
    }

    // console.log('\n==========================================\n');
    // await peripheral.disconnectAsync();
    // console.log('Disconnected. Recon complete.');
    // process.exit(0);
  });
}
