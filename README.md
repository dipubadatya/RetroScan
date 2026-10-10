# RetroScan 🎮

**Print. Scan. Play.**

RetroScan is an Android app that lets you turn your digital retro game collection into a physical-style collection.

Create QR codes for your game files, add them to printed game covers, and scan them with RetroScan to launch the corresponding game in a compatible emulator on your Android device.

## Features

- Organize supported game files stored on your device.
- Generate QR codes for individual games.
- Add QR codes to printable game covers.
- Scan printed covers to find and launch the corresponding game.
- Open games in compatible Android emulators.
- Keep your game collection stored locally on your device.

## How It Works

1. Select a supported game file on your Android device.
2. Generate a QR code for the game.
3. Add the QR code to your game cover design.
4. Print the cover and add it to your collection.
5. Scan the QR code using RetroScan.
6. Launch the game in its compatible emulator.

## Platform and Technology

- Android
- React Native CLI
- TypeScript
- SQLite
- React Native Vision Camera
- QR code generation and scanning

## Getting Started

### Requirements

- Node.js and npm
- JDK compatible with the project's Gradle configuration
- Android Studio and Android SDK
- An Android device or emulator

### Install

Clone the repository:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd RetroScan
```

Install dependencies:

```bash
npm ci
```

Build the Android debug APK on Windows:

```powershell
cd android
.\gradlew.bat assembleDebug
```

The APK should be generated at:

`android/app/build/outputs/apk/debug/app-debug.apk`

To run the app using React Native CLI, return to the project root and run:

```bash
npx react-native run-android
```


## 🎮 Supported Emulators and Recommended Cores

RetroScan is designed to work with compatible Android emulators. Some systems use standalone emulators, while others can run through RetroArch cores.

### Recommended Emulators

| Gaming System | Recommended Emulator | Alternative |
|---|---|---|
| PlayStation 2 (PS2) | AetherSX2 / NetherSX2 | ARMSX2 or Play! |
| PlayStation (PS1) | DuckStation | RetroArch |
| PlayStation Portable (PSP) | PPSSPP | RetroArch with PPSSPP core |
| Nintendo 64 (N64) | RetroArch | | Mupen64Plus FZ |
| Game Boy Advance (GBA) | RetroArch | mGBA core |
| Game Boy / Game Boy Color (GB/GBC) | RetroArch | Gambatte core |
| NES | RetroArch | FCEUmm core |
| SNES | RetroArch | Snes9x core |
| Sega Genesis | RetroArch | Genesis Plus GX core |
| Atari 2600 | RetroArch | Stella core |

*These are suggested emulator choices, not a guarantee that every emulator or launch method has been tested on every device.*

### ⭐ Recommended RetroArch Cores

The following are the first core candidates in RetroScan's current core mapping. Install the required cores through RetroArch's Online Updater where available.

| System | First Recommended Core | Alternative Cores |
|---|---|---|
| SNES | Snes9x | Snes9x 2010, Snes9x 2005 |
| N64 | Mupen64Plus-Next GLES3 | Mupen64Plus-Next, ParaLLEl N64 |
| GBA | mGBA | VBA Next, gpSP |
| GB | Gambatte | SameBoy, Gearboy |
| GBC | Gambatte | SameBoy, Gearboy |
| NES | FCEUmm | Nestopia, Mesen, QuickNES |
| Sega Genesis | Genesis Plus GX | PicoDrive |
| PS1 | PCSX ReARMed | SwanStation, Beetle PSX |
| Atari 2600 | Stella | Stella 2014 |
| PSP | PPSSPP | Depends on RetroArch build and core availability |


### ⚙️ How Core Selection Works

RetroScan keeps an ordered list of candidate cores for each supported system. It can check for an installed core and use a preferred core when configured.

- The first listed core is the default candidate.
- A preferred core can be selected ahead of the other candidates.
- If a core is unavailable, another candidate may be tried.
- Core availability and direct game launching depend on the installed RetroArch build, Android permissions, and game format.

**Important:** A listed core is not automatically installed with RetroScan. Users may need to install RetroArch and download the required cores separately.

### 📱 Device Compatibility

Performance varies by device, emulator, core, and game. Lightweight 2D systems generally have lower requirements than systems such as PS2 and N64. Test demanding games individually before assuming full-speed performance.


## Game Files

RetroScan uses game files stored locally on your device. QR codes identify the corresponding game; they do not contain the full game file.

Keep the original game files available at the locations expected by the app. If a file is moved or deleted, its saved location may need to be updated.

Compatible emulators must be installed separately where required. Game launch support depends on the emulator, game format, Android version, and storage permissions.

## Privacy

RetroScan is designed around a local game collection. Camera access is needed for QR scanning, and file access is needed to select game files.

## Legal Notice

RetroScan does not include commercial game ROMs or BIOS files. Users are responsible for ensuring that their game files, BIOS files, artwork, and other materials are obtained and used lawfully.

## Contributing

Bug reports, suggestions, and contributions are welcome. When reporting a problem, include your Android version, game format, and emulator details.

## License

No license has been selected yet. A license can be added when the project owner decides how the source code may be used and redistributed.

---

**RetroScan — Give your digital game collection a physical feel.**
