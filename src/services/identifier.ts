import { ConsoleId, GameIdentity } from '../types';
import { readBinarySlice, uint8ArrayToAscii, uint8ArrayToRawString } from '../utils/binary';
import { computeFileCRC32 } from '../utils/crc32';
import { cleanTitleFromFilename, generateFilenameSlug } from '../utils/slug';
import { encodeQRPayload } from './qr';

export async function identifyROM(
  consoleId: ConsoleId,
  filePath: string,
  fileName: string,
  fileSize: number
): Promise<GameIdentity> {
  const displayTitle = cleanTitleFromFilename(fileName);

  // 1. PRIORITY 1: Serial Number (S) (ALWAYS PREFERRED)
  let serial: string | null = null;
  let resolvedConsole: ConsoleId = consoleId;

  try {
    const extraction = await extractNativeSerialWithConsoleCheck(
      consoleId,
      filePath,
      fileName,
      fileSize
    );
    serial = extraction.serial;
    if (extraction.detectedConsole) {
      resolvedConsole = extraction.detectedConsole;
    }
  } catch (err) {
    console.warn('Native serial extraction error:', err);
  }

  // Compute 8-character uppercase CRC32 of first 1MB
  let crc: string | null = null;
  try {
    crc = await computeFileCRC32(filePath, fileSize, 1024 * 1024);
  } catch {
    crc = null;
  }

  console.log(`[RetroScan] File: ${fileName}`);
  console.log(`[RetroScan] Console: ${resolvedConsole}`);

  if (serial && serial.length > 0) {
    const gameKey = encodeQRPayload(resolvedConsole, 'S', serial);
    console.log(`[RetroScan] Identity strategy: Native Serial`);
    console.log(`[RetroScan] Native ID: ${serial}`);

    return {
      type: 'S',
      value: serial,
      title: displayTitle,
      serial,
      nativeId: serial,
      crc,
      gameKey,
      detectedConsole: resolvedConsole,
    };
  }

  console.log(`[RetroScan] Native ID not found`);

  // 2. PRIORITY 2: Content CRC32 (H)
  if (crc && crc.length === 8) {
    const gameKey = encodeQRPayload(resolvedConsole, 'H', crc);
    console.log(`[RetroScan] Identity strategy: Content CRC32`);
    console.log(`[RetroScan] CRC32: ${crc}`);

    return {
      type: 'H',
      value: crc,
      title: displayTitle,
      serial: null,
      nativeId: null,
      crc,
      gameKey,
      detectedConsole: resolvedConsole,
    };
  }

  // 3. PRIORITY 3: Clean Canonical Name Slug (N)
  const slug = generateFilenameSlug(fileName, fileSize);
  const gameKey = encodeQRPayload(resolvedConsole, 'N', slug);
  console.log(`[RetroScan] Identity strategy: Name Slug`);
  console.log(`[RetroScan] Identity: ${slug}`);

  return {
    type: 'N',
    value: slug,
    title: displayTitle,
    serial: null,
    nativeId: null,
    crc,
    gameKey,
    detectedConsole: resolvedConsole,
  };
}

interface ExtractionResult {
  serial: string | null;
  detectedConsole?: ConsoleId;
}

export async function extractNativeSerialWithConsoleCheck(
  consoleId: ConsoleId,
  filePath: string,
  fileName: string,
  fileSize: number
): Promise<ExtractionResult> {
  const serial = await extractNativeSerial(consoleId, filePath, fileName, fileSize);
  if (serial) {
    return { serial, detectedConsole: consoleId };
  }

  // For overlapping disc formats (.chd, .iso, .cso, .bin, .gz):
  if (consoleId === 'PS2') {
    const pspSerial = await extractPspSerial(filePath, fileSize);
    if (pspSerial) {
      return { serial: pspSerial, detectedConsole: 'PSP' };
    }
  } else if (consoleId === 'PSP') {
    const ps2Serial = await extractPsSerial(filePath, fileSize);
    if (ps2Serial) {
      return { serial: ps2Serial, detectedConsole: 'PS2' };
    }
  }

  return { serial: null };
}

export async function extractNativeSerial(
  consoleId: ConsoleId,
  filePath: string,
  fileName: string,
  fileSize: number
): Promise<string | null> {
  switch (consoleId) {
    case 'PS2':
    case 'PS1': {
      return extractPsSerial(filePath, fileSize);
    }

    case 'PSP': {
      return extractPspSerial(filePath, fileSize);
    }

    case 'GBA': {
      return extractGbaSerial(filePath, fileSize);
    }

    case 'GB':
    case 'GBC': {
      return extractGbSerial(filePath, fileSize);
    }

    case 'N64': {
      return extractN64Serial(filePath, fileSize);
    }

    case 'Genesis': {
      return extractGenesisSerial(filePath, fileSize);
    }

    case 'SNES': {
      return extractSnesSerial(filePath, fileSize);
    }

    case 'NES':
    case 'Atari2600':
    default:
      return null;
  }
}

// Regex for PS2: (SLUS|SLES|SCUS|SCES|SLPM|SLPS|SCAJ|SCKA|SLKA|EAS|EAM)[_ \-]?(\d{3})\.?(\d{2})
const PS_SERIAL_REGEX = /(SLUS|SLES|SCUS|SCES|SLPM|SLPS|SCAJ|SCKA|SLKA|EAS|EAM|SCED|SLED|SCPS|SLAJ)[-_ ]?(\d{3})\.?(\d{2})/i;

// Regex for PSP: (ULUS|ULES|UCUS|UCES|ULJM|ULJS)[_ \-]?\d{5}
const PSP_SERIAL_REGEX = /(ULUS|ULES|UCUS|UCES|ULJM|ULJS|UCAS|UCKS|NPEG|NPUG|NPUZ|NPEZ)[-_ ]?(\d{3})\.?(\d{2})|((?:ULUS|ULES|UCUS|UCES|ULJM|ULJS)[-_ ]?(\d{5}))/i;

// PS2 chunks at offsets: 0, 32KB, 64KB, 128KB, 1MB, 2MB
const PS2_SCAN_OFFSETS = [
  0,
  32 * 1024,
  64 * 1024,
  128 * 1024,
  1024 * 1024,
  2 * 1024 * 1024,
];
const CHUNK_WINDOW_SIZE = 512 * 1024; // 512KB

async function extractPsSerial(filePath: string, fileSize: number): Promise<string | null> {
  for (const offset of PS2_SCAN_OFFSETS) {
    if (offset >= fileSize) break;
    const length = Math.min(CHUNK_WINDOW_SIZE, fileSize - offset);
    try {
      const bytes = await readBinarySlice(filePath, length, offset);
      if (bytes.length === 0) continue;

      const rawText = uint8ArrayToRawString(bytes);
      const match = rawText.match(PS_SERIAL_REGEX);
      if (match) {
        const prefix = match[1].toUpperCase();
        const num1 = match[2];
        const num2 = match[3];
        return `${prefix}-${num1}${num2}`;
      }
    } catch { }
  }
  return null;
}

async function extractPspSerial(filePath: string, fileSize: number): Promise<string | null> {
  for (const offset of PS2_SCAN_OFFSETS) {
    if (offset >= fileSize) break;
    const length = Math.min(CHUNK_WINDOW_SIZE, fileSize - offset);
    try {
      const bytes = await readBinarySlice(filePath, length, offset);
      if (bytes.length === 0) continue;

      const rawText = uint8ArrayToRawString(bytes);
      const match = rawText.match(PSP_SERIAL_REGEX);
      if (match) {
        if (match[1] && match[2] && match[3]) {
          const prefix = match[1].toUpperCase();
          return `${prefix}-${match[2]}${match[3]}`;
        }
        if (match[4] && match[5]) {
          const prefix = match[4].substring(0, 4).toUpperCase();
          return `${prefix}-${match[5]}`;
        }
      }
    } catch { }
  }
  return null;
}

async function extractGbaSerial(filePath: string, fileSize: number): Promise<string | null> {
  if (fileSize < 0xb0) return null;
  try {
    // GBA binary offset 0xAC
    const bytes = await readBinarySlice(filePath, 4, 0xac);
    const code = uint8ArrayToAscii(bytes).trim();
    if (/^[A-Za-z0-9]{4}$/.test(code)) {
      return code.toUpperCase();
    }
  } catch { }
  return null;
}

async function extractGbSerial(filePath: string, fileSize: number): Promise<string | null> {
  if (fileSize < 0x144) return null;
  try {
    // GB/GBC binary offset 0x13F
    const bytes = await readBinarySlice(filePath, 4, 0x13f);
    const code = uint8ArrayToAscii(bytes).trim();
    if (/^[A-Za-z0-9]{4}$/.test(code)) {
      return code.toUpperCase();
    }
  } catch { }
  return null;
}

function normalizeN64HeaderBytes(rawBytes: Uint8Array): Uint8Array {
  if (rawBytes.length < 64) return rawBytes;
  const b0 = rawBytes[0];
  const b1 = rawBytes[1];
  const b2 = rawBytes[2];
  const b3 = rawBytes[3];

  const out = new Uint8Array(rawBytes.length);

  // Big-endian (z64): 0x80 0x37 0x12 0x40
  if (b0 === 0x80 && b1 === 0x37 && b2 === 0x12 && b3 === 0x40) {
    out.set(rawBytes);
    return out;
  }

  // Byte-swapped (v64): 0x37 0x80 0x40 0x12 -> swap every 2 adjacent bytes
  if (b0 === 0x37 && b1 === 0x80 && b2 === 0x40 && b3 === 0x12) {
    for (let i = 0; i < rawBytes.length - 1; i += 2) {
      out[i] = rawBytes[i + 1];
      out[i + 1] = rawBytes[i];
    }
    return out;
  }

  // Little-endian (n64): 0x40 0x12 0x37 0x80 -> reverse every 4 bytes
  if (b0 === 0x40 && b1 === 0x12 && b2 === 0x37 && b3 === 0x80) {
    for (let i = 0; i < rawBytes.length - 3; i += 4) {
      out[i] = rawBytes[i + 3];
      out[i + 1] = rawBytes[i + 2];
      out[i + 2] = rawBytes[i + 1];
      out[i + 3] = rawBytes[i];
    }
    return out;
  }

  out.set(rawBytes);
  return out;
}

async function extractN64Serial(filePath: string, fileSize: number): Promise<string | null> {
  if (fileSize < 0x40) return null;
  try {
    const rawBytes = await readBinarySlice(filePath, 64, 0);
    if (rawBytes.length < 64) return null;

    const normalized = normalizeN64HeaderBytes(rawBytes);
    // N64 binary offset 0x3B
    const codeBytes = normalized.slice(0x3b, 0x3f);
    const code = uint8ArrayToAscii(codeBytes).trim();
    if (/^[A-Za-z0-9]{4}$/.test(code)) {
      return code.toUpperCase();
    }
  } catch { }
  return null;
}

async function extractGenesisSerial(filePath: string, fileSize: number): Promise<string | null> {
  if (fileSize < 0x200) return null;
  try {
    const bytes = await readBinarySlice(filePath, 32, 0x180);
    const text = uint8ArrayToAscii(bytes).trim();
    const match = text.match(/(GM|T-|MK-|MP-)[A-Za-z0-9\-_ ]{4,12}/i);
    if (match) {
      return match[0].replace(/\s+/g, '-').toUpperCase();
    }
  } catch { }
  return null;
}

async function extractSnesSerial(filePath: string, fileSize: number): Promise<string | null> {
  const headerOffset = fileSize % 1024 === 512 ? 512 : 0;
  const offsets = [0x7fb2 + headerOffset, 0xffb2 + headerOffset];
  for (const off of offsets) {
    if (fileSize < off + 4) continue;
    try {
      const bytes = await readBinarySlice(filePath, 4, off);
      const code = uint8ArrayToAscii(bytes).trim();
      if (/^[A-Za-z0-9]{3,4}$/.test(code) && code !== '0000') {
        return code.toUpperCase();
      }
    } catch { }
  }
  return null;
}

