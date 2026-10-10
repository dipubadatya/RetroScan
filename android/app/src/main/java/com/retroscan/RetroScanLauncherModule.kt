package com.retroscan

import android.app.Activity
import android.app.ActivityOptions
import android.app.AlarmManager
import android.app.PendingIntent
import android.os.Build
import android.content.ClipData
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import android.os.Handler
import android.os.Looper
import java.io.File
import java.io.BufferedReader
import java.io.InputStreamReader

class RetroScanLauncherModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "RetroScanLauncher"

        // Comprehensive prioritized cores for RetroArch (best/most compatible -> fallback)
        val RETROARCH_CORES: Map<String, List<String>> = mapOf(
            "N64" to listOf(
                "mupen64plus_next_gles3_libretro_android.so",
                "mupen64plus_next_libretro_android.so",
                "mupen64plus_next_gles2_libretro_android.so",
                "parallel_n64_libretro_android.so"
            ),
            "SNES" to listOf(
                "snes9x_libretro_android.so",
                "snes9x2010_libretro_android.so",
                "snes9x2005_libretro_android.so",
                "snes9x2005_plus_libretro_android.so",
                "snes9x2002_libretro_android.so",
                "bsnes_libretro_android.so",
                "bsnes_hd_beta_libretro_android.so",
                "mesen-s_libretro_android.so"
            ),
            "GBA" to listOf(
                "mgba_libretro_android.so",
                "vba_next_libretro_android.so",
                "gpsp_libretro_android.so",
                "vbam_libretro_android.so"
            ),
            "GB" to listOf(
                "gambatte_libretro_android.so",
                "sameboy_libretro_android.so",
                "gearboy_libretro_android.so",
                "mgba_libretro_android.so",
                "tgbdual_libretro_android.so"
            ),
            "GBC" to listOf(
                "gambatte_libretro_android.so",
                "sameboy_libretro_android.so",
                "gearboy_libretro_android.so",
                "mgba_libretro_android.so",
                "tgbdual_libretro_android.so"
            ),
            "NES" to listOf(
                "fceumm_libretro_android.so",
                "nestopia_libretro_android.so",
                "mesen_libretro_android.so",
                "quicknes_libretro_android.so"
            ),
            "Genesis" to listOf(
                "genesis_plus_gx_libretro_android.so",
                "picodrive_libretro_android.so",
                "genesis_plus_gx_wide_libretro_android.so"
            ),
            "PS1" to listOf(
                "pcsx_rearmed_libretro_android.so",
                "swanstation_libretro_android.so",
                "mednafen_psx_hw_libretro_android.so",
                "mednafen_psx_libretro_android.so",
                "duckstation_libretro_android.so"
            ),
            "Atari2600" to listOf(
                "stella_libretro_android.so",
                "stella2014_libretro_android.so"
            ),
            "PSP" to listOf(
                "ppsspp_libretro_android.so"
            ),
            "PS2" to listOf(
                "play_libretro_android.so"
            ),
            "DS" to listOf(
                "melonds_libretro_android.so",
                "desmume_libretro_android.so"
            ),
            "Saturn" to listOf(
                "yabasanshiro_libretro_android.so",
                "mednafen_saturn_libretro_android.so",
                "kronos_libretro_android.so"
            ),
            "Arcade" to listOf(
                "fbneo_libretro_android.so",
                "mame2003_plus_libretro_android.so",
                "mame2000_libretro_android.so"
            )
        )

        private val PS2_PACKAGES = listOf(
            "xyz.nethersx2.android",
            "xyz.aethersx2.android",
            "come.nanodata.armsx2",
            "com.armsx2.custom",
            "come.nanodata.armsx2.debug",
            "com.nanodata.armsx2",
            "com.nanodata.armsx2.custom",
            "com.nanodata.armsx2.debug",
            "com.armsx2",
            "com.armsx2.android",
            "xyz.armsx2.android",
            "org.armsx2.android",
            "kr.co.iefriends.pcsx2",
            "com.iefriends.pcsx2",
            "kr.co.iefriends.armsx2",
            "com.iefriends.armsx2",
            "xyz.nethersx2.android.classic",
            "xyz.aethersx2.cturnip",
            "xyz.aethersx2.tturnip",
            "org.playstation2.aethersx2",
            "org.purei.play"
        )

        private val RETROARCH_PACKAGES = listOf(
            "com.retroarch",
            "com.retroarch.aarch64",
            "com.retroarch.ra32",
            "com.retroarch.plus"
        )

        private val PSP_PACKAGES = listOf(
            "org.ppsspp.ppsspp",
            "org.ppsspp.ppssppgold"
        )

        private val PS1_PACKAGES = listOf(
            "com.github.stenzek.duckstation",
            "com.epsxe.ePSXe"
        )
    }

    override fun getName(): String = "RetroScanLauncher"

    private fun isSingleAppInstalled(packageName: String): Boolean {
        if (packageName.isBlank()) return false
        return try {
            reactContext.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: Exception) {
            try {
                reactContext.packageManager.getLaunchIntentForPackage(packageName) != null
            } catch (e2: Exception) {
                false
            }
        }
    }

    /**
     * Resolves installed ARMSX2 package by testing all known APK application IDs
     * and dynamically scanning installed packages for any matching 'armsx2' or 'iefriends' / 'pcsx2'.
     */
    private fun findInstalledArmsX2Package(): String? {
        val knownVariants = listOf(
            "come.nanodata.armsx2",
            "com.armsx2.custom",
            "come.nanodata.armsx2.debug",
            "com.nanodata.armsx2",
            "com.nanodata.armsx2.custom",
            "com.nanodata.armsx2.debug",
            "com.armsx2",
            "com.armsx2.android",
            "xyz.armsx2.android",
            "org.armsx2.android",
            "kr.co.iefriends.pcsx2",
            "com.iefriends.pcsx2",
            "kr.co.iefriends.armsx2",
            "com.iefriends.armsx2"
        )
        for (pkg in knownVariants) {
            if (isSingleAppInstalled(pkg)) return pkg
        }
        try {
            val pm = reactContext.packageManager
            val installedPackages = pm.getInstalledPackages(0)
            for (pi in installedPackages) {
                val p = pi.packageName.lowercase()
                if (p.contains("armsx2") || (p.contains("pcsx2") && p.contains("iefriends"))) {
                    return pi.packageName
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "findInstalledArmsX2Package scanning failed: ${e.message}")
        }
        return null
    }

    private fun isAppInstalled(packageName: String): Boolean {
        if (packageName.isBlank()) return false
        if (packageName.contains("armsx2", ignoreCase = true) || packageName.contains("iefriends", ignoreCase = true)) {
            return findInstalledArmsX2Package() != null
        }
        val variants = when {
            packageName.contains("ppsspp", ignoreCase = true) -> listOf(
                "org.ppsspp.ppsspp",
                "org.ppsspp.ppssppgold"
            )
            packageName.contains("duckstation", ignoreCase = true) -> listOf(
                "com.github.stenzek.duckstation",
                "com.github.stenzek.duckstation.debug"
            )
            packageName.contains("aethersx2", ignoreCase = true) || packageName.contains("nethersx2", ignoreCase = true) -> listOf(
                packageName,
                "xyz.nethersx2.android",
                "xyz.aethersx2.android",
                "xyz.nethersx2.android.classic",
                "xyz.aethersx2.cturnip",
                "xyz.aethersx2.tturnip",
                "org.playstation2.aethersx2"
            )
            else -> listOf(packageName)
        }

        return variants.any { isSingleAppInstalled(it) }
    }

    private fun resolveInstalledPackage(preferredPkg: String?, defaultList: List<String>): String? {
        if (!preferredPkg.isNullOrBlank()) {
            if (preferredPkg.contains("armsx2", ignoreCase = true) || preferredPkg.contains("iefriends", ignoreCase = true)) {
                val found = findInstalledArmsX2Package()
                if (found != null) return found
            }
            if (preferredPkg.contains("ppsspp", ignoreCase = true)) {
                if (isSingleAppInstalled("org.ppsspp.ppsspp")) return "org.ppsspp.ppsspp"
                if (isSingleAppInstalled("org.ppsspp.ppssppgold")) return "org.ppsspp.ppssppgold"
            }
            if (preferredPkg.contains("aethersx2", ignoreCase = true) || preferredPkg.contains("nethersx2", ignoreCase = true)) {
                for (p in PS2_PACKAGES) {
                    if (isSingleAppInstalled(p)) return p
                }
            }
            if (isSingleAppInstalled(preferredPkg)) {
                return preferredPkg
            }
        }
        for (candidate in defaultList) {
            if (isSingleAppInstalled(candidate)) {
                return candidate
            }
        }
        return preferredPkg?.takeIf { it.isNotBlank() }
    }

    @ReactMethod
    fun isPackageInstalled(packageName: String, promise: Promise) {
        promise.resolve(isAppInstalled(packageName))
    }

    @ReactMethod
    fun resolveInstalledPackage(packageName: String, promise: Promise) {
        val resolved = resolveInstalledPackage(packageName, listOf(packageName))
        promise.resolve(resolved)
    }

    @ReactMethod
    fun fileExists(path: String, promise: Promise) {
        try {
            val file = File(path)
            promise.resolve(file.exists() && file.canRead())
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun persistTreeUri(uriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            reactContext.contentResolver.takePersistableUriPermission(uri, takeFlags)

            val prefs = reactContext.getSharedPreferences("retroscan_saf_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("persisted_tree_uri", uriString).apply()

            Log.d(TAG, "Persisted tree URI: $uriString")
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                val uri = Uri.parse(uriString)
                reactContext.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                val prefs = reactContext.getSharedPreferences("retroscan_saf_prefs", Context.MODE_PRIVATE)
                prefs.edit().putString("persisted_tree_uri", uriString).apply()
                Log.d(TAG, "Persisted read-only tree URI: $uriString")
                promise.resolve(true)
            } catch (e2: Exception) {
                Log.w(TAG, "Failed to persist tree URI: ${e2.message}")
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun getPersistedTreeUri(promise: Promise) {
        try {
            val persisted = reactContext.contentResolver.persistedUriPermissions
            val active = persisted.firstOrNull()?.uri?.toString()
            if (active != null) {
                promise.resolve(active)
                return
            }
            val prefs = reactContext.getSharedPreferences("retroscan_saf_prefs", Context.MODE_PRIVATE)
            val saved = prefs.getString("persisted_tree_uri", null)
            promise.resolve(saved)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    /**
     * Standard Android SAF segment encoding.
     * Leaves letters, numbers, and safe filename symbols '(', ')', '[', ']', '!', '\'', '*', '-', '_', '.', '~' unescaped.
     * Spaces are encoded as %20, slashes as %2F, colons as %3A, percent as %25.
     */
    private fun encodeSafSegment(s: String): String {
        return Uri.encode(s, "[]")
    }

    /**
     * Builds all candidate SAF Document URIs for a file path.
     * Android SAF Tree URIs require the tree root component to match
     * the EXACT folder grant the target app (e.g. AetherSX2) holds.
     */
    data class SafUriCandidates(
        val libraryRootUri: String,   // tree = primary:RETRO GAMES LIBRARY (top-level scanned folder)
        val parentFolderUri: String,  // tree = primary:RETRO GAMES LIBRARY/ps2 (immediate subfolder)
        val storageRootUri: String,   // tree = primary: (entire storage volume)
        val directDocUri: String,     // document without tree prefix
        val fileUri: String,          // file://...
        val cleanPath: String,        // raw filesystem path
        val primaryCandidate: String  // best guess based on path depth
    )

    private fun buildSafCandidates(filePath: String): SafUriCandidates {
        val clean = filePath.replace("^file://".toRegex(), "")
        val fileUri = "file://$clean"
        if (clean.startsWith("content://")) {
            var recoveredFsPath = clean
            var docId = ""

            val docMarker = "/document/"
            val treeMarker = "/tree/"

            if (clean.contains(docMarker)) {
                val docPart = clean.substringAfter(docMarker)
                docId = docPart.substringBefore("?").substringBefore("#")
            }

            if (docId.isNotEmpty()) {
                val decodedDocId = Uri.decode(docId)
                if (decodedDocId.startsWith("primary:")) {
                    recoveredFsPath = "/storage/emulated/0/" + decodedDocId.substring("primary:".length)
                } else if (decodedDocId.contains(":")) {
                    val splitIdx = decodedDocId.indexOf(':')
                    val volume = decodedDocId.substring(0, splitIdx)
                    val rel = decodedDocId.substring(splitIdx + 1)
                    recoveredFsPath = "/storage/$volume/$rel"
                }
            }

            val parentFolderUri = if (clean.contains("/tree/")) clean else {
                if (docId.isNotEmpty()) {
                    val decodedDocId = Uri.decode(docId)
                    val prefix = if (decodedDocId.contains(":")) decodedDocId.substringBefore(":") else "primary"
                    val rel = if (decodedDocId.contains(":")) decodedDocId.substringAfter(":") else decodedDocId
                    val segs = rel.split("/").filter { it.isNotEmpty() }
                    val parentSegs = if (segs.size > 1) segs.subList(0, segs.size - 1) else emptyList()
                    if (parentSegs.isNotEmpty()) {
                        val encParentTree = "$prefix%3A" + parentSegs.map { encodeSafSegment(it) }.joinToString("%2F")
                        "content://com.android.externalstorage.documents/tree/$encParentTree/document/$docId"
                    } else clean
                } else clean
            }

            return SafUriCandidates(
                libraryRootUri = clean,
                parentFolderUri = parentFolderUri,
                storageRootUri = clean,
                directDocUri = if (docId.isNotEmpty()) "content://com.android.externalstorage.documents/document/$docId" else clean,
                fileUri = if (recoveredFsPath.startsWith("/")) "file://$recoveredFsPath" else fileUri,
                cleanPath = recoveredFsPath,
                primaryCandidate = clean
            )
        }

        var storagePrefix = "primary"
        var relPath = clean

        if (clean.startsWith("/storage/emulated/0/")) {
            storagePrefix = "primary"
            relPath = clean.substring("/storage/emulated/0/".length)
        } else if (clean.startsWith("/sdcard/")) {
            storagePrefix = "primary"
            relPath = clean.substring("/sdcard/".length)
        } else if (clean.startsWith("/storage/")) {
            val parts = clean.substring("/storage/".length).split("/")
            if (parts.size > 1) {
                storagePrefix = parts[0]
                relPath = parts.subList(1, parts.size).joinToString("/")
            }
        }

        val segments = relPath.split("/").filter { it.isNotEmpty() }
        val encodedDocSegments = segments.map { encodeSafSegment(it) }
        val encodedDocId = "$storagePrefix%3A" + encodedDocSegments.joinToString("%2F")
        val directDocUri = "content://com.android.externalstorage.documents/document/$encodedDocId"

        // 1. Storage Root URI: tree/primary%3A/document/...
        val encodedStorageRootTreeId = "$storagePrefix%3A"
        val storageRootUri = "content://com.android.externalstorage.documents/tree/$encodedStorageRootTreeId/document/$encodedDocId"

        // 2. Parent Folder URI: tree/primary%3Afolder%2Fsubfolder/document/...
        val parentSegments = if (segments.size > 1) segments.subList(0, segments.size - 1) else emptyList()
        val parentFolderUri = if (parentSegments.isNotEmpty()) {
            val encodedParentTreeId = "$storagePrefix%3A" + parentSegments.map { encodeSafSegment(it) }.joinToString("%2F")
            "content://com.android.externalstorage.documents/tree/$encodedParentTreeId/document/$encodedDocId"
        } else {
            storageRootUri
        }

        // 3. Library Root URI: tree/primary%3AfirstFolder/document/...
        // (Users usually add the top-level ROMs directory in emulators, e.g. "RETRO GAMES LIBRARY")
        val libraryRootUri = if (parentSegments.isNotEmpty()) {
            val encodedLibTreeId = "$storagePrefix%3A" + encodeSafSegment(parentSegments[0])
            "content://com.android.externalstorage.documents/tree/$encodedLibTreeId/document/$encodedDocId"
        } else {
            parentFolderUri
        }

        // Primary candidate: Immediate console subfolder (e.g. "RETRO GAMES LIBRARY/ps2" or "RETRO GAMES LIBRARY/psp"),
        // which matches the exact folder users select and grant permissions to in emulators like AetherSX2 and PPSSPP.
        val primaryCandidate = parentFolderUri

        return SafUriCandidates(
            libraryRootUri = libraryRootUri,
            parentFolderUri = parentFolderUri,
            storageRootUri = storageRootUri,
            directDocUri = directDocUri,
            fileUri = fileUri,
            cleanPath = clean,
            primaryCandidate = primaryCandidate
        )
    }

    private fun getSafDocumentUri(filePath: String): String {
        return buildSafCandidates(filePath).primaryCandidate
    }

    /**
     * Resolves target activity from candidates or queries package manager for launch activity.
     */
    private fun resolveActivity(packageName: String, candidateActivities: List<String>): ComponentName? {
        val pm = reactContext.packageManager
        for (activityName in candidateActivities) {
            val cn = ComponentName(packageName, activityName)
            try {
                pm.getActivityInfo(cn, 0)
                Log.d(TAG, "resolveActivity: Found valid activity $cn")
                return cn
            } catch (_: Exception) {}
        }
        try {
            val launchIntent = pm.getLaunchIntentForPackage(packageName)
            if (launchIntent?.component != null) {
                Log.d(TAG, "resolveActivity: Using package launch component ${launchIntent.component}")
                return launchIntent.component
            }
        } catch (_: Exception) {}
        return null
    }

    /**
     * Resolves FileProvider URI for RetroScan.
     */
    private fun getFileProviderUri(filePath: String): Uri? {
        return try {
            val clean = filePath.replace("^file://".toRegex(), "")
            val file = File(clean)
            FileProvider.getUriForFile(
                reactContext,
                "com.retroscan.fileprovider",
                file
            )
        } catch (e: Exception) {
            Log.w(TAG, "getFileProviderUri failed: ${e.message}")
            null
        }
    }

    /**
     * Safely grants URI read permissions and attaches ClipData ONLY if RetroScan holds permission.
     * Prevents SecurityException when dealing with external storage documents not owned by RetroScan.
     */
    private fun grantUriAccess(intent: Intent, targetPackage: String, uri: Uri, setAsData: Boolean = false) {
        if (setAsData) {
            intent.data = uri
        }
        val isOurFileProvider = uri.authority == "com.retroscan.fileprovider"
        val hasPermission = try {
            reactContext.checkCallingOrSelfUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            ) == PackageManager.PERMISSION_GRANTED
        } catch (_: Exception) {
            false
        }

        if (isOurFileProvider || hasPermission) {
            intent.clipData = ClipData.newRawUri("ROM", uri)
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            try {
                reactContext.grantUriPermission(
                    targetPackage,
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (e: Exception) {
                Log.w(TAG, "grantUriPermission failed for $targetPackage: ${e.message}")
            }
        } else {
            Log.d(TAG, "Skipping grantUriPermission for $targetPackage on URI: $uri (not owned by RetroScan)")
        }
    }

    /**
     * Checks if a core file exists or is referenced in RetroArch config / playlists / info directory.
     */
    private fun checkCoreExists(targetPkg: String, coreName: String): Boolean {
        // Direct .so file checks in known readable directories
        val corePaths = listOf(
            "/data/data/$targetPkg/cores/$coreName",
            "/data/user/0/$targetPkg/cores/$coreName",
            "/storage/emulated/0/Android/data/$targetPkg/files/cores/$coreName",
            "/storage/emulated/0/RetroArch/cores/$coreName"
        )
        for (p in corePaths) {
            val f = File(p)
            if (f.exists() && f.canRead()) return true
        }

        // Info file check (.info is downloaded when core is downloaded in RetroArch)
        val baseName = coreName.replace("_android\\.so$".toRegex(), "").replace("\\.so$".toRegex(), "")
        val infoPaths = listOf(
            "/storage/emulated/0/Android/data/$targetPkg/files/info/$baseName.info",
            "/storage/emulated/0/RetroArch/info/$baseName.info"
        )
        for (ip in infoPaths) {
            val f = File(ip)
            if (f.exists()) return true
        }

        return false
    }

    /**
     * Finds the best active RetroArch core with intelligent detection & fallback.
     */
    private fun resolveRetroArchCore(
        consoleId: String,
        targetPkg: String,
        preferredCore: String?
    ): Pair<String, String> {
        val candidates = RETROARCH_CORES[consoleId] ?: emptyList()
        val orderedList = if (!preferredCore.isNullOrBlank()) {
            listOf(preferredCore) + candidates.filter { it != preferredCore }
        } else {
            candidates
        }

        // 1. If preferredCore is set and explicitly requested, use it
        if (!preferredCore.isNullOrBlank()) {
            val fullPath = "/data/data/$targetPkg/cores/$preferredCore"
            return Pair(preferredCore, fullPath)
        }

        // 2. Scan if any candidate core is confirmed on device
        for (core in orderedList) {
            if (checkCoreExists(targetPkg, core)) {
                Log.d(TAG, "Confirmed installed RetroArch core: $core")
                return Pair(core, "/data/data/$targetPkg/cores/$core")
            }
        }

        // 3. Check retroarch.cfg for last loaded core matching this console
        try {
            val cfgFile = File("/storage/emulated/0/Android/data/$targetPkg/files/retroarch.cfg")
            if (cfgFile.exists() && cfgFile.canRead()) {
                val reader = BufferedReader(InputStreamReader(cfgFile.inputStream()))
                var line: String? = reader.readLine()
                while (line != null) {
                    if (line.startsWith("libretro_path")) {
                        for (core in orderedList) {
                            if (line.contains(core)) {
                                reader.close()
                                return Pair(core, "/data/data/$targetPkg/cores/$core")
                            }
                        }
                    }
                    line = reader.readLine()
                }
                reader.close()
            }
        } catch (_: Exception) {}

        // 4. Fall back to the primary/first recommended core for this console
        val chosenCore = orderedList.firstOrNull() ?: "mupen64plus_next_gles3_libretro_android.so"
        return Pair(chosenCore, "/data/data/$targetPkg/cores/$chosenCore")
    }

    @ReactMethod
    fun getAvailableCores(consoleId: String, promise: Promise) {
        val cores = RETROARCH_CORES[consoleId] ?: emptyList()
        val array = Arguments.createArray()
        for (c in cores) {
            array.pushString(c)
        }
        promise.resolve(array)
    }

    /**
     * Main Launch Method (Options-aware)
     */
    @ReactMethod
    fun launchGame(
        consoleId: String,
        filePath: String,
        emulatorPkg: String?,
        options: ReadableMap?,
        promise: Promise
    ) {
        try {
            val activity = currentActivity ?: reactContext
            val cleanPath = filePath.replace("^file://".toRegex(), "")
            val candidates = buildSafCandidates(cleanPath)

            val preferredCore = options?.getString("preferred_core")
                ?: options?.getString("preferredCore")
            val ps2BootMode = options?.getString("ps2_boot_mode")
                ?: options?.getString("ps2BootMode")

            Log.d(TAG, "🚀 launchGame: console=$consoleId, pkg=$emulatorPkg, ps2BootMode=$ps2BootMode, preferredCore=$preferredCore")
            Log.d(TAG, "   path=$cleanPath")
            Log.d(TAG, "   primarySafUri=${candidates.primaryCandidate}")

            // Common Intent Flags (DO NOT USE FLAG_ACTIVITY_CLEAR_TASK as it destroys target app intent state!)
            val baseFlags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_GRANT_READ_URI_PERMISSION

            // =========================================================================
            // 1. PLAYSTATION 2 (AetherSX2 / NetherSX2 / ARMSX2 / Play!)
            // =========================================================================
            if (consoleId.equals("PS2", ignoreCase = true) ||
                (emulatorPkg != null && PS2_PACKAGES.any { emulatorPkg.contains(it, ignoreCase = true) })) {

                val targetPkg: String = resolveInstalledPackage(emulatorPkg, PS2_PACKAGES) ?: "xyz.aethersx2.android"

                // ARMSX2 emulator (PCSX2 Android port by iefriends)
                if (targetPkg.contains("armsx2", ignoreCase = true) || targetPkg.contains("iefriends", ignoreCase = true)) {
                    val actualArmsPkg = findInstalledArmsX2Package() ?: targetPkg
                    val armsxActivities = listOf(
                        "kr.co.iefriends.pcsx2.activities.MainActivity",
                        "$actualArmsPkg.activities.MainActivity",
                        "$actualArmsPkg.MainActivity"
                    )
                    val resolvedComponent = resolveActivity(actualArmsPkg, armsxActivities)
                        ?: ComponentName(actualArmsPkg, "kr.co.iefriends.pcsx2.activities.MainActivity")
                    val fileUri = Uri.fromFile(File(cleanPath))

                    // Attempt 1: ACTION_VIEW with file URI (standard for ARMSX2)
                    try {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            component = resolvedComponent
                            setPackage(actualArmsPkg)
                            setDataAndType(fileUri, "application/octet-stream")
                            putExtra("bootPath", cleanPath)
                            putExtra("path", cleanPath)
                            putExtra("ROM", cleanPath)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        activity.startActivity(intent)
                        Log.d(TAG, "ARMSX2 booted successfully with fileUri: $cleanPath")
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", actualArmsPkg)
                            putString("emulatorName", "ARMSX2")
                        })
                        return
                    } catch (e: Exception) {
                        // Attempt 2: SAF tree URI fallback
                        try {
                            val subUri = Uri.parse(candidates.parentFolderUri)
                            val intent = Intent(Intent.ACTION_VIEW).apply {
                                component = resolvedComponent
                                setPackage(actualArmsPkg)
                                setDataAndType(subUri, "application/octet-stream")
                                grantUriAccess(this, actualArmsPkg, subUri, setAsData = true)
                                putExtra("bootPath", candidates.parentFolderUri)
                                putExtra("path", cleanPath)
                                putExtra("ROM", cleanPath)
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            activity.startActivity(intent)
                            promise.resolve(Arguments.createMap().apply {
                                putBoolean("success", true)
                                putString("packageName", actualArmsPkg)
                                putString("emulatorName", "ARMSX2")
                            })
                            return
                        } catch (e2: Exception) {
                            // Attempt 3: Generic ACTION_VIEW fallback
                            try {
                                val intent = Intent(Intent.ACTION_VIEW).apply {
                                    setPackage(actualArmsPkg)
                                    data = fileUri
                                    putExtra("bootPath", cleanPath)
                                    putExtra("path", cleanPath)
                                    putExtra("ROM", cleanPath)
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                                }
                                activity.startActivity(intent)
                                promise.resolve(Arguments.createMap().apply {
                                    putBoolean("success", true)
                                    putString("packageName", actualArmsPkg)
                                    putString("emulatorName", "ARMSX2")
                                })
                                return
                            } catch (e3: Exception) {
                                promise.reject("LAUNCH_FAILED", "Could not start ARMSX2 ($actualArmsPkg): ${e3.message}", e3)
                                return
                            }
                        }
                    }
                }

                // Play! PS2 emulator
                if (targetPkg == "org.purei.play" || targetPkg.contains("play", ignoreCase = true)) {
                    try {
                        val playUri = Uri.parse(candidates.primaryCandidate)
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setPackage(targetPkg)
                            setDataAndType(playUri, "application/octet-stream")
                            grantUriAccess(this, targetPkg, playUri, setAsData = true)
                            addFlags(baseFlags)
                        }
                        activity.startActivity(intent)
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                            putString("emulatorName", "Play! PS2")
                        })
                        return
                    } catch (e: Exception) {
                        Log.w(TAG, "Play! launch failed: ${e.message}")
                    }
                }

                val cleanFsPath = candidates.cleanPath

                // Determine target URI based on user configuration
                // By default, use candidates.parentFolderUri (e.g. tree/primary%3ARETRO%20GAMES%20LIBRARY%2Fps2/document/...)
                // which matches the exact console folder granted when setting up AetherSX2 / NetherSX2!
                val selectedSafUriStr = when (ps2BootMode?.lowercase()) {
                    "library_root" -> candidates.libraryRootUri
                    "subfolder" -> candidates.parentFolderUri
                    "storage_root" -> candidates.storageRootUri
                    "direct_doc" -> candidates.directDocUri
                    "raw_path" -> cleanFsPath
                    else -> {
                        if (filePath.startsWith("content://") && filePath.contains("/tree/")) {
                            filePath
                        } else {
                            candidates.parentFolderUri
                        }
                    }
                }

                Log.d(TAG, "PS2 booting AetherSX2/NetherSX2 ($targetPkg) with bootPath: $selectedSafUriStr")

                // Verified AetherSX2/NetherSX2 launch architecture:
                // Step 1: Launch MainActivity with CLEAR_TASK to initialize native libemu.so and clear any stale emulation sessions.
                // Step 2: After 350ms, boot cleanly into EmulationActivity with bootPath (FLAG_ACTIVITY_NEW_TASK).
                // Do NOT send secondary delayed intents or CLEAR_TASK to EmulationActivity, as that destroys the active SurfaceView graphics buffer!
                try {
                    val bootUri = Uri.parse(selectedSafUriStr)

                    // Configure Android 14+ Background Activity Launch privileges
                    val options = if (Build.VERSION.SDK_INT >= 34) {
                        ActivityOptions.makeBasic().apply {
                            setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
                        }
                    } else {
                        ActivityOptions.makeBasic()
                    }

                    // 1. Warm-up & task cleanup: Ensure NativeLibrary.initializeOnce() runs and previous session is cleared
                    val mainIntent = Intent(Intent.ACTION_MAIN).apply {
                        component = ComponentName(targetPkg, "$targetPkg.MainActivity")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    }
                    activity.startActivity(mainIntent, options.toBundle())

                    // 2. Direct game boot into EmulationActivity after 350ms warm-up
                    val emuComponent = ComponentName(targetPkg, "$targetPkg.EmulationActivity")
                    val emuIntent = Intent(Intent.ACTION_MAIN).apply {
                        component = emuComponent
                        putExtra("bootPath", selectedSafUriStr)
                        putExtra("saveStatePath", null as String?)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    grantUriAccess(emuIntent, targetPkg, bootUri)

                    Handler(Looper.getMainLooper()).postDelayed({
                        try {
                            activity.startActivity(emuIntent, options.toBundle())
                            Log.i(TAG, "PS2 game booted cleanly into EmulationActivity: $selectedSafUriStr")
                        } catch (eEmuDelayed: Exception) {
                            Log.e(TAG, "EmulationActivity start failed: ${eEmuDelayed.message}", eEmuDelayed)
                        }
                    }, 350)

                    Log.i(TAG, "PS2 launch sequence initiated: package=$targetPkg, bootPath=$selectedSafUriStr")
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                        putString("emulatorName", "AetherSX2/NetherSX2")
                        putString("bootUriUsed", selectedSafUriStr)
                    })
                } catch (eEmu: Exception) {
                    Log.e(TAG, "PS2 launch failed: ${eEmu.message}", eEmu)
                    promise.reject("LAUNCH_FAILED", "Could not start AetherSX2/NetherSX2 ($targetPkg): ${eEmu.message}", eEmu)
                }
                return
            }

            // =========================================================================
            // 2. NINTENDO 64 STANDALONE (Mupen64Plus FZ / Mupen64Plus FZ Pro)
            // =========================================================================
            if (emulatorPkg != null && emulatorPkg.contains("mupen64plus")) {
                val targetPkg = emulatorPkg
                val fileUri = Uri.parse(candidates.fileUri)
                val safUri = Uri.parse(candidates.primaryCandidate)

                val mupenActivities = listOf(
                    "paulscode.android.mupen64plusae.SplashActivity",
                    "paulscode.android.mupen64plusae.MainActivity",
                    "$targetPkg.SplashActivity",
                    "$targetPkg.MainActivity"
                )
                val resolvedComponent = resolveActivity(targetPkg, mupenActivities)
                    ?: ComponentName(targetPkg, "paulscode.android.mupen64plusae.SplashActivity")

                var lastErr: Exception? = null

                // Attempt 1: Official SplashActivity with ACTION_VIEW + fileUri
                try {
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        component = resolvedComponent
                        setDataAndType(fileUri, "application/octet-stream")
                        putExtra("ROM", cleanPath)
                        putExtra("RomPath", cleanPath)
                        putExtra("Uri", candidates.fileUri)
                        putExtra("bootPath", candidates.fileUri)
                        grantUriAccess(this, targetPkg, fileUri, setAsData = true)
                        addFlags(baseFlags)
                    }
                    activity.startActivity(intent)
                    Log.d(TAG, "Mupen64Plus booted with SplashActivity + fileUri: ${candidates.fileUri}")
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                        putString("emulatorName", "Mupen64Plus FZ")
                    })
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "Mupen64Plus Attempt 1 failed: ${e.message}")
                    lastErr = e
                }

                // Attempt 2: ACTION_VIEW with SAF document URI
                try {
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        component = resolvedComponent
                        setDataAndType(safUri, "application/octet-stream")
                        putExtra("ROM", cleanPath)
                        putExtra("bootPath", candidates.primaryCandidate)
                        grantUriAccess(this, targetPkg, safUri, setAsData = true)
                        addFlags(baseFlags)
                    }
                    activity.startActivity(intent)
                    Log.d(TAG, "Mupen64Plus booted with safUri: ${candidates.primaryCandidate}")
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                    })
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "Mupen64Plus Attempt 2 failed: ${e.message}")
                    lastErr = e
                }

                // Attempt 3: Generic ACTION_VIEW without explicit component
                try {
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setPackage(targetPkg)
                        setDataAndType(fileUri, "application/octet-stream")
                        grantUriAccess(this, targetPkg, fileUri, setAsData = true)
                        addFlags(baseFlags)
                    }
                    activity.startActivity(intent)
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                    })
                    return
                } catch (e: Exception) {
                    lastErr = e
                }

                promise.reject("LAUNCH_FAILED", "Could not start Mupen64Plus ($targetPkg): ${lastErr?.message}", lastErr)
                return
            }

            // =========================================================================
            // 3. PLAYSTATION 1 (DuckStation / ePSXe)
            // =========================================================================
            if (consoleId.equals("PS1", ignoreCase = true) ||
                (emulatorPkg != null && PS1_PACKAGES.any { emulatorPkg.contains(it) })) {

                var detectedPkg = emulatorPkg?.takeIf { it.isNotBlank() && isAppInstalled(it) }
                if (detectedPkg == null) {
                    for (candidate in PS1_PACKAGES) {
                        if (isAppInstalled(candidate)) {
                            detectedPkg = candidate
                            break
                        }
                    }
                }
                val targetPkg: String = detectedPkg ?: emulatorPkg?.takeIf { it.isNotBlank() } ?: "com.github.stenzek.duckstation"
                val safUri = Uri.parse(candidates.primaryCandidate)
                var lastErr: Exception? = null

                if (targetPkg.contains("duckstation")) {
                    val duckActivities = listOf(
                        "com.github.stenzek.duckstation.EmulationActivity",
                        "$targetPkg.EmulationActivity",
                        "$targetPkg.MainActivity"
                    )
                    val resolvedComponent = resolveActivity(targetPkg, duckActivities)
                        ?: ComponentName(targetPkg, "$targetPkg.EmulationActivity")

                    // Attempt 1: DuckStation ACTION_VIEW with bootPath(safUri) & resumeState=false
                    try {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            component = resolvedComponent
                            setDataAndType(safUri, "application/octet-stream")
                            putExtra("bootPath", candidates.primaryCandidate)
                            putExtra("resumeState", false)
                            grantUriAccess(this, targetPkg, safUri, setAsData = false)
                            addFlags(baseFlags)
                        }
                        activity.startActivity(intent)
                        Log.d(TAG, "DuckStation booted with ACTION_VIEW + safUri")
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                            putString("emulatorName", "DuckStation")
                        })
                        return
                    } catch (e: Exception) {
                        lastErr = e
                    }

                    // Attempt 2: DuckStation ACTION_MAIN with bootPath(safUri)
                    try {
                        val intent = Intent(Intent.ACTION_MAIN).apply {
                            component = resolvedComponent
                            putExtra("bootPath", candidates.primaryCandidate)
                            putExtra("resumeState", false)
                            grantUriAccess(this, targetPkg, safUri, setAsData = false)
                            addFlags(baseFlags)
                        }
                        activity.startActivity(intent)
                        Log.d(TAG, "DuckStation booted with ACTION_MAIN + safUri")
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                        })
                        return
                    } catch (e: Exception) {
                        lastErr = e
                    }

                    // Attempt 3: DuckStation ACTION_MAIN with raw path
                    try {
                        val intent = Intent(Intent.ACTION_MAIN).apply {
                            component = resolvedComponent
                            putExtra("bootPath", cleanPath)
                            putExtra("resumeState", false)
                            addFlags(baseFlags)
                        }
                        activity.startActivity(intent)
                        Log.d(TAG, "DuckStation booted with raw path")
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                        })
                        return
                    } catch (e: Exception) {
                        lastErr = e
                    }
                } else {
                    // ePSXe or generic PS1
                    try {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setPackage(targetPkg)
                            setDataAndType(safUri, "application/octet-stream")
                            grantUriAccess(this, targetPkg, safUri, setAsData = true)
                            addFlags(baseFlags)
                        }
                        activity.startActivity(intent)
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                        })
                        return
                    } catch (e: Exception) {
                        lastErr = e
                    }
                }

                promise.reject("LAUNCH_FAILED", "Could not start PS1 emulator ($targetPkg): ${lastErr?.message}", lastErr)
                return
            }

            // =========================================================================
            // 4. PLAYSTATION PORTABLE (PPSSPP / PPSSPP Gold)
            // =========================================================================
            if (consoleId.equals("PSP", ignoreCase = true) ||
                (emulatorPkg != null && PSP_PACKAGES.any { emulatorPkg.contains(it, ignoreCase = true) })) {

                val targetPkg: String = resolveInstalledPackage(emulatorPkg, PSP_PACKAGES) ?: "org.ppsspp.ppsspp"
                val fileUri = Uri.fromFile(File(cleanPath))

                val ppssppActivities = listOf(
                    "org.ppsspp.ppsspp.PpssppActivity",
                    "$targetPkg.PpssppActivity",
                    "$targetPkg.MainActivity"
                )
                val resolvedComponent = resolveActivity(targetPkg, ppssppActivities)
                    ?: ComponentName(targetPkg, "org.ppsspp.ppsspp.PpssppActivity")

                var lastErr: Exception? = null

                // Attempt 1: Parent Folder Tree SAF URI (Matches PPSSPP's granted folder grant for /psp)
                // In modern Android (v1.20.4+), PPSSPP accesses files via Scoped Storage SAF.
                // When users add games in PPSSPP, they grant their PSP games folder (candidates.parentFolderUri).
                // Passing this SAF tree URI with ACTION_VIEW and application/octet-stream opens the file descriptor seamlessly.
                try {
                    val safUri = Uri.parse(candidates.parentFolderUri)
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        component = resolvedComponent
                        addCategory(Intent.CATEGORY_DEFAULT)
                        setDataAndType(safUri, "application/octet-stream")
                        grantUriAccess(this, targetPkg, safUri, setAsData = true)
                        clipData = ClipData.newRawUri("ROM", safUri)
                        putExtra("org.ppsspp.ppsspp.Shortcuts", candidates.parentFolderUri)
                        putExtra("bootPath", candidates.parentFolderUri)
                        putExtra("SHORTCUT_EXTRA_KEY", candidates.parentFolderUri)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or
                                 Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                 Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    activity.startActivity(intent)
                    Log.d(TAG, "PPSSPP booted with parentFolderUri: ${candidates.parentFolderUri}")
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                        putString("emulatorName", "PPSSPP")
                    })
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "PPSSPP Attempt 1 (parentFolderUri) failed: ${e.message}")
                    lastErr = e
                }

                // Attempt 2: Library Root Tree SAF URI fallback (if user granted RETRO GAMES LIBRARY root)
                if (candidates.libraryRootUri != candidates.parentFolderUri) {
                    try {
                        val libSafUri = Uri.parse(candidates.libraryRootUri)
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            component = resolvedComponent
                            addCategory(Intent.CATEGORY_DEFAULT)
                            setDataAndType(libSafUri, "application/octet-stream")
                            grantUriAccess(this, targetPkg, libSafUri, setAsData = true)
                            clipData = ClipData.newRawUri("ROM", libSafUri)
                            putExtra("org.ppsspp.ppsspp.Shortcuts", candidates.libraryRootUri)
                            putExtra("bootPath", candidates.libraryRootUri)
                            putExtra("SHORTCUT_EXTRA_KEY", candidates.libraryRootUri)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or
                                     Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                     Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        activity.startActivity(intent)
                        Log.d(TAG, "PPSSPP booted with libraryRootUri fallback: ${candidates.libraryRootUri}")
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                            putString("emulatorName", "PPSSPP")
                        })
                        return
                    } catch (e: Exception) {
                        lastErr = e
                    }
                }

                // Attempt 3: Direct Document URI fallback
                try {
                    val directUri = Uri.parse(candidates.directDocUri)
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        component = resolvedComponent
                        addCategory(Intent.CATEGORY_DEFAULT)
                        setDataAndType(directUri, "application/octet-stream")
                        grantUriAccess(this, targetPkg, directUri, setAsData = true)
                        clipData = ClipData.newRawUri("ROM", directUri)
                        putExtra("org.ppsspp.ppsspp.Shortcuts", candidates.directDocUri)
                        putExtra("bootPath", candidates.directDocUri)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or
                                 Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                 Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    activity.startActivity(intent)
                    Log.d(TAG, "PPSSPP booted with directDocUri fallback: ${candidates.directDocUri}")
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                        putString("emulatorName", "PPSSPP")
                    })
                    return
                } catch (e: Exception) {
                    lastErr = e
                }

                // Attempt 4: FileProvider URI fallback
                val fpUri = getFileProviderUri(cleanPath)
                if (fpUri != null) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            component = resolvedComponent
                            addCategory(Intent.CATEGORY_DEFAULT)
                            setDataAndType(fpUri, "application/octet-stream")
                            grantUriAccess(this, targetPkg, fpUri, setAsData = true)
                            clipData = ClipData.newRawUri("ROM", fpUri)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or
                                     Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                     Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        activity.startActivity(intent)
                        Log.d(TAG, "PPSSPP booted with FileProvider URI")
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                            putString("emulatorName", "PPSSPP")
                        })
                        return
                    } catch (e: Exception) {
                        lastErr = e
                    }
                }

                // Attempt 5: Raw File URI (For legacy Android or rooted storage access)
                try {
                    val rawFileUri = Uri.fromFile(File(cleanPath))
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        component = resolvedComponent
                        addCategory(Intent.CATEGORY_DEFAULT)
                        setDataAndType(rawFileUri, "application/octet-stream")
                        putExtra("org.ppsspp.ppsspp.Shortcuts", cleanPath)
                        putExtra("bootPath", cleanPath)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    activity.startActivity(intent)
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                        putString("emulatorName", "PPSSPP")
                    })
                    return
                } catch (e: Exception) {
                    lastErr = e
                }

                // Attempt 6: Direct Component ACTION_MAIN with Shortcuts extra
                try {
                    val intent = Intent(Intent.ACTION_MAIN).apply {
                        component = resolvedComponent
                        putExtra("org.ppsspp.ppsspp.Shortcuts", cleanPath)
                        putExtra("bootPath", cleanPath)
                        putExtra("path", cleanPath)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    activity.startActivity(intent)
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                    })
                    return
                } catch (e: Exception) {
                    lastErr = e
                }

                promise.reject("LAUNCH_FAILED", "Could not start PPSSPP ($targetPkg): ${lastErr?.message}", lastErr)
                return
            }

            // =========================================================================
            // 5. RETROARCH (SNES, N64, GBA, GB, GBC, NES, Genesis, Atari, etc.)
            // =========================================================================
            val isRetroArch = emulatorPkg == null ||
                              emulatorPkg.contains("retroarch") ||
                              RETROARCH_PACKAGES.contains(emulatorPkg)

            if (isRetroArch && RETROARCH_CORES.containsKey(consoleId)) {
                var detectedPkg = emulatorPkg?.takeIf { it.isNotBlank() && it.contains("retroarch") && isAppInstalled(it) }
                if (detectedPkg == null) {
                    for (candidate in RETROARCH_PACKAGES) {
                        if (isAppInstalled(candidate)) {
                            detectedPkg = candidate
                            break
                        }
                    }
                }
                val targetPkg: String = detectedPkg ?: emulatorPkg?.takeIf { it.isNotBlank() } ?: "com.retroarch"

                // Intelligent multi-core detection & fallback for RetroArch
                val (coreName, corePath) = resolveRetroArchCore(consoleId, targetPkg, preferredCore)
                val targetActivity = "$targetPkg.browser.retroactivity.RetroActivityFuture"
                val cfgPath = "/storage/emulated/0/Android/data/$targetPkg/files/retroarch.cfg"
                val fileUri = Uri.parse(candidates.fileUri)

                Log.d(TAG, "🎮 Launching RetroArch: console=$consoleId, core=$coreName, corePath=$corePath, ROM=$cleanPath")

                // Direct Game Boot into RetroArch using RetroActivityFuture
                try {
                    val intent = Intent(Intent.ACTION_MAIN).apply {
                        component = ComponentName(targetPkg, targetActivity)
                        putExtra("ROM", cleanPath)
                        putExtra("PATH", cleanPath)
                        putExtra("LIBRETRO", corePath)
                        putExtra("CONFIGFILE", cfgPath)
                        putExtra("QUITFOCUS", "")
                        grantUriAccess(this, targetPkg, fileUri)
                        addFlags(baseFlags)
                    }
                    activity.startActivity(intent)
                    Log.d(TAG, "RetroArch booted successfully: core=$coreName, ROM=$cleanPath")
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                        putString("emulatorName", "RetroArch")
                        putString("coreUsed", coreName)
                    })
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "RetroActivityFuture launch failed: ${e.message}, trying ACTION_VIEW")
                }

                // Fallback: ACTION_VIEW with RetroArch extras
                try {
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setPackage(targetPkg)
                        putExtra("ROM", cleanPath)
                        putExtra("PATH", cleanPath)
                        putExtra("LIBRETRO", corePath)
                        putExtra("CONFIGFILE", cfgPath)
                        grantUriAccess(this, targetPkg, fileUri)
                        addFlags(baseFlags)
                    }
                    activity.startActivity(intent)
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                        putString("emulatorName", "RetroArch")
                        putString("coreUsed", coreName)
                    })
                    return
                } catch (e: Exception) {
                    Log.w(TAG, "RetroArch fallback failed: ${e.message}")
                    promise.reject("LAUNCH_FAILED", "Could not launch RetroArch: ${e.message}", e)
                    return
                }
            }

            // =========================================================================
            // 6. STANDALONE EMULATORS (Snes9x EX+, Pizza Boy, .emu series, etc.)
            // =========================================================================
            if (!emulatorPkg.isNullOrBlank()) {
                val targetPkg: String = emulatorPkg
                val fileUri = Uri.parse(candidates.fileUri)

                // Robert Broglia .emu series (Snes9x EX+, GBA.emu, MD.emu, NES.emu, 2600.emu)
                if (targetPkg.contains("explusalpha") || targetPkg.contains("imagine")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            component = ComponentName(targetPkg, "com.imagine.BaseActivity")
                            grantUriAccess(this, targetPkg, fileUri, setAsData = true)
                            addFlags(baseFlags)
                        }
                        activity.startActivity(intent)
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                        })
                        return
                    } catch (e: Exception) {}
                }

                // Pizza Boy series
                if (targetPkg.contains("pizzaboy")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setPackage(targetPkg)
                            grantUriAccess(this, targetPkg, fileUri, setAsData = true)
                            addFlags(baseFlags)
                        }
                        activity.startActivity(intent)
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", targetPkg)
                        })
                        return
                    } catch (e: Exception) {}
                }

                // Generic ACTION_VIEW
                try {
                    val viewIntent = Intent(Intent.ACTION_VIEW).apply {
                        setPackage(targetPkg)
                        grantUriAccess(this, targetPkg, fileUri, setAsData = true)
                        addFlags(baseFlags)
                    }
                    activity.startActivity(viewIntent)
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                    })
                    return
                } catch (e: Exception) {}

                // Package launch intent fallback
                val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(targetPkg)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    activity.startActivity(launchIntent)
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("packageName", targetPkg)
                    })
                    return
                }
            }

            promise.reject("LAUNCH_FAILED", "No compatible emulator found for $consoleId ($emulatorPkg)")
        } catch (e: Exception) {
            Log.e(TAG, "launchGame failed completely", e)
            promise.reject("LAUNCH_FAILED", e.message, e)
        }
    }

    /**
     * Backward compatibility 3-parameter overload
     */
    @ReactMethod
    fun launchGame(
        consoleId: String,
        filePath: String,
        emulatorPkg: String?,
        promise: Promise
    ) {
        launchGame(consoleId, filePath, emulatorPkg, null, promise)
    }

    @ReactMethod
    fun launchPs2(
        packageName: String,
        targetActivity: String,
        safUri: String,
        rawPath: String,
        promise: Promise
    ) {
        val options = Arguments.createMap().apply {
            putString("ps2_boot_mode", "library_root")
        }
        launchGame("PS2", rawPath, packageName, options, promise)
    }

    @ReactMethod
    fun launchGeneric(
        packageName: String,
        className: String?,
        action: String?,
        dataUri: String?,
        extras: ReadableMap?,
        flags: Int,
        promise: Promise
    ) {
        try {
            val intent = Intent()
            intent.action = if (!action.isNullOrEmpty()) action else Intent.ACTION_VIEW

            if (!className.isNullOrEmpty()) {
                intent.component = ComponentName(packageName, className)
            } else {
                intent.setPackage(packageName)
            }

            if (!dataUri.isNullOrEmpty()) {
                val parsedUri = Uri.parse(dataUri)
                grantUriAccess(intent, packageName, parsedUri, setAsData = true)
            }

            if (extras != null) {
                intent.putExtras(Arguments.toBundle(extras)!!)
            }

            var finalFlags = flags
            if (finalFlags == 0) {
                finalFlags = Intent.FLAG_ACTIVITY_NEW_TASK
            } else {
                finalFlags = finalFlags or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            intent.addFlags(finalFlags)

            val activity = currentActivity ?: reactContext
            activity.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "launchGeneric failed", e)
            promise.reject("LAUNCH_FAILED", e.message, e)
        }
    }
}
