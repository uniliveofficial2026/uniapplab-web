import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve('.local-dev/v14-parity/debug-strips');
fs.mkdirSync(out, { recursive: true });
const dir = path.resolve('public/reference-approved/live-tools-v14-frontend');
const refs = {
  guests: '01-guests-approved.jpeg',
  gifts: '02-gifts-approved.jpeg',
  stickers: '03-stickers-approved.jpeg',
  voice: '04-voice-changer-approved.jpeg',
  beauty: '05-beauty-effects-approved.jpeg',
  games: '06-game-center-approved.jpeg',
};

async function strip(name, file, y, h = 80) {
  await sharp(path.join(dir, file))
    .extract({ left: 0, top: y, width: 711, height: Math.min(h, 1536 - y) })
    .jpeg({ quality: 75 })
    .toFile(path.join(out, `${name}-y${y}.jpg`));
}

for (const y of [880, 960, 1040, 1120, 1200, 1280, 1360, 1440]) await strip('guests', refs.guests, y, 90);
for (const y of [520, 560, 600, 640, 700, 760]) await strip('gifts', refs.gifts, y, 70);
for (const y of [480, 520, 560, 600]) await strip('voice', refs.voice, y, 70);
for (const y of [520, 580, 640]) await strip('stickers', refs.stickers, y, 70);
for (const y of [520, 580, 640]) await strip('beauty', refs.beauty, y, 70);
for (const y of [520, 580, 640]) await strip('games', refs.games, y, 70);
console.log('ok', out);
