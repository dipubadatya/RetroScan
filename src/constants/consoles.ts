import { ConsoleId } from '../types';

export interface ConsoleMeta {
  id: ConsoleId;
  name: string;
  extensions: string[];
  color: string;
  qrAlias?: string;
}

export const CONSOLE_CONFIG: Record<ConsoleId, ConsoleMeta> = {
  PS2: {
    id: 'PS2',
    name: 'PlayStation 2',
    extensions: ['.iso', '.chd', '.bin', '.cso', '.gz'],
    color: '#00439C',
  },
  PSP: {
    id: 'PSP',
    name: 'PlayStation Portable',
    extensions: ['.iso', '.cso', '.chd', '.pbp'],
    color: '#003791',
  },
  PS1: {
    id: 'PS1',
    name: 'PlayStation 1',
    extensions: ['.bin', '.cue', '.iso', '.chd', '.pbp', '.img'],
    color: '#2E6DB4',
  },
  GBA: {
    id: 'GBA',
    name: 'Game Boy Advance',
    extensions: ['.gba'],
    color: '#7000FF',
  },
  GB: {
    id: 'GB',
    name: 'Game Boy',
    extensions: ['.gb'],
    color: '#8B956D',
  },
  GBC: {
    id: 'GBC',
    name: 'Game Boy Color',
    extensions: ['.gbc'],
    color: '#C724B1',
  },
  N64: {
    id: 'N64',
    name: 'Nintendo 64',
    extensions: ['.z64', '.n64', '.v64'],
    color: '#E60012',
  },
  SNES: {
    id: 'SNES',
    name: 'Super Nintendo',
    extensions: ['.sfc', '.smc'],
    color: '#654EA3',
  },
  NES: {
    id: 'NES',
    name: 'Nintendo Entertainment System',
    extensions: ['.nes'],
    color: '#D82800',
  },
  Genesis: {
    id: 'Genesis',
    name: 'Sega Genesis / Mega Drive',
    extensions: ['.md', '.bin', '.smd', '.gen'],
    color: '#0080FF',
  },
  Atari2600: {
    id: 'Atari2600',
    name: 'Atari 2600',
    extensions: ['.a26', '.bin'],
    color: '#FF6F00',
    qrAlias: 'A2600',
  },
};

export const CONSOLE_IDS: ConsoleId[] = [
  'PS2',
  'PSP',
  'PS1',
  'GBA',
  'GB',
  'GBC',
  'N64',
  'SNES',
  'NES',
  'Genesis',
  'Atari2600',
];

export function detectConsoleFromExtension(
  fileName: string,
  filePath?: string
): ConsoleId | null {
  const lowerName = fileName.toLowerCase();

  // 1. Folder-based match FIRST if filePath is provided.
  // Multiple consoles share common formats (.iso, .chd, .cso, .bin, .pbp, .zip, .7z),
  // so folder structure (e.g. /psp/, /ps2/, /ps1/) is the definitive authority.
  if (filePath) {
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
    const segments = normalizedPath.split('/');

    for (let i = segments.length - 2; i >= 0; i--) {
      const seg = segments[i].trim();
      if (!seg) continue;

      if (seg === 'psp' || /\b(psp|playstation\s*portable)\b/i.test(seg)) return 'PSP';
      if (seg === 'ps2' || /\b(ps2|playstation\s*2)\b/i.test(seg)) return 'PS2';
      if (
        seg === 'ps1' ||
        seg === 'psx' ||
        /\b(ps1|psx|playstation\s*1)\b/i.test(seg) ||
        (/\bplaystation\b/i.test(seg) && !/\b(portable|2)\b/i.test(seg))
      ) {
        return 'PS1';
      }
      if (seg === 'gba' || /\b(gba|game\s*boy\s*advance)\b/i.test(seg)) return 'GBA';
      if (seg === 'gbc' || /\b(gbc|game\s*boy\s*color)\b/i.test(seg)) return 'GBC';
      if (seg === 'gb' || (/\bgame\s*boy\b/i.test(seg) && !/\b(advance|color)\b/i.test(seg))) {
        return 'GB';
      }
      if (seg === 'snes' || seg === 'sfc' || /\b(snes|sfc|super\s*nintendo)\b/i.test(seg)) return 'SNES';
      if (seg === 'nes' || seg === 'fds' || /\b(nes|fds|famicom|nintendo\s*entertainment)\b/i.test(seg)) return 'NES';
      if (seg === 'n64' || seg === 'n64dd' || /\b(n64|nintendo\s*64)\b/i.test(seg)) return 'N64';
      if (
        seg === 'genesis' ||
        seg === 'megadrive' ||
        seg === 'megadrivejp' ||
        seg === 'gen' ||
        seg === 'segacd' ||
        /\b(genesis|mega\s*drive|sega)\b/i.test(seg)
      ) {
        return 'Genesis';
      }
      if (
        seg === 'atari2600' ||
        seg === 'a2600' ||
        seg === 'atari' ||
        seg === 'a26' ||
        /\b(atari|a2600|2600)\b/i.test(seg)
      ) {
        return 'Atari2600';
      }
    }
  }

  // 2. Direct extension match fallback
  for (const id of CONSOLE_IDS) {
    const config = CONSOLE_CONFIG[id];
    for (const ext of config.extensions) {
      if (lowerName.endsWith(ext)) {
        return id;
      }
    }
  }

  return null;
}
