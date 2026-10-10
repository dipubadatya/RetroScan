export type ConsoleId =
  | 'PS2'
  | 'PSP'
  | 'PS1'
  | 'GBA'
  | 'GB'
  | 'GBC'
  | 'N64'
  | 'SNES'
  | 'NES'
  | 'Genesis'
  | 'Atari2600';

export type IdentityType = 'S' | 'N' | 'H';

export interface GameIdentity {
  type: IdentityType;
  value: string;
  title: string;
  serial?: string | null;
  nativeId?: string | null;
  crc?: string | null;
  gameKey?: string;
  detectedConsole?: ConsoleId;
}

export interface GameRecord {
  id: number;
  console: ConsoleId;
  name: string;
  title: string;
  file_path: string;
  filePath: string;
  file_name?: string;
  fileName?: string;
  file_size: number;
  fileSize: number;
  serial: string | null;
  native_id?: string | null;
  nativeId?: string | null;
  crc: string | null;
  id_type: IdentityType;
  identityType: IdentityType;
  id_value: string;
  identityValue: string;
  game_key: string;
  qrPayload: string;
  content_uri?: string | null;
  contentUri?: string | null;
  extension?: string;
  emulator_id?: string | null;
  emulatorId?: string | null;
  emulator_pkg?: string | null;
  emulatorPkg?: string | null;
  lastScannedAt: number;
  createdAt?: number;
}

export interface ScannedQRPayload {
  console: ConsoleId;
  type: IdentityType;
  value: string;
  raw: string;
}

export interface IndexerProgress {
  total: number;
  processed: number;
  currentFile: string;
  currentConsole: ConsoleId | null;
  addedCount: number;
}

export type RootStackParamList = {
  Library: undefined;
  FolderScanner: undefined;
  Scanner: undefined;
  GameDetail: { gameId: number; game?: GameRecord };
  Settings: undefined;
};
