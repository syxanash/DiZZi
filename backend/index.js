const noble = require('@abandonware/noble');

const peripheralName = 'BEYBLADE_TOOL01';
const subChar = '55c4f002f8eb11ecb9390242ac120002';
const writeChar = '55c4f001f8eb11ecb9390242ac120002'
const packets = [];
let dataStream = [];
let flushTimer = undefined;

function processPayload() {
  console.log('===== PROCESSED PAYLOADS ======')
  console.log(packets);
}

noble.on('stateChange', state => {
  console.log('Bluetooth state:', state);
  if (state === 'poweredOn') {
    noble.startScanning([], false); // false = no duplicates
  }
});

noble.on('discover', async (peripheral) => {
  const name = peripheral.advertisement.localName;

  // Skip unnamed devices
  if (!name) return;

  console.log(`Found: ${name} | RSSI: ${peripheral.rssi}`);

  if (name === peripheralName) {
    await noble.stopScanningAsync();

    await peripheral.connectAsync();

    console.log('connected!!! GATT MAP BELOW:');

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
          char.on('data', (data, isNotification) => {
            dataStream.push(data);

            clearTimeout(flushTimer)
            flushTimer = setTimeout(() => {
              const formattedDate = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
              packets.push({ [formattedDate]: dataStream });
              dataStream = [];

              processPayload();
            }, 500);
          });

          await char.subscribeAsync();
          console.log('Subscribed!');
        }

        // if (char.uuid == writeChar) {
        //   console.log('found the write charact...');

        //   setTimeout(() => {
        //     console.log('asking for data...');
        //     char.write(Buffer.from([0x75]), true);
        //   }, 3000);
        // }
      }
    }

    console.log('nothing else on this device...');
  }

  // console.log('\n==========================================\n');
  // await peripheral.disconnectAsync();
  // console.log('Disconnected. Recon complete.');
  // process.exit(0);
});
