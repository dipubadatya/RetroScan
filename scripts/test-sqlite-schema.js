const assert = require('assert');
const { DatabaseSync } = require('node:sqlite');

console.log('=== RETROSCAN SQLITE SCHEMA & QUERY VERIFICATION TEST ===\n');

const db = new DatabaseSync(':memory:');

// Test 1: Simulate old broken table
console.log('--- 1. Testing Legacy Broken Schema Detection & Drop ---');
db.exec('CREATE TABLE games (game_key TEXT PRIMARY KEY, title TEXT, filePath TEXT, emulatorPkg TEXT);');
let cols = db.prepare('PRAGMA table_info(games);').all().map(c => c.name);
console.log('Detected legacy columns:', cols);
let isOutdated = cols.includes('filePath') || cols.includes('emulatorPkg');
assert.strictEqual(isOutdated, true, 'Old table must be recognized as outdated');

if (isOutdated) {
  db.exec('DROP TABLE IF EXISTS games;');
  db.exec('PRAGMA user_version = 2;');
}
console.log('✓ Successfully wiped legacy broken table and updated user_version to 2');

// Test 2: Clean Schema Creation
console.log('\n--- 2. Testing Clean SQLite Schema Creation ---');
const schemaSql = `
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
CREATE INDEX IF NOT EXISTS idx_game_key ON games(game_key);
CREATE INDEX IF NOT EXISTS idx_games_console ON games(console);
CREATE INDEX IF NOT EXISTS idx_games_serial ON games(serial);
CREATE INDEX IF NOT EXISTS idx_games_file_path ON games(file_path);
`;
db.exec(schemaSql);

const newCols = db.prepare('PRAGMA table_info(games);').all().map(c => c.name);
console.log('Clean table columns:', newCols);
assert.deepStrictEqual(newCols, [
  'id',
  'game_key',
  'console',
  'id_type',
  'id_value',
  'name',
  'file_path',
  'file_name',
  'file_size',
  'serial',
  'crc',
  'emulator_pkg',
  'updated_at'
]);
console.log('✓ All 13 columns match clean snake_case schema perfectly!');

// Test 3: Insert with clean snake_case
console.log('\n--- 3. Testing Pure snake_case INSERT ---');
const insertSql = `
INSERT INTO games (
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
  updated_at = excluded.updated_at;
`;

const stmt = db.prepare(insertSql);
stmt.run(
  'PS2:S:SLUS-21376',
  'PS2',
  'S',
  'SLUS-21376',
  'God Hand',
  '/storage/emulated/0/Download/godhand.iso',
  'godhand.iso',
  1234567,
  'SLUS-21376',
  null,
  'xyz.aethersx2.android',
  1000
);

let row = db.prepare('SELECT * FROM games WHERE game_key = ?').get('PS2:S:SLUS-21376');
console.log('Inserted game:', row);
assert.strictEqual(row.game_key, 'PS2:S:SLUS-21376');
assert.strictEqual(row.name, 'God Hand');
assert.strictEqual(row.file_path, '/storage/emulated/0/Download/godhand.iso');
assert.strictEqual(row.emulator_pkg, 'xyz.aethersx2.android');
console.log('✓ Insert successful without emulatorPkg error');

// Test 4: Upsert on conflict (rescan / moved file)
console.log('\n--- 4. Testing ON CONFLICT(game_key) DO UPDATE ---');
stmt.run(
  'PS2:S:SLUS-21376',
  'PS2',
  'S',
  'SLUS-21376',
  'God Hand (USA)',
  '/storage/emulated/0/ROMs/PS2/godhand.iso',
  'godhand.iso',
  1234567,
  'SLUS-21376',
  null,
  'xyz.aethersx2.android',
  2000
);

row = db.prepare('SELECT * FROM games WHERE game_key = ?').get('PS2:S:SLUS-21376');
console.log('Updated game:', row);
assert.strictEqual(row.name, 'God Hand (USA)');
assert.strictEqual(row.file_path, '/storage/emulated/0/ROMs/PS2/godhand.iso');
assert.strictEqual(row.updated_at, 2000);
const count = db.prepare('SELECT COUNT(*) as count FROM games').get().count;
assert.strictEqual(count, 1, 'Should still only have 1 row');
console.log('✓ Upsert on conflict works as expected');

// Test 5: Search Query
console.log('\n--- 5. Testing Search Query ---');
const searchSql = 'SELECT * FROM games WHERE (name LIKE ? OR serial LIKE ? OR crc LIKE ? OR id_value LIKE ? OR game_key LIKE ?) ORDER BY name COLLATE NOCASE ASC;';
const term = '%God%';
const searchResults = db.prepare(searchSql).all(term, term, term, term, term);
assert.strictEqual(searchResults.length, 1);
console.log('✓ Search query succeeds with clean column names');

// Test 6: Identity Lookup Query
console.log('\n--- 6. Testing Identity Lookup Query ---');
const identitySql = `SELECT * FROM games 
WHERE game_key = ?
   OR (console = ? 
       AND id_type = ?
       AND (id_value = ? OR serial = ? OR crc = ?))
LIMIT 1;`;
const key = 'PS2:S:SLUS-21376';
const serial = 'SLUS-21376';
const found = db.prepare(identitySql).get(key, 'PS2', 'S', serial, serial, serial);
assert.ok(found, 'Should find game by identity');
assert.strictEqual(found.name, 'God Hand (USA)');
console.log('✓ Identity lookup query succeeds with clean column names');

console.log('\nALL 6 TESTS PASSED FLAWLESSLY!');
