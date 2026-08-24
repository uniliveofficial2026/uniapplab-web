import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve('.local-dev/v14-parity/debug-strips');
fs.mkdirSync(out, { recursive: true });
const dir = path.resolve('public/reference-approved/live-tools-v14-frontend');

const jobs = [
  ['gifts', '02-gifts-approved.jpeg'],
  ['stickers', '03-stickers-approved.jpeg'],
  ['voice', '04-voice-changer-approved.jpeg'],
  ['beauty', '05-beauty-effects-approved.jpeg'],
  ['games', '06-game-center-approved.jpeg'],
];

for (const [name, file] of jobs) {
  for (const y of [800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1280, 1360, 1440]) {
    await sharp(path.join(dir, file))
      .extract({ left: 0, top: y, width: 711, height: Math.min(60, 1536 - y) })
      .jpeg({ quality: 80 })
      .toFile(path.join(out, `${name}-y${y}.jpg`));
  }
}

// guests denser around sheet
for (const y of [930, 950, 970, 990, 1010, 1030, 1220, 1260, 1300, 1340, 1380, 1420, 1460]) {
  await sharp(path.join(dir, '01-guests-approved.jpeg'))
    .extract({ left: 0, top: y, width: 711, height: Math.min(40, 1536 - y) })
    .jpeg({ quality: 80 })
    .toFile(path.join(out, `guests-y${y}.jpg`));
}

console.log('dense strips ok');
