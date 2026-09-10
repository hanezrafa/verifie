const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const iconDir = path.join(__dirname, 'assets', 'icons');

// Create a simple 1x1 blue PNG as placeholder
function createBluePNG(size) {
  const header = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const ihdrChunk = createChunk('IHDR', ihdr);

  const rawData = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    rawData[i * 3] = 59;
    rawData[i * 3 + 1] = 130;
    rawData[i * 3 + 2] = 246;
  }

  const idatChunk = createChunk('IDAT', rawData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

sizes.forEach(size => {
  const png = createBluePNG(size);
  const filePath = path.join(iconDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath}`);
});

console.log('Icons created successfully!');
