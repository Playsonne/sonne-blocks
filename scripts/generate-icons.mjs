// Original geometric mark. Reproducible PNG export, without remote assets or libraries.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
mkdirSync('public/icons', { recursive: true });
const crc32 = data => {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const bytes = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(bytes));
  return Buffer.concat([length, bytes, crc]);
};
function generate(size, maskable) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const shape = (x, y, a, b, w, r) => {
    const dx = Math.max(a + r - x, 0, x - (a + w - r));
    const dy = Math.max(b + r - y, 0, y - (b + w - r));
    return x >= a && y >= b && x <= a + w && y <= b + w && dx * dx + dy * dy <= r * r;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const scale = maskable ? .8 : 1;
    const px = (x / size * 64 - 32) / scale + 32, py = (y / size * 64 - 32) / scale + 32;
    let color = [38, 52, 36];
    if ([[14, 14], [34, 14], [14, 34]].some(([a, b]) => shape(px, py, a, b, 16, 3))) color = [213, 239, 160];
    if (shape(px, py, 36, 36, 12, 3)) color = [255, 173, 105];
    const i = y * (size * 4 + 1) + 1 + x * 4;
    raw.set([...color, 255], i);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const size of [192, 512]) writeFileSync(`public/icons/icon-${size}.png`, generate(size, false));
writeFileSync('public/icons/apple-touch-icon.png', generate(180, false));
writeFileSync('public/icons/maskable-512.png', generate(512, true));
console.log('Iconos PNG generados.');
