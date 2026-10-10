import RNFS from 'react-native-fs';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);

for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/[\r\n\s]/g, '');
  const len = clean.length;
  if (len === 0) {
    return new Uint8Array(0);
  }

  let padding = 0;
  if (clean.charAt(len - 1) === '=') padding++;
  if (clean.charAt(len - 2) === '=') padding++;

  const byteLength = ((len * 3) >> 2) - padding;
  const buffer = new Uint8Array(byteLength);

  let outIndex = 0;
  for (let i = 0; i < len; i += 4) {
    const b0 = B64_LOOKUP[clean.charCodeAt(i)];
    const b1 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const b2 = B64_LOOKUP[clean.charCodeAt(i + 2)];
    const b3 = B64_LOOKUP[clean.charCodeAt(i + 3)];

    if (outIndex < byteLength) buffer[outIndex++] = (b0 << 2) | (b1 >> 4);
    if (outIndex < byteLength) buffer[outIndex++] = ((b1 & 15) << 4) | (b2 >> 2);
    if (outIndex < byteLength) buffer[outIndex++] = ((b2 & 3) << 6) | b3;
  }

  return buffer;
}

export function uint8ArrayToAscii(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c >= 32 && c <= 126) {
      result += String.fromCharCode(c);
    }
  }
  return result;
}

export function uint8ArrayToRawString(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    chunks.push(String.fromCharCode.apply(null, slice as any));
  }
  return chunks.join('');
}

export async function readBinarySlice(
  filePath: string,
  length: number,
  position: number = 0
): Promise<Uint8Array> {
  if (length <= 0) {
    return new Uint8Array(0);
  }
  const base64 = await RNFS.read(filePath, length, position, 'base64');
  return base64ToUint8Array(base64);
}
