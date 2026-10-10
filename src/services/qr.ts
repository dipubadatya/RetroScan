import { CONSOLE_CONFIG, CONSOLE_IDS } from '../constants/consoles';
import { ConsoleId, IdentityType, ScannedQRPayload } from '../types';

export function encodeQRPayload(
  consoleId: ConsoleId,
  type: IdentityType,
  value: string
): string {
  const consoleTag = CONSOLE_CONFIG[consoleId]?.qrAlias || consoleId;
  return `${consoleTag}:${type}:${value}`;
}

export function parseQRPayload(raw: string): ScannedQRPayload | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  if (trimmed.toUpperCase().startsWith('RETROSCAN:')) {
    trimmed = trimmed.substring('RETROSCAN:'.length).trim();
  }
  const parts = trimmed.split(':');
  if (parts.length < 3) return null;

  const rawConsole = parts[0].toUpperCase();
  const typePart = parts[1].toUpperCase();
  const value = parts.slice(2).join(':');

  if (typePart !== 'S' && typePart !== 'N' && typePart !== 'H') {
    return null;
  }

  let matchedConsole: ConsoleId | null = null;
  if (rawConsole === 'A2600' || rawConsole === 'ATARI2600') {
    matchedConsole = 'Atari2600';
  } else {
    for (const id of CONSOLE_IDS) {
      if (id.toUpperCase() === rawConsole) {
        matchedConsole = id;
        break;
      }
    }
  }

  if (!matchedConsole || !value) {
    return null;
  }

  return {
    console: matchedConsole,
    type: typePart as IdentityType,
    value,
    raw: trimmed,
  };
}
