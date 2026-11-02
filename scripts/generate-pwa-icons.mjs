import fs from "fs";
import zlib from "zlib";
import path from "path";

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngRgba(buffer) {
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat = [];

  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    if (type === "IHDR") {
      width = buffer.readUInt32BE(pos + 8);
      height = buffer.readUInt32BE(pos + 12);
    } else if (type === "IDAT") {
      idat.push(buffer.slice(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4; // RGBA
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * 4);

  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawOffset++];
    const lineOffset = y * stride;
    const prevLineOffset = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const byte = raw[rawOffset++];
      const a = x >= bpp ? pixels[lineOffset + x - bpp] : 0;
      const b = y > 0 ? pixels[prevLineOffset + x] : 0;
      const c = y > 0 && x >= bpp ? pixels[prevLineOffset + x - bpp] : 0;

      let val = 0;
      switch (filter) {
        case 0: // None
          val = byte;
          break;
        case 1: // Sub
          val = (byte + a) & 0xff;
          break;
        case 2: // Up
          val = (byte + b) & 0xff;
          break;
        case 3: // Average
          val = (byte + Math.floor((a + b) / 2)) & 0xff;
          break;
        case 4: // Paeth
          val = (byte + paethPredictor(a, b, c)) & 0xff;
          break;
        default:
          val = byte;
      }
      pixels[lineOffset + x] = val;
    }
  }

  return { width, height, pixels };
}

function encodePngRgba(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0; // Filter None
    const pxOffset = y * width * 4;
    pixels.copy(raw, rowOffset + 1, pxOffset, pxOffset + width * 4);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function scaleAndCenter(src, targetSize, paddingRatio = 0.08, bg = null) {
  const out = Buffer.alloc(targetSize * targetSize * 4);

  // Fill background if specified
  if (bg) {
    for (let i = 0; i < out.length; i += 4) {
      out[i] = bg[0];
      out[i + 1] = bg[1];
      out[i + 2] = bg[2];
      out[i + 3] = bg[3];
    }
  }

  const innerSize = targetSize * (1 - paddingRatio * 2);
  const scale = innerSize / Math.max(src.width, src.height);
  const drawW = Math.round(src.width * scale);
  const drawH = Math.round(src.height * scale);
  const offX = Math.round((targetSize - drawW) / 2);
  const offY = Math.round((targetSize - drawH) / 2);

  for (let y = 0; y < drawH; y++) {
    const srcY = Math.min(src.height - 1, Math.floor(y / scale));
    const targetY = offY + y;
    if (targetY < 0 || targetY >= targetSize) continue;

    for (let x = 0; x < drawW; x++) {
      const srcX = Math.min(src.width - 1, Math.floor(x / scale));
      const targetX = offX + x;
      if (targetX < 0 || targetX >= targetSize) continue;

      const srcIdx = (srcY * src.width + srcX) * 4;
      const targetIdx = (targetY * targetSize + targetX) * 4;

      const sa = src.pixels[srcIdx + 3] / 255;
      if (sa === 0) continue;

      if (!bg || sa === 1) {
        out[targetIdx] = src.pixels[srcIdx];
        out[targetIdx + 1] = src.pixels[srcIdx + 1];
        out[targetIdx + 2] = src.pixels[srcIdx + 2];
        out[targetIdx + 3] = src.pixels[srcIdx + 3];
      } else {
        // Alpha blend over background
        const da = 1 - sa;
        out[targetIdx] = Math.round(src.pixels[srcIdx] * sa + out[targetIdx] * da);
        out[targetIdx + 1] = Math.round(src.pixels[srcIdx + 1] * sa + out[targetIdx + 1] * da);
        out[targetIdx + 2] = Math.round(src.pixels[srcIdx + 2] * sa + out[targetIdx + 2] * da);
        out[targetIdx + 3] = 255;
      }
    }
  }

  return encodePngRgba(targetSize, targetSize, out);
}

// Read original logo.png
const logoBuf = fs.readFileSync("public/logo.png");
const decoded = decodePngRgba(logoBuf);

// Ensure icons folder exists
const iconsDir = path.resolve("public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. icon-192.png (Transparent background, standard)
fs.writeFileSync("public/icons/icon-192.png", scaleAndCenter(decoded, 192, 0.05));

// 2. icon-512.png (Transparent background, high-res)
fs.writeFileSync("public/icons/icon-512.png", scaleAndCenter(decoded, 512, 0.05));

// 3. icon-maskable-512.png (With safe zone 20% padding and dark navy brand background #090d16)
fs.writeFileSync(
  "public/icons/icon-maskable-512.png",
  scaleAndCenter(decoded, 512, 0.18, [9, 13, 22, 255])
);

// 4. apple-touch-icon.png (180x180 with solid navy brand background #090d16 for iOS)
fs.writeFileSync(
  "public/apple-touch-icon.png",
  scaleAndCenter(decoded, 180, 0.1, [9, 13, 22, 255])
);

// 5. SVG vector icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bgGrad)" />
  <circle cx="256" cy="256" r="190" fill="#ffffff" fill-opacity="0.08" />
  <path d="M140 372 L256 140 L372 372 Z" fill="#38bdf8" fill-opacity="0.25" />
  <path d="M170 340 L256 180 L342 340 Z" fill="#ffffff" fill-opacity="0.95" />
  <circle cx="256" cy="240" r="36" fill="#0284c7" />
  <path d="M120 380 C180 350, 332 350, 392 380" stroke="#38bdf8" stroke-width="14" stroke-linecap="round" fill="none" />
</svg>`;
fs.writeFileSync("public/icons/icon.svg", svg.trim());

console.log("All PWA icons successfully generated in public/ and public/icons/");
