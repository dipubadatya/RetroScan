import { NativeModules, Alert } from 'react-native';
import IntentLauncher from 'react-native-intent-launcher';
import {
  CONSOLE_EMULATOR_OPTIONS,
  DEFAULT_EMULATORS,
  EmulatorConfig,
} from '../constants/emulators';
import { getCustomEmulatorSettings } from './database';
import { ConsoleId } from '../types';

const { RetroScanLauncher } = NativeModules;

export interface LaunchResult {
  success: boolean;
  packageName: string;
  emulatorName: string;
  coreUsed?: string;
  notInstalled?: boolean;
  error?: string;
}

/* ---------------- RetroArch cores (ordered best/recommended → fallbacks) ---------------- */
export const RETROARCH_CORES: Record<string, string[]> = {
  SNES: [
    'snes9x_libretro_android.so',
    'snes9x2010_libretro_android.so',
    'snes9x2005_libretro_android.so',
    'snes9x2005_plus_libretro_android.so',
    'snes9x2002_libretro_android.so',
    'bsnes_libretro_android.so',
    'bsnes_hd_beta_libretro_android.so',
    'mesen-s_libretro_android.so',
  ],
  N64: [
    'mupen64plus_next_gles3_libretro_android.so',
    'mupen64plus_next_libretro_android.so',
    'mupen64plus_next_gles2_libretro_android.so',
    'parallel_n64_libretro_android.so',
  ],
  GBA: [
    'mgba_libretro_android.so',
    'vba_next_libretro_android.so',
    'gpsp_libretro_android.so',
    'vbam_libretro_android.so',
  ],
  GB: [
    'gambatte_libretro_android.so',
    'sameboy_libretro_android.so',
    'gearboy_libretro_android.so',
    'mgba_libretro_android.so',
    'tgbdual_libretro_android.so',
  ],
  GBC: [
    'gambatte_libretro_android.so',
    'sameboy_libretro_android.so',
    'gearboy_libretro_android.so',
    'mgba_libretro_android.so',
    'tgbdual_libretro_android.so',
  ],
  NES: [
    'fceumm_libretro_android.so',
    'nestopia_libretro_android.so',
    'mesen_libretro_android.so',
    'quicknes_libretro_android.so',
  ],
  Genesis: [
    'genesis_plus_gx_libretro_android.so',
    'picodrive_libretro_android.so',
    'genesis_plus_gx_wide_libretro_android.so',
  ],
  PS1: [
    'pcsx_rearmed_libretro_android.so',
    'swanstation_libretro_android.so',
    'mednafen_psx_hw_libretro_android.so',
    'mednafen_psx_libretro_android.so',
    'duckstation_libretro_android.so',
  ],
  Atari2600: [
    'stella_libretro_android.so',
    'stella2014_libretro_android.so',
  ],
  PSP: [
    'ppsspp_libretro_android.so',
  ],
  PS2: [
    'play_libretro_android.so',
  ],
  DS: [
    'melonds_libretro_android.so',
    'desmume_libretro_android.so',
  ],
  Saturn: [
    'yabasanshiro_libretro_android.so',
    'mednafen_saturn_libretro_android.so',
    'kronos_libretro_android.so',
  ],
  Arcade: [
    'fbneo_libretro_android.so',
    'mame2003_plus_libretro_android.so',
    'mame2000_libretro_android.so',
  ],
};

const RETROARCH_PACKAGES = [
  'com.retroarch',
  'com.retroarch.aarch64',
  'com.retroarch.ra32',
  'com.retroarch.plus',
];

const RETROARCH_CORE_DIRS = (pkg: string) => [
  `/data/data/${pkg}/cores/`,
  `/data/user/0/${pkg}/cores/`,
  `/storage/emulated/0/Android/data/${pkg}/files/cores/`,
  `/storage/emulated/0/RetroArch/cores/`,
];

/**
 * Strict RFC 2396 percent-encoding for SAF segments.
 * Encodes special characters like spaces (%20), parentheses (%28, %29),
 * colons (%3A), brackets (%5B, %5D), etc.
 */
function encodeSafSegment(s: string): string {
  // Preserves '(', ')', '[', ']', '!', '\'', '*' so SAF Document IDs match Android ExternalStorageProvider
  return encodeURIComponent(s)
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']');
}

export interface SafCandidates {
  libraryRootUri: string;
  parentFolderUri: string;
  storageRootUri: string;
  directDocUri: string;
  fileUri: string;
  cleanPath: string;
  primaryCandidate: string;
}

export function buildSafCandidates(filePath: string): SafCandidates {
  const clean = (filePath || '').replace(/^file:\/\//, '');
  const fileUri = `file://${clean}`;
  if (clean.startsWith('content://')) {
    let recoveredFsPath = clean;
    let docId = '';

    const docMarker = '/document/';
    if (clean.includes(docMarker)) {
      const docPart = clean.substring(clean.indexOf(docMarker) + docMarker.length);
      docId = docPart.split('?')[0].split('#')[0];
    }

    if (docId) {
      try {
        const decodedDocId = decodeURIComponent(docId);
        if (decodedDocId.startsWith('primary:')) {
          recoveredFsPath = '/storage/emulated/0/' + decodedDocId.substring('primary:'.length);
        } else if (decodedDocId.includes(':')) {
          const splitIdx = decodedDocId.indexOf(':');
          const volume = decodedDocId.substring(0, splitIdx);
          const rel = decodedDocId.substring(splitIdx + 1);
          recoveredFsPath = `/storage/${volume}/${rel}`;
        }
      } catch { }
    }

    const parentFolderUri = clean.includes('/tree/') ? clean : clean;

    return {
      libraryRootUri: clean,
      parentFolderUri,
      storageRootUri: clean,
      directDocUri: docId ? `content://com.android.externalstorage.documents/document/${docId}` : clean,
      fileUri: recoveredFsPath.startsWith('/') ? `file://${recoveredFsPath}` : fileUri,
      cleanPath: recoveredFsPath,
      primaryCandidate: clean,
    };
  }

  let storagePrefix = 'primary';
  let relPath = clean;

  if (clean.startsWith('/storage/emulated/0/')) {
    storagePrefix = 'primary';
    relPath = clean.substring('/storage/emulated/0/'.length);
  } else if (clean.startsWith('/sdcard/')) {
    storagePrefix = 'primary';
    relPath = clean.substring('/sdcard/'.length);
  } else if (clean.startsWith('/storage/')) {
    const parts = clean.substring('/storage/'.length).split('/');
    if (parts.length > 1) {
      storagePrefix = parts[0];
      relPath = parts.slice(1).join('/');
    }
  }

  const segments = relPath.split('/').filter(Boolean);
  const encodedDocId = `${storagePrefix}%3A` + segments.map(encodeSafSegment).join('%2F');
  const directDocUri = `content://com.android.externalstorage.documents/document/${encodedDocId}`;

  // 1. Storage Root
  const storageRootUri = `content://com.android.externalstorage.documents/tree/${storagePrefix}%3A/document/${encodedDocId}`;

  // 2. Parent Folder (subfolder)
  const parentSegments = segments.length > 1 ? segments.slice(0, segments.length - 1) : [];
  const parentFolderUri = parentSegments.length > 0
    ? `content://com.android.externalstorage.documents/tree/${storagePrefix}%3A` +
    parentSegments.map(encodeSafSegment).join('%2F') +
    `/document/${encodedDocId}`
    : storageRootUri;

  // 3. Library Root (top-level directory, e.g. "RETRO GAMES LIBRARY")
  const libraryRootUri = parentSegments.length > 0
    ? `content://com.android.externalstorage.documents/tree/${storagePrefix}%3A` +
    encodeSafSegment(parentSegments[0]) +
    `/document/${encodedDocId}`
    : parentFolderUri;

  const primaryCandidate = parentFolderUri;

  return {
    libraryRootUri,
    parentFolderUri,
    storageRootUri,
    directDocUri,
    fileUri,
    cleanPath: clean,
    primaryCandidate,
  };
}

export function getSafDocumentUri(filePath: string): string {
  return buildSafCandidates(filePath).primaryCandidate;
}

/* ---------------- Helpers ---------------- */
const ARMSX2_ALL_VARIANTS = [
  'come.nanodata.armsx2',
  'com.armsx2.custom',
  'come.nanodata.armsx2.debug',
  'com.nanodata.armsx2',
  'com.nanodata.armsx2.custom',
  'com.nanodata.armsx2.debug',
  'com.armsx2',
  'com.armsx2.android',
  'xyz.armsx2.android',
  'org.armsx2.android',
  'kr.co.iefriends.pcsx2',
  'com.iefriends.pcsx2',
  'kr.co.iefriends.armsx2',
  'com.iefriends.armsx2',
];

export async function isPackageInstalled(packageName: string): Promise<boolean> {
  if (!packageName) return false;
  try {
    if (RetroScanLauncher?.isPackageInstalled) {
      return await RetroScanLauncher.isPackageInstalled(packageName);
    }
    const variants = packageName.includes('armsx2') || packageName.includes('iefriends')
      ? ARMSX2_ALL_VARIANTS
      : packageName.includes('ppsspp')
        ? ['org.ppsspp.ppsspp', 'org.ppsspp.ppssppgold']
        : [packageName];

    for (const v of variants) {
      const res = await IntentLauncher.isAppInstalled(v);
      if (res) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function resolveInstalledPackageName(packageName: string): Promise<string | null> {
  if (!packageName) return null;
  try {
    if (RetroScanLauncher?.resolveInstalledPackage) {
      const res = await RetroScanLauncher.resolveInstalledPackage(packageName);
      if (res) return res;
    }
    const variants = packageName.includes('armsx2') || packageName.includes('iefriends')
      ? ARMSX2_ALL_VARIANTS
      : packageName.includes('ppsspp')
        ? ['org.ppsspp.ppsspp', 'org.ppsspp.ppssppgold']
        : [packageName];

    for (const v of variants) {
      if (await IntentLauncher.isAppInstalled(v)) return v;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    if (RetroScanLauncher?.fileExists) {
      return await RetroScanLauncher.fileExists(path);
    }
  } catch { }
  return true;
}

async function findInstalledRetroArchPackage(preferred?: string): Promise<string | null> {
  if (preferred && (await isPackageInstalled(preferred))) {
    return preferred;
  }
  for (const pkg of RETROARCH_PACKAGES) {
    if (await isPackageInstalled(pkg)) return pkg;
  }
  return null;
}

/**
 * Intelligent core finder for RetroArch: checks user preference first,
 * then checks existing cores / info files, then falls back through candidates.
 */
export async function findAvailableCore(
  consoleType: string,
  pkg: string,
  preferredCore?: string
): Promise<{ corePath: string; coreName: string } | null> {
  const cores = RETROARCH_CORES[consoleType] || [];
  if (cores.length === 0) return null;

  const ordered = preferredCore
    ? [preferredCore, ...cores.filter(c => c !== preferredCore)]
    : cores;

  const dirs = RETROARCH_CORE_DIRS(pkg);

  // Check on-disk verification
  for (const core of ordered) {
    for (const dir of dirs) {
      const full = `${dir}${core}`;
      if (await fileExists(full)) {
        return { corePath: full, coreName: core };
      }
    }
  }

  // Fallback to primary core in candidate list
  const chosen = ordered[0];
  return { corePath: `/data/data/${pkg}/cores/${chosen}`, coreName: chosen };
}

const INTENT_FLAGS =
  0x10000000 /* NEW_TASK */ |
  0x04000000 /* CLEAR_TOP */ |
  0x00000001 /* GRANT_READ_URI_PERMISSION */;

/* =========================================================================
 *  PS2 JS Fallback — AetherSX2 / NetherSX2 / ARMSX2 / Play!
 * ========================================================================= */
async function launchPS2(
  pkg: string,
  cleanPath: string,
  candidates: SafCandidates,
  ps2BootMode?: string
): Promise<void> {
  const cleanFsPath = candidates.cleanPath;
  const fileUri = `file://${cleanFsPath}`;

  // ARMSX2
  if (pkg.includes('armsx2')) {
    try {
      await IntentLauncher.startActivity({
        packageName: pkg,
        className: 'kr.co.iefriends.pcsx2.activities.MainActivity',
        action: 'android.intent.action.VIEW',
        data: fileUri,
        type: 'application/octet-stream',
        flags: INTENT_FLAGS,
        extra: {
          bootPath: cleanFsPath,
          path: cleanFsPath,
          ROM: cleanFsPath,
        },
      });
      return;
    } catch { }

    await IntentLauncher.startActivity({
      packageName: pkg,
      action: 'android.intent.action.VIEW',
      data: fileUri,
      flags: INTENT_FLAGS,
      extra: { bootPath: cleanFsPath },
    });
    return;
  }

  const selectedSafUri = (() => {
    switch (ps2BootMode?.toLowerCase()) {
      case 'subfolder':
        return candidates.parentFolderUri;
      case 'library_root':
        return candidates.libraryRootUri;
      case 'storage_root':
        return candidates.storageRootUri;
      case 'direct_doc':
        return candidates.directDocUri;
      case 'raw_path':
        return cleanFsPath;
      default:
        if (cleanPath.startsWith('content://') && cleanPath.includes('/tree/')) {
          return cleanPath;
        }
        return candidates.parentFolderUri;
    }
  })();

  // Verified AetherSX2/NetherSX2 launch architecture:
  // Step 1: Launch MainActivity with CLEAR_TASK to initialize native libemu.so and clear any stale emulation sessions.
  // Step 2: After 350ms, boot cleanly into EmulationActivity with bootPath (FLAG_ACTIVITY_NEW_TASK).
  // Do NOT send secondary delayed intents or CLEAR_TASK to EmulationActivity, as that destroys the active SurfaceView graphics buffer!
  await IntentLauncher.startActivity({
    packageName: pkg,
    className: `${pkg}.MainActivity`,
    action: 'android.intent.action.MAIN',
    flags: 0x10000000 /* NEW_TASK */ | 0x00008000 /* CLEAR_TASK */,
  });

  await new Promise(resolve => setTimeout(resolve, 350));

  await IntentLauncher.startActivity({
    packageName: pkg,
    className: `${pkg}.EmulationActivity`,
    action: 'android.intent.action.MAIN',
    flags: 0x10000000 /* NEW_TASK */,
    extra: {
      bootPath: selectedSafUri,
    },
  });
}

/* =========================================================================
 *  N64 JS Fallback — Mupen64Plus FZ
 * ========================================================================= */
async function launchMupen64(pkg: string, cleanPath: string, fileUri: string): Promise<void> {
  const activities = [
    'paulscode.android.mupen64plusae.SplashActivity',
    'paulscode.android.mupen64plusae.MainActivity',
    `${pkg}.SplashActivity`,
    `${pkg}.MainActivity`,
  ];

  for (const activity of activities) {
    try {
      await IntentLauncher.startActivity({
        packageName: pkg,
        className: activity,
        action: 'android.intent.action.VIEW',
        data: fileUri,
        type: 'application/octet-stream',
        flags: INTENT_FLAGS,
        extra: {
          ROM: cleanPath,
          RomPath: cleanPath,
          Uri: fileUri,
          bootPath: fileUri,
        },
      });
      return;
    } catch { }
  }

  // Generic fallback
  await IntentLauncher.startActivity({
    packageName: pkg,
    action: 'android.intent.action.VIEW',
    data: fileUri,
    type: 'application/octet-stream',
    flags: INTENT_FLAGS,
  });
}

/* =========================================================================
 *  DuckStation JS Fallback
 * ========================================================================= */
async function launchDuckStation(pkg: string, cleanPath: string, safUri: string): Promise<void> {
  const fileUri = `file://${cleanPath}`;
  try {
    await IntentLauncher.startActivity({
      packageName: pkg,
      className: `${pkg}.EmulationActivity`,
      action: 'android.intent.action.VIEW',
      data: safUri,
      type: 'application/octet-stream',
      flags: INTENT_FLAGS,
      extra: {
        bootPath: safUri,
        resumeState: false,
      },
    });
    return;
  } catch { }

  try {
    await IntentLauncher.startActivity({
      packageName: pkg,
      className: `${pkg}.EmulationActivity`,
      action: 'android.intent.action.MAIN',
      flags: INTENT_FLAGS,
      extra: {
        bootPath: safUri,
        resumeState: false,
      },
    });
    return;
  } catch { }

  await IntentLauncher.startActivity({
    packageName: pkg,
    action: 'android.intent.action.VIEW',
    data: fileUri,
    type: 'application/octet-stream',
    flags: INTENT_FLAGS,
    extra: { bootPath: cleanPath },
  });
}

/* =========================================================================
 *  PPSSPP JS Fallback
 * ========================================================================= */
async function launchPPSSPP(
  pkg: string,
  cleanPath: string,
  candidates: SafCandidates
): Promise<void> {
  const ppssppSafUri = candidates.parentFolderUri;

  // Attempt 1: Parent Folder Tree SAF URI (Matches PPSSPP v1.20.4 scoped storage)
  try {
    await IntentLauncher.startActivity({
      packageName: pkg,
      className: 'org.ppsspp.ppsspp.PpssppActivity',
      action: 'android.intent.action.VIEW',
      data: ppssppSafUri,
      type: 'application/octet-stream',
      flags: INTENT_FLAGS,
      extra: {
        'org.ppsspp.ppsspp.Shortcuts': ppssppSafUri,
        bootPath: ppssppSafUri,
        SHORTCUT_EXTRA_KEY: ppssppSafUri,
      },
    });
    return;
  } catch { }

  // Attempt 2: Library Root SAF fallback
  if (candidates.libraryRootUri !== candidates.parentFolderUri) {
    try {
      await IntentLauncher.startActivity({
        packageName: pkg,
        className: 'org.ppsspp.ppsspp.PpssppActivity',
        action: 'android.intent.action.VIEW',
        data: candidates.libraryRootUri,
        type: 'application/octet-stream',
        flags: INTENT_FLAGS,
        extra: {
          'org.ppsspp.ppsspp.Shortcuts': candidates.libraryRootUri,
          bootPath: candidates.libraryRootUri,
          SHORTCUT_EXTRA_KEY: candidates.libraryRootUri,
        },
      });
      return;
    } catch { }
  }

  // Attempt 3: Direct Document URI fallback
  try {
    await IntentLauncher.startActivity({
      packageName: pkg,
      className: 'org.ppsspp.ppsspp.PpssppActivity',
      action: 'android.intent.action.VIEW',
      data: candidates.directDocUri,
      type: 'application/octet-stream',
      flags: INTENT_FLAGS,
      extra: {
        'org.ppsspp.ppsspp.Shortcuts': candidates.directDocUri,
        bootPath: candidates.directDocUri,
      },
    });
    return;
  } catch { }

  // Attempt 4: Raw file path fallback
  await IntentLauncher.startActivity({
    packageName: pkg,
    action: 'android.intent.action.VIEW',
    data: candidates.fileUri,
    flags: INTENT_FLAGS,
    extra: {
      'org.ppsspp.ppsspp.Shortcuts': cleanPath,
      bootPath: cleanPath,
    },
  });
}

/* =========================================================================
 *  RetroArch JS Fallback
 * ========================================================================= */
async function launchRetroArch(
  consoleType: string,
  pkg: string,
  cleanPath: string,
  preferredCore?: string
): Promise<string | undefined> {
  const coreInfo = await findAvailableCore(consoleType, pkg, preferredCore);
  if (!coreInfo) {
    throw new Error(
      `No RetroArch core found for ${consoleType}. Please download a core from RetroArch's Online Updater.`
    );
  }

  const { corePath, coreName } = coreInfo;
  const configFile = `/storage/emulated/0/Android/data/${pkg}/files/retroarch.cfg`;
  const fileUri = `file://${cleanPath}`;

  try {
    await IntentLauncher.startActivity({
      packageName: pkg,
      className: `${pkg}.browser.retroactivity.RetroActivityFuture`,
      action: 'android.intent.action.MAIN',
      flags: INTENT_FLAGS,
      extra: {
        ROM: cleanPath,
        PATH: cleanPath,
        LIBRETRO: corePath,
        CONFIGFILE: configFile,
        QUITFOCUS: '',
      },
    });
    return coreName;
  } catch {
    await IntentLauncher.startActivity({
      packageName: pkg,
      action: 'android.intent.action.VIEW',
      data: fileUri,
      flags: INTENT_FLAGS,
      extra: {
        ROM: cleanPath,
        PATH: cleanPath,
        LIBRETRO: corePath,
        CONFIGFILE: configFile,
      },
    });
    return coreName;
  }
}

/* =========================================================================
 *  MAIN LAUNCHER — Native High-Performance First, JS Fallback Secondary
 * ========================================================================= */
export const launchGame = async (
  game:
    | {
      console?: ConsoleId;
      file_path?: string;
      filePath?: string;
      emulator_pkg?: string;
      emulatorPkg?: string;
      preferred_core?: string;
      preferredCore?: string;
      ps2_boot_mode?: string;
      ps2BootMode?: string;
    }
    | string,
  emulatorPackage?: string
): Promise<{ coreUsed?: string; packageName?: string }> => {
  try {
    const isObject = game && typeof game === 'object';
    const consoleType = isObject ? game.console : undefined;
    const rawPath = isObject
      ? game.file_path || game.filePath || ''
      : typeof game === 'string'
        ? game
        : '';
    const emulator_pkg = isObject ? game.emulator_pkg || game.emulatorPkg : emulatorPackage;
    const preferredCore = isObject ? game.preferred_core || game.preferredCore : undefined;
    const ps2BootMode = isObject ? game.ps2_boot_mode || game.ps2BootMode : undefined;

    const cleanPath = (rawPath || '').replace(/^file:\/\//, '');
    const candidates = buildSafCandidates(cleanPath);

    // 1. High-Performance Native Android Launcher (Handles SAF, permissions, and multi-core fallback)
    if (RetroScanLauncher?.launchGame) {
      try {
        const nativeOptions = {
          preferred_core: preferredCore,
          ps2_boot_mode: ps2BootMode,
        };
        const nativeRes = await RetroScanLauncher.launchGame(
          consoleType || '',
          cleanPath,
          emulator_pkg || null,
          nativeOptions
        );
        return {
          coreUsed: nativeRes?.coreUsed,
          packageName: nativeRes?.packageName || emulator_pkg,
        };
      } catch (nativeErr) {
        console.warn('Native launchGame error, using JS fallback:', nativeErr);
      }
    }

    const pkgLower = (emulator_pkg || '').toLowerCase();

    // 2. JS Fallback Routes

    // PS2 — AetherSX2 / NetherSX2 / ARMSX2
    if (
      consoleType === 'PS2' ||
      pkgLower.includes('aethersx2') ||
      pkgLower.includes('nethersx2') ||
      pkgLower.includes('armsx2')
    ) {
      const pkg = emulator_pkg || 'xyz.aethersx2.android';
      await launchPS2(pkg, cleanPath, candidates, ps2BootMode);
      return { packageName: pkg };
    }

    // N64 — Mupen64Plus FZ
    if (pkgLower.includes('mupen64plus')) {
      const pkg = emulator_pkg || 'org.mupen64plusae.v3.fzurita';
      await launchMupen64(pkg, cleanPath, candidates.fileUri);
      return { packageName: pkg };
    }

    // DuckStation (PS1)
    if (pkgLower.includes('duckstation')) {
      await launchDuckStation(emulator_pkg!, cleanPath, candidates.primaryCandidate);
      return { packageName: emulator_pkg };
    }

    // PPSSPP (PSP)
    if (pkgLower.includes('ppsspp') || consoleType === 'PSP') {
      const pkg = emulator_pkg || 'org.ppsspp.ppsspp';
      await launchPPSSPP(pkg, cleanPath, candidates);
      return { packageName: pkg };
    }

    // RetroArch (Multi-core fallback)
    const isRetroArch =
      pkgLower.includes('retroarch') ||
      RETROARCH_PACKAGES.includes(emulator_pkg || '') ||
      (!emulator_pkg && consoleType && RETROARCH_CORES[consoleType]);

    if (isRetroArch && consoleType && RETROARCH_CORES[consoleType]) {
      const pkg = await findInstalledRetroArchPackage(emulator_pkg);
      if (!pkg) {
        throw new Error('RetroArch is not installed on this device.');
      }
      const coreUsed = await launchRetroArch(consoleType, pkg, cleanPath, preferredCore);
      return { coreUsed, packageName: pkg };
    }

    // Generic Fallback
    await IntentLauncher.startActivity({
      action: 'android.intent.action.VIEW',
      data: candidates.fileUri,
      packageName: emulator_pkg,
      flags: INTENT_FLAGS,
    });
    return { packageName: emulator_pkg };
  } catch (error: any) {
    Alert.alert('Launch Failed', `Could not open emulator: ${error.message}`);
    throw error;
  }
};

/* ---------------- Active Emulator Resolution ---------------- */
export async function getActiveEmulator(consoleId: ConsoleId): Promise<EmulatorConfig> {
  try {
    const customSettings = await getCustomEmulatorSettings();
    if (customSettings[consoleId]) {
      const custom = customSettings[consoleId];
      const resolvedPkg = (await resolveInstalledPackageName(custom.packageName)) || custom.packageName;
      return { ...custom, packageName: resolvedPkg };
    }
  } catch (err) {
    console.warn('Failed to load custom emulator settings:', err);
  }

  const presets = CONSOLE_EMULATOR_OPTIONS[consoleId] || [];
  for (const preset of presets) {
    if (await isPackageInstalled(preset.packageName)) {
      const resolvedPkg = (await resolveInstalledPackageName(preset.packageName)) || preset.packageName;
      return { ...preset, packageName: resolvedPkg };
    }
  }
  return DEFAULT_EMULATORS[consoleId];
}

export async function launchEmulator(
  consoleIdOrGame: ConsoleId | any,
  filePath?: string
): Promise<LaunchResult> {
  let consoleId: ConsoleId;
  let rawPath: string;
  let emulatorPkg: string | undefined;
  let preferredCore: string | undefined;
  let ps2BootMode: string | undefined;

  if (consoleIdOrGame && typeof consoleIdOrGame === 'object') {
    consoleId = consoleIdOrGame.console;
    rawPath = consoleIdOrGame.file_path || consoleIdOrGame.filePath || '';
    emulatorPkg = consoleIdOrGame.emulator_pkg || consoleIdOrGame.emulatorPkg;
    preferredCore = consoleIdOrGame.preferred_core || consoleIdOrGame.preferredCore;
    ps2BootMode = consoleIdOrGame.ps2_boot_mode || consoleIdOrGame.ps2BootMode;
  } else {
    consoleId = consoleIdOrGame;
    rawPath = filePath || '';
  }

  const config = await getActiveEmulator(consoleId);
  if (!config || !config.packageName) {
    return {
      success: false,
      packageName: '',
      emulatorName: 'Unknown',
      error: `No emulator configured for console ${consoleId}`,
    };
  }

  const activePreferredCore = preferredCore || config.preferredCore;
  const activePs2BootMode = ps2BootMode || config.ps2BootMode;

  // Respect user's selected emulator first
  const targetPkg = emulatorPkg || config.packageName;
  const resolvedTargetPkg = (await resolveInstalledPackageName(targetPkg)) || targetPkg;
  let installed = await isPackageInstalled(targetPkg);
  let activeConfig: EmulatorConfig = emulatorPkg
    ? ({
      name: emulatorPkg.split('.').pop() || 'Emulator',
      packageName: resolvedTargetPkg,
      preferredCore: activePreferredCore,
      ps2BootMode: activePs2BootMode as any,
    } as EmulatorConfig)
    : { ...config, packageName: resolvedTargetPkg };

  if (!installed) {
    // Try preset alternatives for this console
    const presets = CONSOLE_EMULATOR_OPTIONS[consoleId] || [];
    let alt: EmulatorConfig | null = null;
    for (const p of presets) {
      if (p.packageName !== targetPkg && (await isPackageInstalled(p.packageName))) {
        const resolvedAltPkg = (await resolveInstalledPackageName(p.packageName)) || p.packageName;
        alt = { ...p, packageName: resolvedAltPkg };
        break;
      }
    }
    // Try RetroArch if available for this console
    if (!alt && RETROARCH_CORES[consoleId]) {
      for (const raPkg of RETROARCH_PACKAGES) {
        if (await isPackageInstalled(raPkg)) {
          alt = {
            id: 'retroarch_fallback',
            name: 'RetroArch',
            packageName: raPkg,
            preferredCore: activePreferredCore,
          } as EmulatorConfig;
          break;
        }
      }
    }
    if (alt) {
      activeConfig = alt;
      installed = true;
    }
  }

  if (!installed) {
    return {
      success: false,
      packageName: targetPkg,
      emulatorName: config.name,
      notInstalled: true,
      error: `${config.name} (${targetPkg}) is not installed. Please install it or choose another emulator in Settings.`,
    };
  }

  return launchWithConfig(activeConfig, rawPath, consoleId, activePreferredCore, activePs2BootMode);
}

async function launchWithConfig(
  config: EmulatorConfig,
  filePath: string,
  consoleId?: ConsoleId,
  preferredCore?: string,
  ps2BootMode?: string
): Promise<LaunchResult> {
  const cleanPath = (filePath || '').replace(/^file:\/\//, '');
  try {
    const res = await launchGame({
      console: consoleId,
      file_path: cleanPath,
      emulator_pkg: config.packageName,
      preferred_core: preferredCore || config.preferredCore,
      ps2_boot_mode: ps2BootMode || config.ps2BootMode,
    });
    return {
      success: true,
      packageName: res?.packageName || config.packageName,
      emulatorName: config.name,
      coreUsed: res?.coreUsed,
    };
  } catch (err: any) {
    return {
      success: false,
      packageName: config.packageName,
      emulatorName: config.name,
      error: `Could not launch ${config.name}: ${err?.message || 'Activity launch error'}`,
    };
  }
}

export default {
  launchGame,
  isPackageInstalled,
  fileExists,
  getActiveEmulator,
  launchEmulator,
  getSafDocumentUri,
  buildSafCandidates,
  findAvailableCore,
  RETROARCH_CORES,
};