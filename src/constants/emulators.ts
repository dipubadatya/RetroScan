import { ConsoleId } from '../types';

export interface EmulatorConfig {
  id: string;
  name: string;
  packageName: string;
  className?: string;
  action?: 'android.intent.action.MAIN' | 'android.intent.action.VIEW';
  category?: 'android.intent.category.LAUNCHER' | 'android.intent.category.DEFAULT';
  extraKey?: string; // 'bootPath' for AetherSX2/NetherSX2, 'ROM' for RetroArch
  useFileUri?: boolean; // true if the emulator expects file:// URI in data field
  preferredCore?: string; // Specific RetroArch core to use (or fallback)
  ps2BootMode?: 'auto' | 'library_root' | 'subfolder' | 'storage_root' | 'direct_doc' | 'raw_path';
}

export interface CoreOption {
  id: string;
  name: string;
  description: string;
  isRecommended?: boolean;
}

export const PS2_BOOT_MODE_OPTIONS: { id: 'auto' | 'library_root' | 'subfolder' | 'storage_root' | 'direct_doc' | 'raw_path'; name: string; description: string }[] = [
  { id: 'auto', name: 'Auto (Recommended)', description: 'Automatically resolves to your root library folder' },
  { id: 'library_root', name: 'Library Root Tree', description: 'Tree URI targeting top-level folder (e.g. RETRO GAMES LIBRARY)' },
  { id: 'subfolder', name: 'Console Subfolder Tree', description: 'Tree URI targeting console directory (e.g. ps2)' },
  { id: 'storage_root', name: 'Internal Storage Root', description: 'Tree URI targeting /storage/emulated/0/' },
  { id: 'direct_doc', name: 'Direct Document URI', description: 'Document URI without tree prefix' },
  { id: 'raw_path', name: 'Raw File Path', description: 'Plain Linux path (/storage/emulated/0/...)' },
];

export const RETROARCH_CORE_OPTIONS: Record<ConsoleId, CoreOption[]> = {
  SNES: [
    { id: 'snes9x_libretro_android.so', name: 'Snes9x (Current)', description: 'Highest accuracy and compatibility', isRecommended: true },
    { id: 'snes9x2010_libretro_android.so', name: 'Snes9x 2010', description: 'Fast and reliable on older devices' },
    { id: 'snes9x2005_libretro_android.so', name: 'Snes9x 2005', description: 'Ultra-lightweight fallback' },
    { id: 'snes9x2005_plus_libretro_android.so', name: 'Snes9x 2005 Plus', description: 'Lightweight with sound improvements' },
    { id: 'snes9x2002_libretro_android.so', name: 'Snes9x 2002', description: 'Legacy core for low-end hardware' },
    { id: 'bsnes_libretro_android.so', name: 'bsnes', description: 'Cycle-accurate emulation' },
    { id: 'bsnes_hd_beta_libretro_android.so', name: 'bsnes-hd Beta', description: 'Widescreen HD Mode 7 support' },
    { id: 'mesen-s_libretro_android.so', name: 'Mesen-S', description: 'High-accuracy alternative' },
  ],

  N64: [
    { id: 'mupen64plus_next_gles3_libretro_android.so', name: 'Mupen64Plus-Next (GLES3)', description: 'Best performance & visuals on Android', isRecommended: true },
    { id: 'mupen64plus_next_libretro_android.so', name: 'Mupen64Plus-Next', description: 'Standard Mupen64Plus build' },
    { id: 'mupen64plus_next_gles2_libretro_android.so', name: 'Mupen64Plus-Next (GLES2)', description: 'Compatibility for older GPU devices' },
    { id: 'parallel_n64_libretro_android.so', name: 'ParaLLEl N64', description: 'Accurate LLE N64 emulation' },
  ],

  GBA: [
    { id: 'mgba_libretro_android.so', name: 'mGBA', description: 'Highest accuracy and performance', isRecommended: true },
    { id: 'vba_next_libretro_android.so', name: 'VBA Next', description: 'Optimized for speed' },
    { id: 'gpsp_libretro_android.so', name: 'gpSP', description: 'Dynarec core for low-end hardware' },
    { id: 'vbam_libretro_android.so', name: 'VBA-M', description: 'Feature-rich classic core' },
  ],

  GB: [
    { id: 'gambatte_libretro_android.so', name: 'Gambatte', description: 'Accurate Game Boy color/mono', isRecommended: true },
    { id: 'sameboy_libretro_android.so', name: 'SameBoy', description: 'High precision and features' },
    { id: 'gearboy_libretro_android.so', name: 'Gearboy', description: 'Simple and fast' },
    { id: 'mgba_libretro_android.so', name: 'mGBA', description: 'Supports GB/GBC games' },
    { id: 'tgbdual_libretro_android.so', name: 'TGB Dual', description: 'Supports two-player link emulation' },
  ],

  GBC: [
    { id: 'gambatte_libretro_android.so', name: 'Gambatte', description: 'Accurate Game Boy Color', isRecommended: true },
    { id: 'sameboy_libretro_android.so', name: 'SameBoy', description: 'High precision with custom palettes' },
    { id: 'gearboy_libretro_android.so', name: 'Gearboy', description: 'Simple and fast' },
    { id: 'mgba_libretro_android.so', name: 'mGBA', description: 'Supports GBC games' },
  ],

  NES: [
    { id: 'fceumm_libretro_android.so', name: 'FCEUmm', description: 'Broadest mapper & FDS compatibility', isRecommended: true },
    { id: 'nestopia_libretro_android.so', name: 'Nestopia UE', description: 'Cycle-accurate NES emulation' },
    { id: 'mesen_libretro_android.so', name: 'Mesen', description: 'Ultra-accurate with HD pack support' },
    { id: 'quicknes_libretro_android.so', name: 'QuickNES', description: 'Extremely fast' },
  ],

  Genesis: [
    { id: 'genesis_plus_gx_libretro_android.so', name: 'Genesis Plus GX', description: 'Accurate Genesis, Mega Drive, Master System', isRecommended: true },
    { id: 'picodrive_libretro_android.so', name: 'PicoDrive', description: 'Fast with 32X support' },
    { id: 'genesis_plus_gx_wide_libretro_android.so', name: 'Genesis Plus GX Widescreen', description: 'Supports widescreen rendering' },
  ],

  PS1: [
    { id: 'pcsx_rearmed_libretro_android.so', name: 'PCSX ReARMed', description: 'Optimized ARM dynarec for Android', isRecommended: true },
    { id: 'swanstation_libretro_android.so', name: 'SwanStation', description: 'High-res DuckStation port for RetroArch' },
    { id: 'mednafen_psx_hw_libretro_android.so', name: 'Beetle PSX HW', description: 'Hardware-accelerated accuracy' },
    { id: 'mednafen_psx_libretro_android.so', name: 'Beetle PSX', description: 'Software rendering accuracy' },
    { id: 'duckstation_libretro_android.so', name: 'DuckStation Core', description: 'DuckStation libretro port' },
  ],

  Atari2600: [
    { id: 'stella_libretro_android.so', name: 'Stella', description: 'Comprehensive Atari 2600', isRecommended: true },
    { id: 'stella2014_libretro_android.so', name: 'Stella 2014', description: 'Lightweight build' },
  ],

  PSP: [
    { id: 'ppsspp_libretro_android.so', name: 'PPSSPP (Core)', description: 'Libretro PPSSPP core', isRecommended: true },
  ],

  PS2: [
    { id: 'play_libretro_android.so', name: 'Play! (Core)', description: 'Experimental Libretro PS2 core', isRecommended: true },
  ],
};

export const CONSOLE_EMULATOR_OPTIONS: Record<ConsoleId, EmulatorConfig[]> = {
  PS2: [
    {
      id: 'aethersx2',
      name: 'AetherSX2',
      packageName: 'xyz.aethersx2.android',
      className: 'xyz.aethersx2.android.EmulationActivity',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.LAUNCHER',
      extraKey: 'bootPath',
      useFileUri: false,
      ps2BootMode: 'auto',
    },
    {
      id: 'nethersx2',
      name: 'NetherSX2',
      packageName: 'xyz.nethersx2.android',
      className: 'xyz.nethersx2.android.EmulationActivity',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.LAUNCHER',
      extraKey: 'bootPath',
      useFileUri: false,
      ps2BootMode: 'auto',
    },
    {
      id: 'nethersx2_classic',
      name: 'NetherSX2 Classic',
      packageName: 'xyz.nethersx2.android.classic',
      className: 'xyz.nethersx2.android.classic.EmulationActivity',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.LAUNCHER',
      extraKey: 'bootPath',
      useFileUri: false,
      ps2BootMode: 'auto',
    },
    {
      id: 'armsx2',
      name: 'ARMSX2',
      packageName: 'come.nanodata.armsx2',
      className: 'kr.co.iefriends.pcsx2.activities.MainActivity',
      action: 'android.intent.action.VIEW',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'bootPath',
      useFileUri: true,
      ps2BootMode: 'auto',
    },
    {
      id: 'play_ps2',
      name: 'Play! PS2',
      packageName: 'org.purei.play',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'retroarch_ps2',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
  ],

  PSP: [
    {
      id: 'ppsspp',
      name: 'PPSSPP',
      packageName: 'org.ppsspp.ppsspp',
      className: 'org.ppsspp.ppsspp.PpssppActivity',
      action: 'android.intent.action.VIEW',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'bootPath',
      useFileUri: true,
    },
    {
      id: 'ppsspp_gold',
      name: 'PPSSPP Gold',
      packageName: 'org.ppsspp.ppssppgold',
      className: 'org.ppsspp.ppssppgold.PpssppActivity',
      action: 'android.intent.action.VIEW',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'bootPath',
      useFileUri: true,
    },
    {
      id: 'retroarch_psp',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
  ],

  PS1: [
    {
      id: 'duckstation',
      name: 'DuckStation',
      packageName: 'com.github.stenzek.duckstation',
      className: 'com.github.stenzek.duckstation.EmulationActivity',
      action: 'android.intent.action.MAIN',
      extraKey: 'bootPath',
      useFileUri: false,
    },
    {
      id: 'epsxe',
      name: 'ePSXe',
      packageName: 'com.epsxe.ePSXe',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'retroarch_ps1',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
  ],

  GBA: [
    {
      id: 'retroarch_gba',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
    {
      id: 'pizzaboy_gba',
      name: 'Pizza Boy GBA',
      packageName: 'it.dbtecno.pizzaboygba',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'myboy',
      name: 'My Boy!',
      packageName: 'com.fastemulator.gba',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'myboy_free',
      name: 'My Boy! Free',
      packageName: 'com.fastemulator.gbafree',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'gba_emu',
      name: 'GBA.emu',
      packageName: 'com.explusalpha.GbaEmu',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
  ],

  GB: [
    {
      id: 'retroarch_gb',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
    {
      id: 'myoldboy',
      name: 'My OldBoy!',
      packageName: 'com.fastemulator.gbc',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'pizzaboy_gb',
      name: 'Pizza Boy GBC',
      packageName: 'it.dbtecno.pizzaboy',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'gbc_emu',
      name: 'GBC.emu',
      packageName: 'com.explusalpha.GbcEmu',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
  ],

  GBC: [
    {
      id: 'retroarch_gbc',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
    {
      id: 'myoldboy_gbc',
      name: 'My OldBoy!',
      packageName: 'com.fastemulator.gbc',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'pizzaboy_gbc',
      name: 'Pizza Boy GBC',
      packageName: 'it.dbtecno.pizzaboy',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'gbc_emu_gbc',
      name: 'GBC.emu',
      packageName: 'com.explusalpha.GbcEmu',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
  ],

  N64: [
    {
      id: 'mupen64_fz',
      name: 'Mupen64Plus FZ',
      packageName: 'org.mupen64plusae.v3.fzurita',
      className: 'paulscode.android.mupen64plusae.SplashActivity',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'mupen64_fz_pro',
      name: 'Mupen64Plus FZ Pro',
      packageName: 'org.mupen64plusae.v3.fzurita.pro',
      className: 'paulscode.android.mupen64plusae.SplashActivity',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'retroarch_n64',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
  ],

  SNES: [
    {
      id: 'snes9x',
      name: 'Snes9x EX+',
      packageName: 'com.explusalpha.Snes9xExP',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'retroarch_snes',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
    {
      id: 'superretro16',
      name: 'SuperRetro16',
      packageName: 'com.neutronites.superretro16',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
  ],

  NES: [
    {
      id: 'nostalgia_nes',
      name: 'Nostalgia.NES',
      packageName: 'com.nostalgiaemulators.neslite',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
    {
      id: 'retroarch_nes',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
    {
      id: 'nes_emu',
      name: 'NES.emu',
      packageName: 'com.explusalpha.NesEmu',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
  ],

  Genesis: [
    {
      id: 'retroarch_gen',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
    {
      id: 'md_emu',
      name: 'MD.emu',
      packageName: 'com.explusalpha.MdEmu',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
  ],

  Atari2600: [
    {
      id: 'retroarch_atari',
      name: 'RetroArch',
      packageName: 'com.retroarch',
      className: 'com.retroarch.browser.retroactivity.RetroActivityFuture',
      action: 'android.intent.action.MAIN',
      category: 'android.intent.category.DEFAULT',
      extraKey: 'ROM',
      useFileUri: false,
    },
    {
      id: 'a2600_emu',
      name: '2600.emu',
      packageName: 'com.explusalpha.A2600Emu',
      action: 'android.intent.action.VIEW',
      useFileUri: true,
    },
  ],
};

export const DEFAULT_EMULATORS: Record<ConsoleId, EmulatorConfig> = {
  PS2: CONSOLE_EMULATOR_OPTIONS.PS2[0], // AetherSX2
  PSP: CONSOLE_EMULATOR_OPTIONS.PSP[0], // PPSSPP
  PS1: CONSOLE_EMULATOR_OPTIONS.PS1[0], // DuckStation
  GBA: CONSOLE_EMULATOR_OPTIONS.GBA[0], // RetroArch
  GB: CONSOLE_EMULATOR_OPTIONS.GB[0],   // RetroArch
  GBC: CONSOLE_EMULATOR_OPTIONS.GBC[0], // RetroArch
  N64: CONSOLE_EMULATOR_OPTIONS.N64[0], // Mupen64Plus FZ
  SNES: CONSOLE_EMULATOR_OPTIONS.SNES[0], // Snes9x EX+
  NES: CONSOLE_EMULATOR_OPTIONS.NES[0],   // Nostalgia.NES
  Genesis: CONSOLE_EMULATOR_OPTIONS.Genesis[0], // RetroArch
  Atari2600: CONSOLE_EMULATOR_OPTIONS.Atari2600[0], // RetroArch
};

// Backwards compatibility mappings
export const EMULATORS: Record<ConsoleId, string> = {
  PS2: DEFAULT_EMULATORS.PS2.packageName,
  PSP: DEFAULT_EMULATORS.PSP.packageName,
  PS1: DEFAULT_EMULATORS.PS1.packageName,
  GBA: DEFAULT_EMULATORS.GBA.packageName,
  GB: DEFAULT_EMULATORS.GB.packageName,
  GBC: DEFAULT_EMULATORS.GBC.packageName,
  N64: DEFAULT_EMULATORS.N64.packageName,
  SNES: DEFAULT_EMULATORS.SNES.packageName,
  NES: DEFAULT_EMULATORS.NES.packageName,
  Genesis: DEFAULT_EMULATORS.Genesis.packageName,
  Atari2600: DEFAULT_EMULATORS.Atari2600.packageName,
};

export const EMULATOR_NAMES: Record<ConsoleId, string> = {
  PS2: DEFAULT_EMULATORS.PS2.name,
  PSP: DEFAULT_EMULATORS.PSP.name,
  PS1: DEFAULT_EMULATORS.PS1.name,
  GBA: DEFAULT_EMULATORS.GBA.name,
  GB: DEFAULT_EMULATORS.GB.name,
  GBC: DEFAULT_EMULATORS.GBC.name,
  N64: DEFAULT_EMULATORS.N64.name,
  SNES: DEFAULT_EMULATORS.SNES.name,
  NES: DEFAULT_EMULATORS.NES.name,
  Genesis: DEFAULT_EMULATORS.Genesis.name,
  Atari2600: DEFAULT_EMULATORS.Atari2600.name,
};
