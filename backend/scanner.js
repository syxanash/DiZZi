import noble from '@abandonware/noble';
import EventEmitter from 'events';
import { battlepassDecoder } from './decoder.js';

export const bleEvents = new EventEmitter();

const peripheralName = 'BEYBLADE_TOOL01';
const subChar = '55c4f002f8eb11ecb9390242ac120002';
const writeChar = '55c4f001f8eb11ecb9390242ac120002';

let writeCharacteristic = null;

export async function sendReset() {
  if (!writeCharacteristic) throw new Error('Beyblade tool not connected');
  await writeCharacteristic.writeAsync(Buffer.from([0x75]), true);
}

export async function getRecordings() {
  if (!writeCharacteristic) throw new Error('Beyblade tool not connected');
  await writeCharacteristic.writeAsync(Buffer.from([0x74]), true);
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

    if (name === peripheralName) {
      await noble.stopScanningAsync();
      await peripheral.connectAsync();

      console.log(`Connected to ${peripheralName}, GATT map below:`);

      peripheral.once('disconnect', () => {
        console.log(`Bluetooth ${peripheralName} disconnected...`);
        bleEvents.emit('device', 'disconnected');
        writeCharacteristic = null;
        noble.startScanningAsync([], false);
      });

      const services = await peripheral.discoverServicesAsync([]);

      for (const service of services) {
        console.log(`\nService UUID: ${service}`);

        const characteristics = await service.discoverCharacteristicsAsync([]);

        for (const char of characteristics) {
          console.log(`  └─ Characteristic: ${char.uuid}`);
          console.log(`     Properties:     [ ${char.properties.join(', ')} ]`);

          if (char.properties.includes('read')) {
            try {
              const data = await char.readAsync();
              console.log(`     Read Value:     ${Buffer.from(data.toString('hex'), 'hex').toString('utf8')}`);
            } catch (e) {
              console.log(`     Read Value:     Failed to read (${e.message})`);
            }
          }

          if (char.uuid == subChar) {
            char.on('data', (data) => {
              dataStream.push(data);

              clearTimeout(flushTimer);
              flushTimer = setTimeout(() => {
                // const formattedDate = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
                // const payload = {[formattedDate]: dataStream };

                const payload = dataStream;
                dataStream = [];

                processPayload(payload);
              }, 700);
            });

            await char.subscribeAsync();
            console.log(`Subscribed to: ${subChar}`);
          }

          if (char.uuid == writeChar) {
            writeCharacteristic = char;
          }
        }
      }

      bleEvents.emit('device', 'connected');
    }

    // console.log('\n==========================================\n');
    // await peripheral.disconnectAsync();
    // console.log('Disconnected. Recon complete.');
    // process.exit(0);
  });
}
