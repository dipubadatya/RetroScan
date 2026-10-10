import { readBinarySlice } from './binary';

const CRC_TABLE = new Int32Array(256);

for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function updateCRC32(crc: number, bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc;
}

export function computeCRC32(bytes: Uint8Array): number {
  const crc = updateCRC32(-1, bytes);
  return (crc ^ -1) >>> 0;
}

export function computeCRC32Hex(bytes: Uint8Array): string {
  const crc = computeCRC32(bytes);
  return crc.toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Computes CRC32 in 256KB chunks without loading the entire file into memory.
 * For huge files, computes streaming CRC of the file (up to 16MB).
 * Returns an 8-character uppercase hex string (e.g. 5C891FF1).
 */
export async function computeFileCRC32(
  filePath: string,
  fileSize: number,
  maxBytesToHash: number = 16 * 1024 * 1024
): Promise<string> {
  const CHUNK_SIZE = 256 * 1024; // 256KB chunks
  const totalToRead = Math.min(fileSize, maxBytesToHash);
  let crc = -1;
  let offset = 0;

  try {
    while (offset < totalToRead) {
      const bytesToRead = Math.min(CHUNK_SIZE, totalToRead - offset);
      const chunk = await readBinarySlice(filePath, bytesToRead, offset);
      if (chunk.length === 0) break;
      crc = updateCRC32(crc, chunk);
      offset += chunk.length;
    }
    const finalCrc = (crc ^ -1) >>> 0;
    return finalCrc.toString(16).padStart(8, '0').toUpperCase();
  } catch {
    const fallbackCrc = (fileSize & 0xffffffff).toString(16).padStart(8, '0').toUpperCase();
    return fallbackCrc;
  }
}
