import SQLite from 'react-native-sqlite-storage';
import {
  CONSOLE_EMULATOR_OPTIONS,
  DEFAULT_EMULATORS,
  EMULATORS,
  EmulatorConfig,
} from '../constants/emulators';
import { CONSOLE_IDS } from '../constants/consoles';
import { parseQRPayload } from './qr';
import { ConsoleId, GameRecord, IdentityType } from '../types';
import { generateCanonicalSlug } from '../utils/slug';

SQLite.enablePromise(true);

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function mapGameRow(row: any): GameRecord {
  const serial = row.serial || null;
  const crc = row.crc || null;
  const idType: IdentityType = (row.id_type ||
    (serial ? 'S' : crc ? 'H' : 'N')) as IdentityType;
  const idValue = row.id_value || serial || crc || '';
  const gameKey =
    row.game_key || `${row.console}:${idType}:${idValue}`;
  const name = row.name || 'Unknown Game';
  const filePath = row.file_path || '';
  const fileName =
    row.file_name ||
    (filePath ? filePath.substring(filePath.lastIndexOf('/') + 1) : name);
  const fileSize = row.file_size || 0;
  const emulatorPkg = row.emulator_pkg || null;
  const updatedAt = row.updated_at || Date.now();
  const extension =
    fileName && fileName.lastIndexOf('.') > 0
      ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      : undefined;

  return {
    id: row.id || 0,
    console: row.console,
    name,
    title: name,
    file_path: filePath,
    filePath,
    file_name: fileName,
    fileName,
    file_size: fileSize,
    fileSize,
    serial,
    native_id: serial,
    nativeId: serial,
    crc,
    id_type: idType,
    identityType: idType,
    id_value: idValue,
    identityValue: idValue,
    game_key: gameKey,
    qrPayload: gameKey,
    content_uri: null,
    contentUri: null,
    extension,
    emulator_id: null,
    emulatorId: null,
    emulator_pkg: emulatorPkg,
    emulatorPkg,
    lastScannedAt: updatedAt,
    createdAt: updatedAt,
  };
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabase({
    name: 'retroscan.db',
    location: 'default',
  });

  await db.executeSql('PRAGMA foreign_keys = ON;');
  await db.executeSql('PRAGMA journal_mode = WAL;');

  // Check current schema version and existing table columns
  let currentVersion = 0;
  try {
    const [versionRes] = await db.executeSql('PRAGMA user_version;');
    if (versionRes && versionRes.rows && versionRes.rows.length > 0) {
      currentVersion = versionRes.rows.item(0).user_version || 0;
    }
  } catch { }

  const existingColumns: string[] = [];
  try {
    const [columnsRes] = await db.executeSql('PRAGMA table_info(games);');
    if (columnsRes && columnsRes.rows) {
      for (let i = 0; i < columnsRes.rows.length; i++) {
        existingColumns.push(columnsRes.rows.item(i).name);
      }
    }
  } catch { }

  // Force drop if table has old camelCase schema or is on legacy version
  const isOutdated =
    currentVersion < 2 ||
    existingColumns.includes('filePath') ||
    existingColumns.includes('title') ||
    existingColumns.includes('qrPayload') ||
    existingColumns.includes('emulatorPkg') ||
    (existingColumns.length > 0 && !existingColumns.includes('emulator_pkg'));

  if (isOutdated) {
    await db.executeSql('DROP TABLE IF EXISTS games;');
    await db.executeSql('PRAGMA user_version = 2;');
  }

  // Clean SQLite schema strictly using snake_case
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_key TEXT UNIQUE NOT NULL,
      console TEXT NOT NULL,
      id_type TEXT NOT NULL,
      id_value TEXT NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      serial TEXT,
      crc TEXT,
      emulator_pkg TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_game_key ON games(game_key);');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_games_console ON games(console);');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_games_serial ON games(serial);');
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_games_file_path ON games(file_path);');

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS emulator_settings (
      console TEXT PRIMARY KEY,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      packageName TEXT NOT NULL,
      className TEXT,
      action TEXT,
      category TEXT,
      extraKey TEXT,
      useFileUri INTEGER,
      preferred_core TEXT,
      ps2_boot_mode TEXT
    );
  `);

  try {
    await db.executeSql('ALTER TABLE emulator_settings ADD COLUMN preferred_core TEXT;');
  } catch {}
  try {
    await db.executeSql('ALTER TABLE emulator_settings ADD COLUMN ps2_boot_mode TEXT;');
  } catch {}

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS card_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_payload TEXT UNIQUE NOT NULL,
      game_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );
  `);
  await db.executeSql('CREATE INDEX IF NOT EXISTS idx_card_bindings_payload ON card_bindings(card_payload);');

  dbInstance = db;
  return dbInstance;
}

export async function batchUpsertGames(
  games: Omit<GameRecord, 'id'>[]
): Promise<void> {
  if (games.length === 0) return;
  const db = await getDatabase();
  const now = Date.now();

  await db.transaction(tx => {
    for (const game of games) {
      const serial = game.serial || game.nativeId || null;
      const crc = game.crc || null;
      const idType =
        game.id_type || game.identityType || (serial ? 'S' : crc ? 'H' : 'N');
      const idValue =
        game.id_value || game.identityValue || serial || crc || '';
      const gameKey =
        game.game_key ||
        game.qrPayload ||
        `${game.console}:${idType}:${idValue}`;
      const name = game.name || game.title || 'Unknown Game';
      const filePath = game.file_path || game.filePath || '';
      const fileName =
        game.file_name ||
        game.fileName ||
        (filePath ? filePath.substring(filePath.lastIndexOf('/') + 1) : name);
      const fileSize = game.file_size || game.fileSize || 0;
      const emulatorPkg =
        game.emulator_pkg ||
        game.emulatorPkg ||
        DEFAULT_EMULATORS[game.console]?.packageName ||
        EMULATORS[game.console] ||
        '';
      const updatedAt = now;

      // Pure snake_case INSERT with ON CONFLICT UPDATE
      tx.executeSql(
        `INSERT INTO games (
           game_key, console, id_type, id_value, name,
           file_path, file_name, file_size, serial, crc,
           emulator_pkg, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(game_key) DO UPDATE SET
           file_path = excluded.file_path,
           file_name = excluded.file_name,
           file_size = excluded.file_size,
           name = excluded.name,
           serial = excluded.serial,
           crc = excluded.crc,
           emulator_pkg = excluded.emulator_pkg,
           updated_at = excluded.updated_at;`,
        [
          gameKey,
          game.console,
          idType,
          idValue,
          name,
          filePath,
          fileName,
          fileSize,
          serial,
          crc,
          emulatorPkg,
          updatedAt,
        ]
      );
    }
  });
}

export async function getAllGames(
  consoleFilter?: ConsoleId,
  searchQuery?: string
): Promise<GameRecord[]> {
  const db = await getDatabase();
  let sql = 'SELECT * FROM games';
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (consoleFilter) {
    conditions.push('console = ?');
    params.push(consoleFilter);
  }

  if (searchQuery && searchQuery.trim().length > 0) {
    conditions.push(
      '(name LIKE ? OR serial LIKE ? OR crc LIKE ? OR id_value LIKE ? OR game_key LIKE ?)'
    );
    const term = `%${searchQuery.trim()}%`;
    params.push(term, term, term, term, term);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ' ORDER BY name COLLATE NOCASE ASC;';

  const [results] = await db.executeSql(sql, params);
  const rows: GameRecord[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    rows.push(mapGameRow(results.rows.item(i)));
  }
  return rows;
}

export async function getGameById(id: number | string): Promise<GameRecord | null> {
  const db = await getDatabase();
  const [results] = await db.executeSql(
    'SELECT * FROM games WHERE game_key = ? OR id = ? LIMIT 1;',
    [id, id]
  );
  if (results.rows.length > 0) {
    return mapGameRow(results.rows.item(0));
  }
  return null;
}

export async function findGameByQRPayload(
  qrPayload: string
): Promise<GameRecord | null> {
  const db = await getDatabase();
  const clean = qrPayload.trim();
  const [results] = await db.executeSql(
    'SELECT * FROM games WHERE game_key = ? LIMIT 1;',
    [clean]
  );
  if (results.rows.length > 0) {
    return mapGameRow(results.rows.item(0));
  }
  return null;
}

export async function findGameByIdentity(
  consoleId: ConsoleId,
  identityType: IdentityType,
  identityValue: string
): Promise<GameRecord | null> {
  const db = await getDatabase();
  const clean = identityValue.trim();
  const key = `${consoleId}:${identityType}:${clean}`;
  const [results] = await db.executeSql(
    `SELECT * FROM games 
     WHERE game_key = ?
        OR (console = ? 
            AND id_type = ?
            AND (id_value = ? OR serial = ? OR crc = ?))
     LIMIT 1;`,
    [key, consoleId, identityType, clean, clean, clean]
  );
  if (results.rows.length > 0) {
    return mapGameRow(results.rows.item(0));
  }
  return null;
}

export async function bindCardToGame(
  cardPayload: string,
  gameId: number
): Promise<void> {
  const db = await getDatabase();
  const clean = cardPayload.trim();
  const now = Date.now();
  await db.executeSql(
    `INSERT INTO card_bindings (card_payload, game_id, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(card_payload) DO UPDATE SET
       game_id = excluded.game_id,
       created_at = excluded.created_at;`,
    [clean, gameId, now]
  );
}

export async function getBoundGame(
  cardPayload: string
): Promise<GameRecord | null> {
  const db = await getDatabase();
  const clean = cardPayload.trim();
  const [results] = await db.executeSql(
    `SELECT g.* FROM games g
     JOIN card_bindings b ON g.id = b.game_id
     WHERE b.card_payload = ?
     LIMIT 1;`,
    [clean]
  );
  if (results.rows.length > 0) {
    return mapGameRow(results.rows.item(0));
  }
  return null;
}

export async function unbindCard(cardPayload: string): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM card_bindings WHERE card_payload = ?;', [
    cardPayload.trim(),
  ]);
}

export async function findGameByAnyMatch(
  rawInput: string
): Promise<GameRecord | null> {
  if (!rawInput) return null;
  const clean = rawInput.trim();
  const db = await getDatabase();

  // 0. Check manual card bindings (User or friend explicitly bound this card)
  const bound = await getBoundGame(clean);
  if (bound) return bound;

  // 1. Try direct exact match on game_key or qrPayload
  const byPayload = await findGameByQRPayload(clean);
  if (byPayload) return byPayload;

  // 2. Try parse standard 3-part payload (CONSOLE:TYPE:VALUE)
  const parsed = parseQRPayload(clean);
  if (parsed) {
    const direct = await findGameByIdentity(
      parsed.console,
      parsed.type,
      parsed.value
    );
    if (direct) return direct;

    // Smart cascade for friends & cross-platform:
    // Strip trailing 4-char hex if present from older slugs (e.g. pokemon_emerald_4a21 -> pokemon_emerald)
    const baseSlug = parsed.value.replace(/_[0-9a-fA-F]{4}$/, '');
    const [slugMatches] = await db.executeSql(
      `SELECT * FROM games 
       WHERE console = ? 
         AND (id_value = ? 
              OR id_value LIKE ?
              OR serial = ?
              OR name LIKE ? 
              OR file_name LIKE ?)
       ORDER BY 
         CASE 
           WHEN id_value = ? THEN 1
           WHEN serial = ? THEN 2
           WHEN id_value LIKE ? THEN 3
           ELSE 4
         END
       LIMIT 1;`,
      [
        parsed.console,
        baseSlug,
        `${baseSlug}%`,
        parsed.value,
        `%${baseSlug.replace(/_/g, '%')}%`,
        `%${baseSlug.replace(/_/g, '%')}%`,
        baseSlug,
        parsed.value,
        `${baseSlug}%`,
      ]
    );
    if (slugMatches.rows.length > 0) {
      return mapGameRow(slugMatches.rows.item(0));
    }

    // Try matching canonical slugs of all games for this console
    const consoleGames = await getAllGames(parsed.console);
    for (const g of consoleGames) {
      const gSlug = generateCanonicalSlug(g.fileName || g.name);
      if (gSlug === baseSlug || gSlug.includes(baseSlug) || baseSlug.includes(gSlug)) {
        return g;
      }
    }
  }

  // 3. Try 2-part CONSOLE:NAME format (e.g. "PS2:Bully" or "GBA:Pokemon Emerald")
  if (clean.includes(':')) {
    const colonIdx = clean.indexOf(':');
    const prefix = clean.substring(0, colonIdx).trim().toUpperCase();
    const rest = clean.substring(colonIdx + 1).trim();

    const matchedConsole = CONSOLE_IDS.find(
      c => c.toUpperCase() === prefix || (c === 'Atari2600' && (prefix === 'ATARI' || prefix === 'A2600'))
    );

    if (matchedConsole && rest.length > 0) {
      const [res] = await db.executeSql(
        `SELECT * FROM games 
         WHERE console = ? 
           AND (name = ? COLLATE NOCASE 
                OR file_name = ? COLLATE NOCASE
                OR name LIKE ? 
                OR file_name LIKE ?
                OR serial = ? 
                OR crc = ?)
         ORDER BY 
           CASE 
             WHEN name = ? COLLATE NOCASE THEN 1
             WHEN file_name = ? COLLATE NOCASE THEN 2
             WHEN name LIKE ? THEN 3
             ELSE 4
           END
         LIMIT 1;`,
        [matchedConsole, rest, rest, `%${rest}%`, `%${rest}%`, rest, rest, rest, rest, `${rest}%`]
      );
      if (res.rows.length > 0) {
        return mapGameRow(res.rows.item(0));
      }

      const restSlug = generateCanonicalSlug(rest);
      const consoleGames = await getAllGames(matchedConsole);
      for (const g of consoleGames) {
        const gSlug = generateCanonicalSlug(g.fileName || g.name);
        if (gSlug === restSlug || gSlug.includes(restSlug) || restSlug.includes(gSlug)) {
          return g;
        }
      }
    }
  }

  // 4. Try matching by exact name, filename, serial, crc, id_value across all consoles
  const [exactRes] = await db.executeSql(
    `SELECT * FROM games 
     WHERE name = ? COLLATE NOCASE
        OR file_name = ? COLLATE NOCASE
        OR serial = ? 
        OR crc = ? 
        OR id_value = ? 
        OR game_key = ?
     LIMIT 1;`,
    [clean, clean, clean, clean, clean, clean]
  );
  if (exactRes.rows.length > 0) {
    return mapGameRow(exactRes.rows.item(0));
  }

  // 5. Try substring / LIKE search across name and filename
  const term = `%${clean}%`;
  const [likeRes] = await db.executeSql(
    `SELECT * FROM games 
     WHERE name LIKE ? 
        OR file_name LIKE ?
     ORDER BY 
       CASE 
         WHEN name LIKE ? THEN 1
         ELSE 2
       END
     LIMIT 1;`,
    [term, term, `${clean}%`]
  );
  if (likeRes.rows.length > 0) {
    return mapGameRow(likeRes.rows.item(0));
  }

  // 6. Fuzzy alphanumeric matching (e.g. "Pokemon Emerald" matches "Pokemon - Emerald Version (USA).gba")
  const cleanAlpha = clean.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleanAlpha.length >= 3) {
    const allGames = await getAllGames();
    for (const g of allGames) {
      const gNameAlpha = (g.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const gFileAlpha = (g.fileName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (
        gNameAlpha.includes(cleanAlpha) ||
        cleanAlpha.includes(gNameAlpha) ||
        gFileAlpha.includes(cleanAlpha)
      ) {
        return g;
      }
    }
  }

  return null;
}

export async function deleteGame(idOrKey: number | string): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM games WHERE game_key = ? OR id = ?;', [idOrKey, idOrKey]);
  await db.executeSql('DELETE FROM card_bindings WHERE card_payload = ? OR game_id = ?;', [idOrKey, idOrKey]);
}

export async function clearAllGames(): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM games;');
}

export async function getCustomEmulatorSettings(): Promise<
  Record<string, EmulatorConfig>
> {
  const db = await getDatabase();
  const [results] = await db.executeSql('SELECT * FROM emulator_settings;');
  const settings: Record<string, EmulatorConfig> = {};
  for (let i = 0; i < results.rows.length; i++) {
    const row = results.rows.item(i);
    settings[row.console] = {
      id: row.id,
      name: row.name,
      packageName: row.packageName,
      className: row.className || undefined,
      action: row.action || undefined,
      category: row.category || undefined,
      extraKey: row.extraKey || undefined,
      useFileUri: row.useFileUri === 1,
      preferredCore: row.preferred_core || undefined,
      ps2BootMode: row.ps2_boot_mode || undefined,
    };
  }
  return settings;
}

export async function saveCustomEmulatorSetting(
  consoleId: ConsoleId,
  config: EmulatorConfig
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO emulator_settings (console, id, name, packageName, className, action, category, extraKey, useFileUri, preferred_core, ps2_boot_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(console) DO UPDATE SET
       id = excluded.id,
       name = excluded.name,
       packageName = excluded.packageName,
       className = excluded.className,
       action = excluded.action,
       category = excluded.category,
       extraKey = excluded.extraKey,
       useFileUri = excluded.useFileUri,
       preferred_core = excluded.preferred_core,
       ps2_boot_mode = excluded.ps2_boot_mode;`,
    [
      consoleId,
      config.id,
      config.name,
      config.packageName,
      config.className || null,
      config.action || null,
      config.category || null,
      config.extraKey || null,
      config.useFileUri ? 1 : 0,
      config.preferredCore || null,
      config.ps2BootMode || null,
    ]
  );
}

export const saveEmulatorSetting = saveCustomEmulatorSetting;

export async function resetEmulatorSetting(consoleId: ConsoleId): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM emulator_settings WHERE console = ?;', [consoleId]);
}

export async function getLibraryStats(): Promise<{
  total: number;
  byConsole: Record<string, number>;
}> {
  const db = await getDatabase();
  const [totalRes] = await db.executeSql('SELECT COUNT(*) as count FROM games;');
  const total = totalRes.rows.item(0).count;

  const [groupRes] = await db.executeSql(
    'SELECT console, COUNT(*) as count FROM games GROUP BY console;'
  );
  const byConsole: Record<string, number> = {};
  for (let i = 0; i < groupRes.rows.length; i++) {
    const item = groupRes.rows.item(i);
    byConsole[item.console] = item.count;
  }

  return { total, byConsole };
}

const Database = {
  getDatabase,
  mapGameRow,
  batchUpsertGames,
  getAllGames,
  getGameById,
  findGameByQRPayload,
  findGameByIdentity,
  findGameByAnyMatch,
  deleteGame,
  clearAllGames,
  getCustomEmulatorSettings,
  saveCustomEmulatorSetting,
  saveEmulatorSetting,
  resetEmulatorSetting,
  getLibraryStats,
  bindCardToGame,
  getBoundGame,
  unbindCard,
};

export default Database;
