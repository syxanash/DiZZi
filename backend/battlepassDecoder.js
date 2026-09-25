const COUNTER_BYTEPOS = 9;
const PAGE_BYTEPOS = 0;
const STATUS_BYTEPOS = 3;
const HIGHSCORE_BYTEPOS = 8;
const ENTRIES_SUM_BYTEPOS = 11;
const CHECKSUM_BYTEPOS = 16;

let globalCounter = undefined;

export function battlepassDecoder(payload) {
  console.log(payload);

  const battlepass = {
    highScore: undefined,
    launchesValues: [],
    lifetimeCounter: undefined,
    status: "",
  };

  // header decoder
  if (payload.length <= 1 && payload[0][PAGE_BYTEPOS].toString(16) === 'a0') {
    const header = payload[0];
    // single event happend (either dropped or attached bey)
    const launchesCounter = header[COUNTER_BYTEPOS];
    const status = header[STATUS_BYTEPOS].toString(16);
    const highScore = parseInt(`0x${header[HIGHSCORE_BYTEPOS].toString(16)}${header[HIGHSCORE_BYTEPOS - 1].toString(16)}`, 16);

    if (status === '4') {
      globalCounter = launchesCounter;

      battlepass.status = "attached";
      battlepass.lifetimeCounter = launchesCounter;
      battlepass.highScore = highScore;
    } else if (status === '0' && launchesCounter <= globalCounter) {
      battlepass.status = "dropped";
      battlepass.lifetimeCounter = launchesCounter;
      battlepass.highScore = highScore;
    }
  } else {
    // body decoder
    const bodyPages =
      payload.filter((item) => item[0].toString(16).match(/b[0-7]/));

    const numEntries = bodyPages[6][ENTRIES_SUM_BYTEPOS];

    console.log(bodyPages);
    const launches = [];

    let byteSum = 0;

    bodyPages.slice(0, 7).forEach((item) => {
      for (let i = 2; i < item.length; i = i + 2) {
        const currentLaunch = parseInt(`${item[i].toString(16)}${item[i - 1].toString(16)}`, 16);
        // process.stdout.write(currentLaunch + " ");
        if (launches.length < numEntries) {
          launches.push(currentLaunch);
        }
      }
      
      byteSum += item.slice(1).reduce((partialSum, entry) => partialSum + entry, 0);
    });

    if ((byteSum % 256) !== bodyPages[7][CHECKSUM_BYTEPOS]) {
      console.log('NOT OK!');
    };

    battlepass.status = "launched";
    battlepass.launchesValues = launches;
    battlepass.highScore = parseInt(`${bodyPages[6][HIGHSCORE_BYTEPOS].toString(16)}${bodyPages[6][HIGHSCORE_BYTEPOS - 1].toString(16)}`, 16);
    battlepass.lifetimeCounter = parseInt(bodyPages[6][COUNTER_BYTEPOS].toString(16), 16);
  }

  return battlepass;
}

// const initialPayload = [Buffer.from('a03a0004fe00006210110035b40451c4da', 'hex')];
// const failedPayload = [Buffer.from('a03a0000f500006210110035b40451c4da', 'hex')];
// console.log(battlepassDecoder(initialPayload));
// console.log(battlepassDecoder(failedPayload));

const actualHeader = [Buffer.from('a03a0004ff00006210100035b40451c4da', 'hex')];
const actualSequence =
  [
    Buffer.from('a03a0000f500006210110035b40451c4da', 'hex'),
    Buffer.from('b0460c460da3079b0dd90e9c0bdc0fbc0a', 'hex'),
    Buffer.from('b19407340862106b083a0b1c09910d960a', 'hex'),
    Buffer.from('b2e00a0000000000000000000000000000', 'hex'),
    Buffer.from('b300000000000000000000000000000000', 'hex'),
    Buffer.from('b400000000000000000000000000000000', 'hex'),
    Buffer.from('b500000000000000000000000000000000', 'hex'),
    Buffer.from('b600000000000062101100110000000000', 'hex'),
    Buffer.from('b700000000000000000000000000000018', 'hex'),
    Buffer.from('7098f1690ec10a850a840c680e5331a10e', 'hex'),
    Buffer.from('71320d0000000000000000000000000000', 'hex'),
    Buffer.from('7200000000000000000000000000000000', 'hex'),
    Buffer.from('730000000000000000000000000000000', 'hex')
  ];

console.log(battlepassDecoder(actualHeader));
console.log(battlepassDecoder(actualSequence));
