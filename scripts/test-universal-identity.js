const assert = require('assert');
const { DatabaseSync } = require('node:sqlite');

console.log('=== RETROSCAN UNIVERSAL DETERMINISTIC IDENTITY & SHARING TEST ===\n');

// 1. Test cleanTitleFromFilename and generateCanonicalSlug logic
function cleanTitleFromFilename(fileName) {
  let base = fileName.replace(/\.[^/.]+$/, '');
  base = base.replace(/^\d{1,5}\s*[-_.]\s*/, '');
  base = base.replace(/\s*(\([^)]*\)|\[[^\]]*\])\s*/g, ' ');
  base = base.replace(/\b(version|rev\s*\w*|v\d+(\.\d+)?|disc\s*\d+|cd\s*\d+)\b/gi, ' ');
  base = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const articleMatch = base.match(/^(.+?),\s*(The|A|An)$/i);
  if (articleMatch) {
    base = `${articleMatch[2]} ${articleMatch[1]}`;
  }
  return base || fileName.replace(/\.[^/.]+$/, '');
}

function generateCanonicalSlug(titleOrFileName) {
  const cleanTitle = cleanTitleFromFilename(titleOrFileName);
  const slugified = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slugified || 'unknown_game';
}

console.log('--- 1. Testing Deterministic Canonical Slug Across Diverse ROM Dumps ---');
const emeraldDumps = [
  'Pokemon - Emerald Version (USA, Europe).gba',
  '1986 - Pokemon Emerald (U) [!].zip',
  'Pokemon Emerald.gba',
  'Pokemon - Emerald Version (USA) (Rev 1).gba',
  'Pokemon Emerald Version.gba',
];

const emeraldSlug = generateCanonicalSlug(emeraldDumps[0]);
console.log(`Reference Dump: "${emeraldDumps[0]}" -> Slug: "${emeraldSlug}"`);

for (const dump of emeraldDumps) {
  const s = generateCanonicalSlug(dump);
  console.log(`Checking dump: "${dump}" -> Slug: "${s}"`);
  assert.strictEqual(s, 'pokemon_emerald', `All dumps of Pokemon Emerald must yield identical slug 'pokemon_emerald'`);
}
console.log('✓ All 5 variations of Pokemon Emerald produce identical slug: "pokemon_emerald"!\n');

const smwDumps = [
  'Super Mario World (USA).sfc',
  'Super Mario World (Europe) (Rev 1).smc',
  '0042 - Super Mario World [!].sfc',
  'Super Mario World.sfc',
];

for (const dump of smwDumps) {
  const s = generateCanonicalSlug(dump);
  console.log(`Checking dump: "${dump}" -> Slug: "${s}"`);
  assert.strictEqual(s, 'super_mario_world', `All dumps of SMW must yield identical slug 'super_mario_world'`);
}
console.log('✓ All 4 variations of Super Mario World produce identical slug: "super_mario_world"!\n');

// 2. Test SQLite Card Bindings (Zero Waste Guarantee)
console.log('--- 2. Testing SQLite Card Bindings (Friend Sharing & Custom ROMs) ---');
const db = new DatabaseSync(':memory:');

db.exec(`
CREATE TABLE games (
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

CREATE TABLE card_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_payload TEXT UNIQUE NOT NULL,
  game_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
`);

// Insert user B's custom game (e.g. friend has a translation or hack)
db.exec(`
INSERT INTO games (game_key, console, id_type, id_value, name, file_path, file_name, file_size, serial, crc, emulator_pkg, updated_at)
VALUES ('GBA:N:my_emerald_hack', 'GBA', 'N', 'my_emerald_hack', 'Pokemon Emerald Kaizo', '/roms/gba/kaizo.gba', 'kaizo.gba', 16000000, null, null, 'com.fastemulator.gba', 1000);
`);

const friendGame = db.prepare('SELECT * FROM games WHERE name = ?').get('Pokemon Emerald Kaizo');
assert.ok(friendGame);

// Friend scans User A's physical printed card: "GBA:S:BPEE"
const printedCardPayload = 'GBA:S:BPEE';

// Initial scan: not bound, so lookup in card_bindings returns null
let bound = db.prepare('SELECT g.* FROM games g JOIN card_bindings b ON g.id = b.game_id WHERE b.card_payload = ?').get(printedCardPayload);
assert.strictEqual(bound, undefined, 'Initially unbound');

// Friend taps "Link to Game in Library" -> binds printed card to their custom ROM
db.prepare('INSERT INTO card_bindings (card_payload, game_id, created_at) VALUES (?, ?, ?)').run(printedCardPayload, friendGame.id, Date.now());

// Subsequent scan: immediately finds friend's game!
bound = db.prepare('SELECT g.* FROM games g JOIN card_bindings b ON g.id = b.game_id WHERE b.card_payload = ?').get(printedCardPayload);
assert.ok(bound, 'Must find bound game');
assert.strictEqual(bound.name, 'Pokemon Emerald Kaizo');
assert.strictEqual(bound.file_path, '/roms/gba/kaizo.gba');
console.log('✓ Manual Card Binding successfully links physical card "GBA:S:BPEE" to friend\'s local ROM!\n');

// 3. Test QR Prefix Compatibility
console.log('--- 3. Testing QR Payload Normalization & Prefix Compatibility ---');
function parseQRPayload(raw) {
  if (!raw) return null;
  let trimmed = raw.trim();
  if (trimmed.toUpperCase().startsWith('RETROSCAN:')) {
    trimmed = trimmed.substring('RETROSCAN:'.length).trim();
  }
  const parts = trimmed.split(':');
  if (parts.length < 3) return null;
  return { console: parts[0].toUpperCase(), type: parts[1].toUpperCase(), value: parts.slice(2).join(':') };
}

const p1 = parseQRPayload('GBA:S:BPEE');
assert.deepStrictEqual(p1, { console: 'GBA', type: 'S', value: 'BPEE' });

const p2 = parseQRPayload('RETROSCAN:GBA:S:BPEE');
assert.deepStrictEqual(p2, { console: 'GBA', type: 'S', value: 'BPEE' });

const p3 = parseQRPayload('PS2:S:SLUS-21376');
assert.deepStrictEqual(p3, { console: 'PS2', type: 'S', value: 'SLUS-21376' });

console.log('✓ Both standard and RETROSCAN: prefixed payloads parse identically!\n');

console.log('ALL UNIVERSAL IDENTITY TESTS PASSED WITH 100% SUCCESS!');
