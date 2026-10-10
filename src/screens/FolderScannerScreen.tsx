import React, { useRef, useState } from 'react';
import {
  Alert,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import IntentLauncher from 'react-native-intent-launcher';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConsoleBadge } from '../components/ConsoleBadge';
import { Header } from '../components/Header';
import { THEME } from '../constants/theme';
import { RomIndexer } from '../services/indexer';
import { IndexerProgress, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderScanner'>;

const DEFAULT_PATHS = [
  `${RNFS.ExternalStorageDirectoryPath}/RETRO GAMES LIBRARY`,
  `${RNFS.ExternalStorageDirectoryPath}/RETRO GAMES LIBRARY/gba`,
  `${RNFS.ExternalStorageDirectoryPath}/RETRO GAMES LIBRARY/ps2`,
  `${RNFS.ExternalStorageDirectoryPath}/Download`,
  `${RNFS.ExternalStorageDirectoryPath}/ROMs`,
  `${RNFS.ExternalStorageDirectoryPath}/RetroArch`,
];

function resolveContentUriToPath(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('/') || uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }

  const decoded = decodeURIComponent(uri);

  const primaryMatch = decoded.match(
    /(?:tree|document)\/(?:primary:)?(?:raw:)?(?:primary:)?(.*)$/i
  );
  if (primaryMatch && primaryMatch[1]) {
    const cleanPath = primaryMatch[1]
      .replace(/^primary:/i, '')
      .replace(/^raw:/i, '');
    return `${RNFS.ExternalStorageDirectoryPath}/${cleanPath}`;
  }

  const storageMatch = decoded.match(/(\/storage\/[^\s]+)/);
  if (storageMatch) {
    return storageMatch[1];
  }

  if (decoded.includes('primary:')) {
    const after = decoded.substring(decoded.indexOf('primary:') + 8);
    return `${RNFS.ExternalStorageDirectoryPath}/${after}`;
  }

  return decoded;
}

export const FolderScannerScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedPath, setSelectedPath] = useState(DEFAULT_PATHS[0]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<IndexerProgress | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const indexerRef = useRef<RomIndexer | null>(null);

  const openAllFilesSettings = async () => {
    try {
      await IntentLauncher.startActivity({
        action: 'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        data: 'package:com.retroscan',
      });
    } catch {
      try {
        await IntentLauncher.startActivity({
          action: 'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION',
        });
      } catch (err: any) {
        Alert.alert(
          'Settings Error',
          'Please go to Android Settings -> Apps -> RetroScan -> Permissions -> All Files Access.'
        );
      }
    }
  };

  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      await RNFS.readDir(RNFS.ExternalStorageDirectoryPath);
      return true;
    } catch (testErr) {
      if (Platform.Version >= 30) {
        Alert.alert(
          'All Files Access Required',
          'Android requires "All files access" to scan and read game ROM folders. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: openAllFilesSettings,
            },
          ]
        );
        return false;
      }
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const handlePickFolder = async () => {
    try {
      const response = await DocumentPicker.pickDirectory();
      if (response && response.uri) {
        try {
          const { RetroScanLauncher } = NativeModules;
          if (RetroScanLauncher?.persistTreeUri) {
            await RetroScanLauncher.persistTreeUri(response.uri);
          }
        } catch (pErr) {
          console.warn('Failed to persist tree URI:', pErr);
        }
        const resolved = resolveContentUriToPath(response.uri);
        setSelectedPath(resolved);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert(
          'Directory Picker',
          'Could not open directory picker. You can edit the path manually or use presets.'
        );
      }
    }
  };

  const handleStartIndexing = async () => {
    const hasPerm = await requestStoragePermission();
    if (!hasPerm) {
      return;
    }

    setScanning(true);
    setProgress(null);
    setSummary(null);

    const indexer = new RomIndexer();
    indexerRef.current = indexer;

    try {
      const result = await indexer.scanAndIndexDirectory(selectedPath, p => {
        setProgress({ ...p });
      });

      if (result.totalFound === 0) {
        Alert.alert(
          'No Supported ROMs Found',
          `No game ROM files were found in: \n\n${selectedPath}\n\nMake sure the folder contains ROM files (.iso, .chd, .gba, .nes, .sfc, .zip, etc.).`
        );
      }

      setSummary(
        `Scanned ${result.totalFound} files. Added ${result.indexedCount} games into offline database.`
      );
    } catch (err: any) {
      Alert.alert(
        'Scan Failed',
        err?.message || 'Error occurred while indexing.',
        [
          { text: 'OK' },
          { text: 'Check Permissions', onPress: openAllFilesSettings },
        ]
      );
    } finally {
      setScanning(false);
      indexerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (indexerRef.current) {
      indexerRef.current.cancel();
    }
    setScanning(false);
  };

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <View style={styles.container}>
      <Header
        title="INDEX ROM FOLDER"
        subtitle="100% Offline Batch Indexer"
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: '🛡',
          onPress: openAllFilesSettings,
        }}
      />

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>SELECT ROM DIRECTORY</Text>
        <Text style={styles.sectionSubtitle}>
          RetroScan scans recursively for supported consoles, extracts serials from headers, and indexes to local SQLite.
        </Text>

        <View style={styles.pathBox}>
          <TextInput
            style={styles.pathInput}
            value={selectedPath}
            onChangeText={setSelectedPath}
            placeholder="/storage/emulated/0/..."
            placeholderTextColor={THEME.colors.textMuted}
            editable={!scanning}
          />
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={handlePickFolder}
            disabled={scanning}
          >
            <Text style={styles.browseBtnText}>BROWSE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.presetsRow}>
          {DEFAULT_PATHS.slice(0, 3).map((preset, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.presetChip,
                selectedPath === preset && styles.presetChipActive,
              ]}
              onPress={() => setSelectedPath(preset)}
              disabled={scanning}
            >
              <Text style={styles.presetText} numberOfLines={1}>
                {preset.split('/').pop()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {scanning && progress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
              <Text style={styles.progressFraction}>
                {progress.processed} / {progress.total} files
              </Text>
            </View>

            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${progressPercent}%` }]}
              />
            </View>

            <View style={styles.currentFileBox}>
              <View style={styles.consoleRow}>
                <Text style={styles.labelCurrent}>Current File:</Text>
                {progress.currentConsole && (
                  <ConsoleBadge consoleId={progress.currentConsole} size="small" />
                )}
              </View>
              <Text style={styles.currentFileName} numberOfLines={1}>
                {progress.currentFile}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
            >
              <Text style={styles.cancelBtnText}>CANCEL SCAN</Text>
            </TouchableOpacity>
          </View>
        )}

        {summary && !scanning && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>SCAN COMPLETE</Text>
            <Text style={styles.summaryText}>{summary}</Text>
            <TouchableOpacity
              style={styles.viewLibraryBtn}
              onPress={() => navigation.navigate('Library')}
            >
              <Text style={styles.viewLibraryBtnText}>GO TO LIBRARY</Text>
            </TouchableOpacity>
          </View>
        )}

        {!scanning && !summary && (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={handleStartIndexing}
          >
            <Text style={styles.startBtnText}>START INDEXING</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    flex: 1,
    padding: THEME.spacing.lg,
  },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: THEME.spacing.md,
  },
  pathBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  pathInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: THEME.spacing.md,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  browseBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: THEME.spacing.xl,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 4,
  },
  presetChipActive: {
    borderColor: THEME.colors.accent,
  },
  presetText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
  },
  startBtn: {
    backgroundColor: THEME.colors.accent,
    height: 48,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: THEME.spacing.lg,
  },
  startBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  progressContainer: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  progressPercent: {
    color: THEME.colors.accent,
    fontSize: 24,
    fontWeight: '800',
  },
  progressFraction: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  barTrack: {
    height: 6,
    backgroundColor: '#1E1E1E',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: THEME.spacing.md,
  },
  barFill: {
    height: '100%',
    backgroundColor: THEME.colors.accent,
  },
  currentFileBox: {
    backgroundColor: '#000000',
    padding: THEME.spacing.sm,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  consoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  labelCurrent: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  currentFileName: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#190000',
    borderWidth: 1,
    borderColor: THEME.colors.accentRed,
    borderRadius: THEME.radius.sm,
  },
  cancelBtnText: {
    color: THEME.colors.accentRed,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryBox: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginTop: THEME.spacing.lg,
  },
  summaryTitle: {
    color: THEME.colors.accentGreen,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
    lineHeight: 18,
  },
  viewLibraryBtn: {
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: THEME.radius.sm,
  },
  viewLibraryBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
