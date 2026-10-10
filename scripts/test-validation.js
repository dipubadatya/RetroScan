const assert = require('assert');

console.log('=== CORE ARCHITECTURAL LAWS VALIDATION TEST ===\n');

// LAW 1 & 2: PS2 & PSP Serial Regex Normalization
console.log('--- 1. Testing PS2 Serial Regex with EAS/EAM/SLUS ---');
const PS_SERIAL_REGEX = /(SLUS|SLES|SCUS|SCES|SLPM|SLPS|SCAJ|SCKA|SLKA|EAS|EAM|SCED|SLED|SCPS|SLAJ)[-_ ]?(\d{3})\.?(\d{2})/i;

function normPs(str) {
  const m = str.match(PS_SERIAL_REGEX);
  return m ? `${m[1].toUpperCase()}-${m[2]}${m[3]}` : null;
}

assert.strictEqual(normPs('SLUS_213.76'), 'SLUS-21376');
assert.strictEqual(normPs('SLUS-213.76'), 'SLUS-21376');
assert.strictEqual(normPs('SLUS_21376'), 'SLUS-21376');
assert.strictEqual(normPs('EAS_001.23'), 'EAS-00123');
assert.strictEqual(normPs('EAM-123.45'), 'EAM-12345');
assert.strictEqual(normPs('BOOT2 = cdrom0:\\SLUS_213.76;1'), 'SLUS-21376');
console.log('✓ PS2 matches: SLUS_213.76, SLUS-213.76, SLUS_21376, EAS, EAM all normalize to PREFIX-XXXXX');

console.log('\n--- 2. Testing PSP Serial Regex ---');
const PSP_SERIAL_REGEX = /(ULUS|ULES|UCUS|UCES|ULJM|ULJS|UCAS|UCKS|NPEG|NPUG|NPUZ|NPEZ)[-_ ]?(\d{3})\.?(\d{2})|((?:ULUS|ULES|UCUS|UCES|ULJM|ULJS)[-_ ]?(\d{5}))/i;

function normPsp(str) {
  const m = str.match(PSP_SERIAL_REGEX);
  if (!m) return null;
  if (m[1] && m[2] && m[3]) return `${m[1].toUpperCase()}-${m[2]}${m[3]}`;
  if (m[4] && m[5]) return `${m[4].substring(0, 4).toUpperCase()}-${m[5]}`;
  return null;
}

assert.strictEqual(normPsp('ULUS-10235'), 'ULUS-10235');
assert.strictEqual(normPsp('ULUS_102.35'), 'ULUS-10235');
assert.strictEqual(normPsp('ULUS10235'), 'ULUS-10235');
console.log('✓ PSP matches: ULUS-10235, ULUS_102.35, ULUS10235 all normalize to ULUS-XXXXX');

// LAW 1: Priority Order
console.log('\n--- 3. Testing Strict Priority Order (S -> H -> N) ---');
function resolveIdentity(consoleId, serial, crc, slug) {
  if (serial) {
    return { type: 'S', key: `${consoleId}:S:${serial}` };
  }
  if (crc) {
    return { type: 'H', key: `${consoleId}:H:${crc}` };
  }
  return { type: 'N', key: `${consoleId}:N:${slug}` };
}

const resPs2 = resolveIdentity('PS2', 'SLUS-21376', '5C891FF1', 'god_hand_a1b2');
assert.strictEqual(resPs2.key, 'PS2:S:SLUS-21376', 'Serial must take strict priority over CRC and Slug');
console.log('✓ Serial priority verified: PS2:S:SLUS-21376 (takes priority over CRC and Slug)');

const resSnes = resolveIdentity('SNES', null, '5C891FF1', 'super_mario_world_a1b2');
assert.strictEqual(resSnes.key, 'SNES:H:5C891FF1', 'CRC must take priority over Slug when serial absent');
console.log('✓ CRC priority verified: SNES:H:5C891FF1 (takes priority over Slug)');

const resAtari = resolveIdentity('ATARI', null, null, 'pitfall_a1b2');
assert.strictEqual(resAtari.key, 'ATARI:N:pitfall_a1b2', 'Slug used only when serial and CRC absent');
console.log('✓ Slug fallback verified: ATARI:N:pitfall_a1b2');

// LAW 3: Rescan & Re-download Resolution
console.log('\n--- 4. Testing Rescan & Re-download Path Resolution ---');
const dbSim = new Map();

function upsertGame(gameRecord) {
  const existing = dbSim.get(gameRecord.game_key);
  if (existing) {
    // If game_key ALREADY exists in SQLite, DO NOT create new entry.
    // Execute an UPDATE on file_path = new_path and updated_at = timestamp.
    existing.file_path = gameRecord.file_path;
    existing.updated_at = gameRecord.updated_at;
  } else {
    dbSim.set(gameRecord.game_key, { ...gameRecord });
  }
}

// Initial scan
const initialScan = {
  game_key: 'PS2:S:SLUS-21376',
  console: 'PS2',
  name: 'God Hand',
  file_path: '/storage/emulated/0/Download/God Hand (USA).chd',
  updated_at: 1000,
};
upsertGame(initialScan);
assert.strictEqual(dbSim.size, 1);
assert.strictEqual(dbSim.get('PS2:S:SLUS-21376').file_path, '/storage/emulated/0/Download/God Hand (USA).chd');

// Re-download / moved to organized folder
const rescanned = {
  game_key: 'PS2:S:SLUS-21376',
  console: 'PS2',
  name: 'God Hand (USA)',
  file_path: '/storage/emulated/0/ROMS/PS2/God Hand (USA).chd',
  updated_at: 2000,
};
upsertGame(rescanned);
assert.strictEqual(dbSim.size, 1, 'Entry count must remain 1 (no duplicates on re-download)');
assert.strictEqual(dbSim.get('PS2:S:SLUS-21376').file_path, '/storage/emulated/0/ROMS/PS2/God Hand (USA).chd', 'file_path must update to new path');
assert.strictEqual(dbSim.get('PS2:S:SLUS-21376').updated_at, 2000);
console.log('✓ Re-download path resolution verified: path updated seamlessly without creating duplicate entries; QR key PS2:S:SLUS-21376 remains 100% stable');

console.log('\nALL CORE ARCHITECTURAL LAW TESTS PASSED SUCCESSFULLY!');
