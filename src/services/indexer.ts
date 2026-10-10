import RNFS from 'react-native-fs';
import { detectConsoleFromExtension } from '../constants/consoles';
import { DEFAULT_EMULATORS, EMULATORS } from '../constants/emulators';
import { ConsoleId, GameRecord, IndexerProgress } from '../types';
import { readBinarySlice, uint8ArrayToAscii } from '../utils/binary';
import { batchUpsertGames } from './database';
import { identifyROM } from './identifier';
import { encodeQRPayload } from './qr';

interface DiscoveredFile {
  path: string;
  name: string;
  size: number;
  consoleId: ConsoleId;
}

async function getZipInnerName(filePath: string): Promise<string | null> {
  try {
    const bytes = await readBinarySlice(filePath, 256, 0);
    if (
      bytes.length > 30 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    ) {
      const fnLen = bytes[26] | (bytes[27] << 8);
      if (fnLen > 0 && 30 + fnLen <= bytes.length) {
        return uint8ArrayToAscii(bytes.slice(30, 30 + fnLen)).trim();
      }
    }
  } catch { }
  return null;
}

export class RomIndexer {
  private isCancelled: boolean = false;

  public cancel(): void {
    this.isCancelled = true;
  }

  public async scanAndIndexDirectory(
    rootPath: string,
    onProgress?: (progress: IndexerProgress) => void
  ): Promise<{ totalFound: number; indexedCount: number; errors: number }> {
    this.isCancelled = false;
    const discovered: DiscoveredFile[] = [];

    await this.collectRomFiles(rootPath, discovered, true);

    const total = discovered.length;
    let indexedCount = 0;
    let errorCount = 0;
    const CHUNK_SIZE = 10;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      if (this.isCancelled) {
        break;
      }

      const chunk = discovered.slice(i, i + CHUNK_SIZE);
      const batchToInsert: Omit<GameRecord, 'id'>[] = [];

      for (const item of chunk) {
        if (this.isCancelled) break;

        try {
          const identity = await identifyROM(
            item.consoleId,
            item.path,
            item.name,
            item.size
          );

          const finalConsole = identity.detectedConsole || item.consoleId;

          const gameKey =
            identity.gameKey ||
            encodeQRPayload(finalConsole, identity.type, identity.value);

          const ext =
            item.name.lastIndexOf('.') > 0
              ? item.name.substring(item.name.lastIndexOf('.')).toLowerCase()
              : '';

          const defaultPkg =
            DEFAULT_EMULATORS[finalConsole]?.packageName ||
            EMULATORS[finalConsole] ||
            '';

          batchToInsert.push({
            console: finalConsole,
            name: identity.title,
            title: identity.title,
            file_path: item.path,
            filePath: item.path,
            file_name: item.name,
            fileName: item.name,
            file_size: item.size,
            fileSize: item.size,
            serial: identity.serial || null,
            native_id: identity.nativeId || identity.serial || null,
            nativeId: identity.nativeId || identity.serial || null,
            crc: identity.crc || null,
            id_type: identity.type,
            identityType: identity.type,
            id_value: identity.value,
            identityValue: identity.value,
            game_key: gameKey,
            qrPayload: gameKey,
            extension: ext,
            content_uri: null,
            contentUri: null,
            emulator_id: null,
            emulatorId: null,
            emulator_pkg: defaultPkg,
            emulatorPkg: defaultPkg,
            lastScannedAt: Date.now(),
            createdAt: Date.now(),
          });

          indexedCount++;

          if (onProgress) {
            onProgress({
              total,
              processed: indexedCount + errorCount,
              currentFile: item.name,
              currentConsole: finalConsole,
              addedCount: indexedCount,
            });
          }
        } catch (err) {
          console.warn(`Failed to process ROM: ${item.name}`, err);
          errorCount++;
        }
      }

      if (batchToInsert.length > 0) {
        await batchUpsertGames(batchToInsert);
      }

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return {
      totalFound: total,
      indexedCount,
      errors: errorCount,
    };
  }

  private async collectRomFiles(
    dirPath: string,
    results: DiscoveredFile[],
    isRoot: boolean = false
  ): Promise<void> {
    if (this.isCancelled) return;

    try {
      const items = await RNFS.readDir(dirPath);

      for (const item of items) {
        if (this.isCancelled) return;
        if (item.name.startsWith('.')) continue;

        if (item.isDirectory()) {
          await this.collectRomFiles(item.path, results, false);
        } else if (item.isFile()) {
          let consoleId = detectConsoleFromExtension(item.name, item.path);
          if (!consoleId && item.name.toLowerCase().endsWith('.zip')) {
            const innerName = await getZipInnerName(item.path);
            if (innerName) {
              consoleId = detectConsoleFromExtension(innerName, item.path);
            }
          }

          if (consoleId) {
            results.push({
              path: item.path,
              name: item.name,
              size: Number(item.size),
              consoleId,
            });
          }
        }
      }
    } catch (err: any) {
      if (isRoot) {
        throw new Error(
          `Cannot read folder: ${err?.message || 'Access Denied'}. Ensure storage permissions are granted.`
        );
      }
    }
  }
}
