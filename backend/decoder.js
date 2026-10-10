const COUNTER_BYTEPOS = 9;
const PAGE_BYTEPOS = 0;
const LAUNCHERMODE_BYTEPOS = 3;
const HIGHSCORE_BYTEPOS = 7;
const ENTRIES_SUM_BYTEPOS = 11;
const CHECKSUM_BYTEPOS = 16;
const BATTERY_BYTEPOS = 4;

let globalCounter = undefined;
const RESET_ACK_PAGE = 0xa1;

export function battlepassDecoder(payload) {
  console.log(payload);

  const battlepass = {
    highScore: undefined,
    launchesValues: [],
    lifetimeCounter: undefined,
    status: "unknown",
    battery: undefined
  };

  const isReset = payload.some((page) => page[PAGE_BYTEPOS] === RESET_ACK_PAGE);

  if (isReset) {
    globalCounter = undefined;
    battlepass.status = "reset";
    battlepass.lifetimeCounter = 0;
    return battlepass;
  }

  // header decoder
  const isHeaderOnly = payload.every((page) => page[PAGE_BYTEPOS] === 0xa0);

  if (isHeaderOnly) {
    // one or more events (dropped or attached bey), e.g. attach + drop arriving
    // in the same flush window: decode in order so the last event wins
    for (const header of payload) {
      const launchesCounter = header.readUInt16LE(COUNTER_BYTEPOS);
      const status = header[LAUNCHERMODE_BYTEPOS].toString(16);
      const highScore = header.readUInt16LE(HIGHSCORE_BYTEPOS);
      const batteryValue = (header[BATTERY_BYTEPOS] * 100) / 255;

      if (status === '4') {
        globalCounter = launchesCounter;

        battlepass.status = "attached";
        battlepass.lifetimeCounter = launchesCounter;
        battlepass.highScore = highScore;
        battlepass.battery = batteryValue;
      } else if (status === '0' && launchesCounter <= globalCounter) {
        battlepass.status = "dropped";
        battlepass.lifetimeCounter = launchesCounter;
        battlepass.highScore = highScore;
      }
    }
  } else {
    // body decoder
    const bodyPages =
      payload.filter((item) => item[0].toString(16).match(/^b[0-7]/));

    const liveRecording = payload.some((item) => item[0].toString(16).match(/^7[0-3]/));

    if (bodyPages.length !== 8) {
      throw Error("Pages incomplete!");
    }

    const numEntries = bodyPages[6][ENTRIES_SUM_BYTEPOS];

    const launches = [];

    let byteSum = 0;

    bodyPages.slice(0, 7).forEach((item) => {
      for (let i = 1; i < item.length; i = i + 2) {
        const currentLaunch = item.readUInt16LE(i);
        // process.stdout.write(currentLaunch + " ");
        if (launches.length < numEntries) {
          launches.push(currentLaunch);
        }
      }

      byteSum += item.slice(1).reduce((partialSum, entry) => partialSum + entry, 0);
    });

    if ((byteSum % 256) !== bodyPages[7][CHECKSUM_BYTEPOS]) {
      throw new Error("Checksum doesn't match!");
    };

    battlepass.status = liveRecording ? (numEntries > 0 ? "launched" : "reset") : 'history';
    battlepass.launchesValues = launches;
    battlepass.highScore = bodyPages[6].readUInt16LE(HIGHSCORE_BYTEPOS);
    battlepass.lifetimeCounter = bodyPages[6].readUInt16LE(COUNTER_BYTEPOS);

    const header = payload.find((page) => page[PAGE_BYTEPOS] === 0xa0);
    if (header) {
      battlepass.battery = (header[BATTERY_BYTEPOS] * 100) / 255;
    }
  }

  return battlepass;
}

// const initialPayload = [Buffer.from('a03a0004fe00006210110035b40451c4da', 'hex')];
// const failedPayload = [Buffer.from('a03a0000f500006210110035b40451c4da', 'hex')];
// console.log(battlepassDecoder(initialPayload));
// console.log(battlepassDecoder(failedPayload));

// const actualHeader = [Buffer.from('a03a0004ff00006210100035b40451c4da', 'hex')];
// const actualSequence =
//   [
//     Buffer.from('a03a0000f500006210110035b40451c4da', 'hex'),
//     Buffer.from('b0460c460da3079b0dd90e9c0bdc0fbc0a', 'hex'),
//     Buffer.from('b19407340862106b083a0b1c09910d960a', 'hex'),
//     Buffer.from('b2e00a0000000000000000000000000000', 'hex'),
//     Buffer.from('b300000000000000000000000000000000', 'hex'),
//     Buffer.from('b400000000000000000000000000000000', 'hex'),
//     Buffer.from('b500000000000000000000000000000000', 'hex'),
//     Buffer.from('b600000000000062101100110000000000', 'hex'),
//     Buffer.from('b700000000000000000000000000000018', 'hex'),
//     Buffer.from('7098f1690ec10a850a840c680e5331a10e', 'hex'),
//     Buffer.from('71320d0000000000000000000000000000', 'hex'),
//     Buffer.from('7200000000000000000000000000000000', 'hex'),
//     Buffer.from('7300000000000000000000000000000000', 'hex')
//   ];

// const actualHeader = [Buffer.from("a03a0004ff00004525360035b40451c4da", "hex")]
// const actualSequence = [
//   Buffer.from("a03a0000ff00004525370035b40451c4da", "hex"),
//   Buffer.from("b0c7144e1198131812590b1b10b309f80c", "hex"),
//   Buffer.from("b1290d8806a209a30d3c0a220bc40a0401", "hex"),
//   Buffer.from("b2670c910d4e04090b7403860d350ba004", "hex"),
//   Buffer.from("b30e0be713b31538059e04c8136116dd10", "hex"),
//   Buffer.from("b42e15b50eb20b480ca60ca90c2d0d200d", "hex"),
//   Buffer.from("b5cb0d550e470dbc0d360d2c132f104e22", "hex"),
//   Buffer.from("b64525fc21000045253700320000000000", "hex"),
//   Buffer.from("b7000000000000000000000000000000e9", "hex"),
//   Buffer.from("70e4f6d2109a07a905c3043504d1038d03", "hex"),
//   Buffer.from("715e036a03aa038b0391039f03b003bc03", "hex"),
//   Buffer.from("72c503e803f10309042604380455046b04", "hex"),
//   Buffer.from("739604aa04d004de04eb040c052c055005", "hex")
// ]

// console.log(battlepassDecoder(actualHeader));
// console.log(battlepassDecoder(actualSequence));
