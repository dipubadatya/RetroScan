// import React, { useRef, useState } from 'react';
// import {
//   Alert,
//   NativeModules,
//   PermissionsAndroid,
//   Platform,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from 'react-native';
// import DocumentPicker from 'react-native-document-picker';
// import RNFS from 'react-native-fs';
// import IntentLauncher from 'react-native-intent-launcher';
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import { ConsoleBadge } from '../components/ConsoleBadge';
// import { Header } from '../components/Header';
// import { THEME } from '../constants/theme';
// import { RomIndexer } from '../services/indexer';
// import { IndexerProgress, RootStackParamList } from '../types';

// type Props = NativeStackScreenProps<RootStackParamList, 'FolderScanner'>;

// const DEFAULT_PATHS = [
//   `${RNFS.ExternalStorageDirectoryPath}/RETRO GAMES LIBRARY`,
//   `${RNFS.ExternalStorageDirectoryPath}/RETRO GAMES LIBRARY/gba`,
//   `${RNFS.ExternalStorageDirectoryPath}/RETRO GAMES LIBRARY/ps2`,
//   `${RNFS.ExternalStorageDirectoryPath}/Download`,
//   `${RNFS.ExternalStorageDirectoryPath}/ROMs`,
//   `${RNFS.ExternalStorageDirectoryPath}/RetroArch`,
// ];

// function resolveContentUriToPath(uri: string): string {
//   if (!uri) return '';
//   if (uri.startsWith('/') || uri.startsWith('file://')) {
//     return uri.replace('file://', '');
//   }

//   const decoded = decodeURIComponent(uri);

//   const primaryMatch = decoded.match(
//     /(?:tree|document)\/(?:primary:)?(?:raw:)?(?:primary:)?(.*)$/i
//   );
//   if (primaryMatch && primaryMatch[1]) {
//     const cleanPath = primaryMatch[1]
//       .replace(/^primary:/i, '')
//       .replace(/^raw:/i, '');
//     return `${RNFS.ExternalStorageDirectoryPath}/${cleanPath}`;
//   }

//   const storageMatch = decoded.match(/(\/storage\/[^\s]+)/);
//   if (storageMatch) {
//     return storageMatch[1];
//   }

//   if (decoded.includes('primary:')) {
//     const after = decoded.substring(decoded.indexOf('primary:') + 8);
//     return `${RNFS.ExternalStorageDirectoryPath}/${after}`;
//   }

//   return decoded;
// }

// export const FolderScannerScreen: React.FC<Props> = ({ navigation }) => {
//   const [selectedPath, setSelectedPath] = useState(DEFAULT_PATHS[0]);
//   const [scanning, setScanning] = useState(false);
//   const [progress, setProgress] = useState<IndexerProgress | null>(null);
//   const [summary, setSummary] = useState<string | null>(null);
//   const indexerRef = useRef<RomIndexer | null>(null);

//   const openAllFilesSettings = async () => {
//     try {
//       await IntentLauncher.startActivity({
//         action: 'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
//         data: 'package:com.retroscan',
//       });
//     } catch {
//       try {
//         await IntentLauncher.startActivity({
//           action: 'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION',
//         });
//       } catch (err: any) {
//         Alert.alert(
//           'Settings Error',
//           'Please go to Android Settings -> Apps -> RetroScan -> Permissions -> All Files Access.'
//         );
//       }
//     }
//   };

//   const requestStoragePermission = async (): Promise<boolean> => {
//     if (Platform.OS !== 'android') return true;

//     try {
//       await RNFS.readDir(RNFS.ExternalStorageDirectoryPath);
//       return true;
//     } catch (testErr) {
//       if (Platform.Version >= 30) {
//         Alert.alert(
//           'All Files Access Required',
//           'Android requires "All files access" to scan and read game ROM folders. Please enable it in Settings.',
//           [
//             { text: 'Cancel', style: 'cancel' },
//             {
//               text: 'Open Settings',
//               onPress: openAllFilesSettings,
//             },
//           ]
//         );
//         return false;
//       }
//     }

//     try {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     } catch {
//       return false;
//     }
//   };

//   const handlePickFolder = async () => {
//     try {
//       const response = await DocumentPicker.pickDirectory();
//       if (response && response.uri) {
//         try {
//           const { RetroScanLauncher } = NativeModules;
//           if (RetroScanLauncher?.persistTreeUri) {
//             await RetroScanLauncher.persistTreeUri(response.uri);
//           }
//         } catch (pErr) {
//           console.warn('Failed to persist tree URI:', pErr);
//         }
//         const resolved = resolveContentUriToPath(response.uri);
//         setSelectedPath(resolved);
//       }
//     } catch (err) {
//       if (!DocumentPicker.isCancel(err)) {
//         Alert.alert(
//           'Directory Picker',
//           'Could not open directory picker. You can edit the path manually or use presets.'
//         );
//       }
//     }
//   };

//   const handleStartIndexing = async () => {
//     const hasPerm = await requestStoragePermission();
//     if (!hasPerm) {
//       return;
//     }

//     setScanning(true);
//     setProgress(null);
//     setSummary(null);

//     const indexer = new RomIndexer();
//     indexerRef.current = indexer;

//     try {
//       const result = await indexer.scanAndIndexDirectory(selectedPath, p => {
//         setProgress({ ...p });
//       });

//       if (result.totalFound === 0) {
//         Alert.alert(
//           'No Supported ROMs Found',
//           `No game ROM files were found in: \n\n${selectedPath}\n\nMake sure the folder contains ROM files (.iso, .chd, .gba, .nes, .sfc, .zip, etc.).`
//         );
//       }

//       setSummary(
//         `Scanned ${result.totalFound} files. Added ${result.indexedCount} games into offline database.`
//       );
//     } catch (err: any) {
//       Alert.alert(
//         'Scan Failed',
//         err?.message || 'Error occurred while indexing.',
//         [
//           { text: 'OK' },
//           { text: 'Check Permissions', onPress: openAllFilesSettings },
//         ]
//       );
//     } finally {
//       setScanning(false);
//       indexerRef.current = null;
//     }
//   };

//   const handleCancel = () => {
//     if (indexerRef.current) {
//       indexerRef.current.cancel();
//     }
//     setScanning(false);
//   };

//   const progressPercent =
//     progress && progress.total > 0
//       ? Math.round((progress.processed / progress.total) * 100)
//       : 0;

//   return (
//     <View style={styles.container}>
//       <Header
//         title="INDEX ROM FOLDER"
//         subtitle="100% Offline Batch Indexer"
//         onBack={() => navigation.goBack()}
//         rightAction={{
//           icon: '🛡',
//           onPress: openAllFilesSettings,
//         }}
//       />

//       <View style={styles.content}>
//         <Text style={styles.sectionTitle}>SELECT ROM DIRECTORY</Text>
//         <Text style={styles.sectionSubtitle}>
//           RetroScan scans recursively for supported consoles, extracts serials from headers, and indexes to local SQLite.
//         </Text>

//         <View style={styles.pathBox}>
//           <TextInput
//             style={styles.pathInput}
//             value={selectedPath}
//             onChangeText={setSelectedPath}
//             placeholder="/storage/emulated/0/..."
//             placeholderTextColor={THEME.colors.textMuted}
//             editable={!scanning}
//           />
//           <TouchableOpacity
//             style={styles.browseBtn}
//             onPress={handlePickFolder}
//             disabled={scanning}
//           >
//             <Text style={styles.browseBtnText}>BROWSE</Text>
//           </TouchableOpacity>
//         </View>

//         <View style={styles.presetsRow}>
//           {DEFAULT_PATHS.slice(0, 3).map((preset, index) => (
//             <TouchableOpacity
//               key={index}
//               style={[
//                 styles.presetChip,
//                 selectedPath === preset && styles.presetChipActive,
//               ]}
//               onPress={() => setSelectedPath(preset)}
//               disabled={scanning}
//             >
//               <Text style={styles.presetText} numberOfLines={1}>
//                 {preset.split('/').pop()}
//               </Text>
//             </TouchableOpacity>
//           ))}
//         </View>

//         {scanning && progress && (
//           <View style={styles.progressContainer}>
//             <View style={styles.progressHeader}>
//               <Text style={styles.progressPercent}>{progressPercent}%</Text>
//               <Text style={styles.progressFraction}>
//                 {progress.processed} / {progress.total} files
//               </Text>
//             </View>

//             <View style={styles.barTrack}>
//               <View
//                 style={[styles.barFill, { width: `${progressPercent}%` }]}
//               />
//             </View>

//             <View style={styles.currentFileBox}>
//               <View style={styles.consoleRow}>
//                 <Text style={styles.labelCurrent}>Current File:</Text>
//                 {progress.currentConsole && (
//                   <ConsoleBadge consoleId={progress.currentConsole} size="small" />
//                 )}
//               </View>
//               <Text style={styles.currentFileName} numberOfLines={1}>
//                 {progress.currentFile}
//               </Text>
//             </View>

//             <TouchableOpacity
//               style={styles.cancelBtn}
//               onPress={handleCancel}
//             >
//               <Text style={styles.cancelBtnText}>CANCEL SCAN</Text>
//             </TouchableOpacity>
//           </View>
//         )}

//         {summary && !scanning && (
//           <View style={styles.summaryBox}>
//             <Text style={styles.summaryTitle}>SCAN COMPLETE</Text>
//             <Text style={styles.summaryText}>{summary}</Text>
//             <TouchableOpacity
//               style={styles.viewLibraryBtn}
//               onPress={() => navigation.navigate('Library')}
//             >
//               <Text style={styles.viewLibraryBtnText}>GO TO LIBRARY</Text>
//             </TouchableOpacity>
//           </View>
//         )}

//         {!scanning && !summary && (
//           <TouchableOpacity
//             style={styles.startBtn}
//             onPress={handleStartIndexing}
//           >
//             <Text style={styles.startBtnText}>START INDEXING</Text>
//           </TouchableOpacity>
//         )}
//       </View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: THEME.colors.background,
//   },
//   content: {
//     flex: 1,
//     padding: THEME.spacing.lg,
//   },
//   sectionTitle: {
//     color: THEME.colors.textPrimary,
//     fontSize: 14,
//     fontWeight: '700',
//     letterSpacing: 1,
//     marginBottom: 4,
//   },
//   sectionSubtitle: {
//     color: THEME.colors.textSecondary,
//     fontSize: 12,
//     lineHeight: 18,
//     marginBottom: THEME.spacing.md,
//   },
//   pathBox: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     marginBottom: THEME.spacing.md,
//   },
//   pathInput: {
//     flex: 1,
//     height: 44,
//     backgroundColor: '#0A0A0A',
//     borderWidth: 1,
//     borderColor: THEME.colors.borderLight,
//     borderRadius: THEME.radius.sm,
//     paddingHorizontal: THEME.spacing.md,
//     color: THEME.colors.textPrimary,
//     fontSize: 12,
//     fontFamily: 'monospace',
//   },
//   browseBtn: {
//     height: 44,
//     paddingHorizontal: 16,
//     backgroundColor: '#161616',
//     borderWidth: 1,
//     borderColor: THEME.colors.borderLight,
//     borderRadius: THEME.radius.sm,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   browseBtnText: {
//     color: THEME.colors.textPrimary,
//     fontSize: 12,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },
//   presetsRow: {
//     flexDirection: 'row',
//     gap: 8,
//     marginBottom: THEME.spacing.xl,
//   },
//   presetChip: {
//     paddingHorizontal: 10,
//     paddingVertical: 5,
//     backgroundColor: '#0F0F0F',
//     borderWidth: 1,
//     borderColor: THEME.colors.border,
//     borderRadius: 4,
//   },
//   presetChipActive: {
//     borderColor: THEME.colors.accent,
//   },
//   presetText: {
//     color: THEME.colors.textSecondary,
//     fontSize: 11,
//   },
//   startBtn: {
//     backgroundColor: THEME.colors.accent,
//     height: 48,
//     borderRadius: THEME.radius.sm,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: THEME.spacing.lg,
//   },
//   startBtnText: {
//     color: '#000000',
//     fontSize: 13,
//     fontWeight: '800',
//     letterSpacing: 1,
//   },
//   progressContainer: {
//     backgroundColor: '#0A0A0A',
//     borderWidth: 1,
//     borderColor: THEME.colors.border,
//     borderRadius: THEME.radius.md,
//     padding: THEME.spacing.lg,
//     marginTop: THEME.spacing.lg,
//   },
//   progressHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'baseline',
//     marginBottom: 8,
//   },
//   progressPercent: {
//     color: THEME.colors.accent,
//     fontSize: 24,
//     fontWeight: '800',
//   },
//   progressFraction: {
//     color: THEME.colors.textSecondary,
//     fontSize: 12,
//     fontFamily: 'monospace',
//   },
//   barTrack: {
//     height: 6,
//     backgroundColor: '#1E1E1E',
//     borderRadius: 3,
//     overflow: 'hidden',
//     marginBottom: THEME.spacing.md,
//   },
//   barFill: {
//     height: '100%',
//     backgroundColor: THEME.colors.accent,
//   },
//   currentFileBox: {
//     backgroundColor: '#000000',
//     padding: THEME.spacing.sm,
//     borderRadius: 4,
//     borderWidth: 1,
//     borderColor: THEME.colors.border,
//     marginBottom: THEME.spacing.md,
//   },
//   consoleRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//     marginBottom: 4,
//   },
//   labelCurrent: {
//     color: THEME.colors.textMuted,
//     fontSize: 10,
//     fontWeight: '700',
//     letterSpacing: 0.5,
//   },
//   currentFileName: {
//     color: THEME.colors.textPrimary,
//     fontSize: 11,
//     fontFamily: 'monospace',
//   },
//   cancelBtn: {
//     alignItems: 'center',
//     paddingVertical: 10,
//     backgroundColor: '#190000',
//     borderWidth: 1,
//     borderColor: THEME.colors.accentRed,
//     borderRadius: THEME.radius.sm,
//   },
//   cancelBtnText: {
//     color: THEME.colors.accentRed,
//     fontSize: 11,
//     fontWeight: '800',
//     letterSpacing: 0.5,
//   },
//   summaryBox: {
//     backgroundColor: '#0A0A0A',
//     borderWidth: 1,
//     borderColor: THEME.colors.borderLight,
//     borderRadius: THEME.radius.md,
//     padding: THEME.spacing.lg,
//     alignItems: 'center',
//     marginTop: THEME.spacing.lg,
//   },
//   summaryTitle: {
//     color: THEME.colors.accentGreen,
//     fontSize: 14,
//     fontWeight: '800',
//     letterSpacing: 1,
//     marginBottom: 8,
//   },
//   summaryText: {
//     color: THEME.colors.textSecondary,
//     fontSize: 13,
//     textAlign: 'center',
//     marginBottom: THEME.spacing.lg,
//     lineHeight: 18,
//   },
//   viewLibraryBtn: {
//     backgroundColor: THEME.colors.accent,
//     paddingHorizontal: 24,
//     paddingVertical: 10,
//     borderRadius: THEME.radius.sm,
//   },
//   viewLibraryBtnText: {
//     color: '#000000',
//     fontSize: 12,
//     fontWeight: '800',
//     letterSpacing: 0.5,
//   },
// });
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  BackHandler,
  AlertButton,
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

type LoadingStage =
  | 'idle'
  | 'opening-picker'
  | 'resolving-path'
  | 'checking-permission'
  | 'validating-folder'
  | 'scanning';

function resolveContentUriToPath(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('/') || uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }

  const decoded = decodeURIComponent(uri);

  const primaryMatch = decoded.match(
    /(?:tree|document)\/(?:primary:)?(?:raw:)?(?:primary:)?(.*)$/i,
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

interface FriendlyError {
  title: string;
  message: string;
  action?: 'open-settings';
}

function friendlyError(err: any): FriendlyError {
  const raw = (err?.message || String(err || '')).toLowerCase();

  if (
    raw.includes('permission') ||
    raw.includes('eacces') ||
    raw.includes('denied')
  ) {
    return {
      title: 'Permission Denied',
      message:
        'RetroScan needs permission to read this folder. Please enable "All files access" in Settings and try again.',
      action: 'open-settings',
    };
  }
  if (
    raw.includes('enoent') ||
    raw.includes('not found') ||
    raw.includes('no such')
  ) {
    return {
      title: 'Folder Not Found',
      message:
        'The selected folder does not exist or was moved. Please pick a valid folder.',
    };
  }
  if (raw.includes('cancel')) {
    return { title: 'Cancelled', message: 'Operation cancelled by user.' };
  }
  if (raw.includes('timeout')) {
    return {
      title: 'Timeout',
      message:
        'The operation took too long. Try selecting a smaller folder or restart the app.',
    };
  }
  return {
    title: 'Something Went Wrong',
    message:
      err?.message ||
      'An unexpected error occurred. Please try again. If the problem continues, restart the app.',
  };
}

export const FolderScannerScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedPath, setSelectedPath] = useState<string>(DEFAULT_PATHS[0]);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const [progress, setProgress] = useState<IndexerProgress | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const indexerRef = useRef<RomIndexer | null>(null);
  const spinValue = useRef(new Animated.Value(0)).current;

  const selectedPathRef = useRef<string>(DEFAULT_PATHS[0]);
  const waitingForPermissionRef = useRef<boolean>(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);

  const scanning = loadingStage === 'scanning';
  const busy = loadingStage !== 'idle';

  const openAllFilesSettings = useCallback(async () => {
    try {
      const { RetroScanLauncher } = NativeModules;
      if (RetroScanLauncher?.openAllFilesSettings) {
        const opened = await RetroScanLauncher.openAllFilesSettings();
        if (opened) return;
      }
    } catch {
      // fallback
    }

    const androidVersion =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (androidVersion >= 30) {
      try {
        await IntentLauncher.startActivity({
          action: 'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
          data: 'package:com.retroscan',
        });
        return;
      } catch {
        try {
          await IntentLauncher.startActivity({
            action: 'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION',
          });
          return;
        } catch {
          // fallback to app settings
        }
      }
    }

    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        'Cannot Open Settings',
        'Please manually open:\n\nSettings → Apps → RetroScan → Permissions → Allow All Files Access',
        [{ text: 'OK' }],
      );
    }
  }, []);

  const showFriendlyAlert = useCallback(
    (fe: FriendlyError) => {
      const buttons: AlertButton[] = [{ text: 'OK' }];
      if (fe.action === 'open-settings') {
        buttons.push({
          text: 'Open Settings',
          onPress: () => {
            waitingForPermissionRef.current = true;
            openAllFilesSettings();
          },
        });
      }
      Alert.alert(fe.title, fe.message, buttons);
    },
    [openAllFilesSettings],
  );

  /* Spinner animation */
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (busy) {
      anim = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      anim.start();
    } else {
      spinValue.setValue(0);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [busy, spinValue]);

  const handleCancel = useCallback(() => {
    if (indexerRef.current) {
      try {
        indexerRef.current.cancel();
      } catch (e) {
        console.warn('Cancel error:', e);
      }
    }
    setLoadingStage('idle');
  }, []);

  const confirmCancel = useCallback(() => {
    Alert.alert(
      'Cancel Scan?',
      'Progress will be lost. Already indexed games will remain in your library.',
      [
        { text: 'Continue Scanning', style: 'cancel' },
        {
          text: 'Cancel Scan',
          style: 'destructive',
          onPress: handleCancel,
        },
      ],
    );
  }, [handleCancel]);

  /* Prevent accidental back during scan */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (scanning) {
        Alert.alert(
          'Scan in Progress',
          'A scan is currently running. Do you want to cancel and go back?',
          [
            { text: 'Keep Scanning', style: 'cancel' },
            {
              text: 'Cancel Scan',
              style: 'destructive',
              onPress: () => {
                handleCancel();
                navigation.goBack();
              },
            },
          ],
        );
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [scanning, navigation, handleCancel]);

  const checkHasStoragePermission = useCallback(
    async (): Promise<boolean> => {
      if (Platform.OS !== 'android') return true;

      // 1. Try NativeModule if available
      try {
        const { RetroScanLauncher } = NativeModules;
        if (RetroScanLauncher?.isExternalStorageManager) {
          const isGranted = await RetroScanLauncher.isExternalStorageManager();
          if (typeof isGranted === 'boolean') {
            return isGranted;
          }
        }
      } catch {
        // fallback
      }

      const androidVersion =
        typeof Platform.Version === 'number'
          ? Platform.Version
          : parseInt(String(Platform.Version), 10);

      // 2. Android < 30 (API <= 29): standard runtime permission
      if (androidVersion < 30) {
        try {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          );
          return granted;
        } catch {
          return false;
        }
      }

      // 3. Android >= 30: Test write access to root storage
      // Without MANAGE_EXTERNAL_STORAGE, Android Scoped Storage rejects root file creation with EACCES
      const probeFile = `${RNFS.ExternalStorageDirectoryPath}/.retroscan_perm_probe`;
      try {
        await RNFS.writeFile(probeFile, '1', 'utf8');
        await RNFS.unlink(probeFile).catch(() => {});
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const promptForStoragePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    const androidVersion =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (androidVersion < 30) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission Required',
            message: 'RetroScan needs storage permission to read your ROM files.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        }
      } catch {
        // request failed
      }

      setLoadingStage('idle');
      return new Promise<boolean>(resolve => {
        Alert.alert(
          'Storage Permission Required',
          'RetroScan needs storage permission to read your ROM files.\n\nTap "Turn On" to open Settings and allow access.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                waitingForPermissionRef.current = false;
                resolve(false);
              },
            },
            {
              text: 'Turn On',
              onPress: async () => {
                waitingForPermissionRef.current = true;
                await openAllFilesSettings();
                resolve(false);
              },
            },
          ],
          { cancelable: false },
        );
      });
    }

    setLoadingStage('idle');
    return new Promise<boolean>(resolve => {
      Alert.alert(
        'Storage Permission Required',
        'RetroScan needs "All files access" permission to read and scan your ROM directory.\n\nTap "Turn On" to open Android Settings and allow access.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              waitingForPermissionRef.current = false;
              resolve(false);
            },
          },
          {
            text: 'Turn On',
            onPress: async () => {
              waitingForPermissionRef.current = true;
              await openAllFilesSettings();
              resolve(false);
            },
          },
        ],
        { cancelable: false },
      );
    });
  }, [openAllFilesSettings]);

  const startScanning = useCallback(
    async (targetPath: string) => {
      if (!targetPath || targetPath.trim().length === 0) {
        Alert.alert(
          'No Folder Selected',
          'Please choose a folder before starting.',
        );
        setLoadingStage('idle');
        return;
      }

      setLoadingStage('validating-folder');
      try {
        const exists = await RNFS.exists(targetPath);
        if (!exists) {
          setLoadingStage('idle');
          Alert.alert(
            'Folder Not Found',
            `This folder or file does not exist:\n${targetPath}\n\nPlease pick a valid folder using BROWSE.`,
          );
          return;
        }
      } catch (err: any) {
        setLoadingStage('idle');
        showFriendlyAlert(friendlyError(err));
        return;
      }

      setProgress(null);
      setSummary(null);
      setLoadingStage('scanning');

      const indexer = new RomIndexer();
      indexerRef.current = indexer;

      try {
        const result = await indexer.scanAndIndexDirectory(targetPath, p => {
          setProgress({ ...p });
        });

        if (result.totalFound === 0) {
          Alert.alert(
            'No ROMs Found',
            `No supported ROM files were found in:\n\n${targetPath}\n\nSupported formats include:\n• .iso, .chd, .cue (disc images)\n• .gba, .nes, .sfc, .smc\n• .nds, .3ds, .gb, .gbc\n• .zip, .7z (archived ROMs)\n\nMake sure your ROM files are in this folder.`,
          );
        }

        setSummary(
          `✓ Scanned ${result.totalFound} files\n✓ Added ${result.indexedCount} games to your offline library`,
        );
      } catch (err: any) {
        showFriendlyAlert(friendlyError(err));
      } finally {
        setLoadingStage('idle');
        indexerRef.current = null;
      }
    },
    [showFriendlyAlert],
  );

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const cameFromBackground =
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active';
      appStateRef.current = nextAppState;

      if (cameFromBackground && waitingForPermissionRef.current) {
        waitingForPermissionRef.current = false;
        const currentPath = selectedPathRef.current;
        const granted = await checkHasStoragePermission();
        if (granted) {
          startScanning(currentPath);
        } else {
          setLoadingStage('idle');
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [checkHasStoragePermission, startScanning]);

  const handlePickFolder = useCallback(async () => {
    if (busy) return;

    try {
      setLoadingStage('opening-picker');

      const response = await DocumentPicker.pickDirectory();

      if (!response || !response.uri) {
        setLoadingStage('idle');
        return;
      }

      setLoadingStage('resolving-path');

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
      setSummary(null);

      const hasPerm = await checkHasStoragePermission();
      if (!hasPerm) {
        setLoadingStage('idle');
        promptForStoragePermission();
        return;
      }

      setLoadingStage('validating-folder');
      try {
        const exists = await RNFS.exists(resolved);
        if (!exists) {
          Alert.alert(
            'Folder Not Accessible',
            `Could not read:\n${resolved}\n\nThis may be a cloud/virtual folder. Try choosing a folder from internal storage or SD card.`,
          );
          setLoadingStage('idle');
          return;
        }
      } catch {
        /* non-fatal */
      }

      setLoadingStage('idle');
    } catch (err: any) {
      setLoadingStage('idle');
      if (!DocumentPicker.isCancel(err)) {
        showFriendlyAlert(friendlyError(err));
      }
    }
  }, [busy, checkHasStoragePermission, promptForStoragePermission, showFriendlyAlert]);

  const handleStartIndexing = useCallback(async () => {
    if (busy) return;

    if (!selectedPath || selectedPath.trim().length === 0) {
      Alert.alert(
        'No Folder Selected',
        'Please choose a folder before starting.',
      );
      return;
    }

    setLoadingStage('checking-permission');
    const hasPerm = await checkHasStoragePermission();
    if (!hasPerm) {
      setLoadingStage('idle');
      await promptForStoragePermission();
      return;
    }

    startScanning(selectedPath);
  }, [busy, selectedPath, checkHasStoragePermission, promptForStoragePermission, startScanning]);

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  const loadingLabel = (() => {
    switch (loadingStage) {
      case 'opening-picker':
        return 'Opening folder picker…';
      case 'resolving-path':
        return 'Reading folder…';
      case 'checking-permission':
        return 'Checking permissions…';
      case 'validating-folder':
        return 'Validating folder…';
      default:
        return '';
    }
  })();

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const showBrowseSpinner =
    loadingStage === 'opening-picker' ||
    loadingStage === 'resolving-path' ||
    loadingStage === 'validating-folder';

  return (
    <View style={styles.container}>
      <Header
        title="INDEX ROM FOLDER"
        subtitle="100% Offline Batch Indexer"
        onBack={() => {
          if (scanning) {
            confirmCancel();
          } else {
            navigation.goBack();
          }
        }}
        rightAction={{
          icon: '🛡',
          onPress: openAllFilesSettings,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>SELECT ROM DIRECTORY</Text>
        <Text style={styles.sectionSubtitle}>
          RetroScan scans recursively for supported consoles, extracts serials
          from headers, and indexes to local SQLite.
        </Text>

        <View style={styles.pathBox}>
          <TextInput
            style={[styles.pathInput, busy && styles.inputDisabled]}
            value={selectedPath}
            onChangeText={setSelectedPath}
            placeholder="/storage/emulated/0/..."
            placeholderTextColor={THEME.colors.textMuted}
            editable={!busy}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.browseBtn, busy && styles.btnDisabled]}
            onPress={handlePickFolder}
            disabled={busy}
            activeOpacity={0.7}
          >
            {showBrowseSpinner ? (
              <ActivityIndicator size="small" color={THEME.colors.accent} />
            ) : (
              <Text style={styles.browseBtnText}>BROWSE</Text>
            )}
          </TouchableOpacity>
        </View>

        {busy && !scanning && loadingLabel.length > 0 && (
          <View style={styles.inlineLoader}>
            <Animated.Text
              style={[styles.inlineSpinner, { transform: [{ rotate: spin }] }]}
            >
              ⟳
            </Animated.Text>
            <Text style={styles.inlineLoaderText}>{loadingLabel}</Text>
          </View>
        )}

        <View style={styles.presetsRow}>
          {DEFAULT_PATHS.slice(0, 3).map((preset, index) => (
            <TouchableOpacity
              key={`preset-${index}`}
              style={[
                styles.presetChip,
                selectedPath === preset && styles.presetChipActive,
                busy && styles.btnDisabled,
              ]}
              onPress={() => setSelectedPath(preset)}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.presetText,
                  selectedPath === preset && styles.presetTextActive,
                ]}
                numberOfLines={1}
              >
                {preset.split('/').pop() || preset}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {scanning && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
              <Text style={styles.progressFraction}>
                {progress
                  ? `${progress.processed} / ${progress.total}`
                  : 'Starting…'}
              </Text>
            </View>

            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${progressPercent}%` }]}
              />
            </View>

            {progress ? (
              <View style={styles.currentFileBox}>
                <View style={styles.consoleRow}>
                  <Text style={styles.labelCurrent}>CURRENT FILE</Text>
                  {progress.currentConsole ? (
                    <ConsoleBadge
                      consoleId={progress.currentConsole}
                      size="small"
                    />
                  ) : null}
                </View>
                <Text style={styles.currentFileName} numberOfLines={2}>
                  {progress.currentFile || '—'}
                </Text>
              </View>
            ) : (
              <View style={styles.startupBox}>
                <ActivityIndicator size="small" color={THEME.colors.accent} />
                <Text style={styles.startupText}>
                  Preparing scanner… this may take a moment for large folders.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={confirmCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>CANCEL SCAN</Text>
            </TouchableOpacity>

            <Text style={styles.hintText}>
              💡 Keep the app open. Large folders may take several minutes.
            </Text>
          </View>
        )}

        {summary && !scanning && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>✓ SCAN COMPLETE</Text>
            <Text style={styles.summaryText}>{summary}</Text>
            <TouchableOpacity
              style={styles.viewLibraryBtn}
              onPress={() => navigation.navigate('Library')}
              activeOpacity={0.8}
            >
              <Text style={styles.viewLibraryBtnText}>GO TO LIBRARY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scanAgainBtn}
              onPress={() => setSummary(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.scanAgainBtnText}>SCAN ANOTHER FOLDER</Text>
            </TouchableOpacity>
          </View>
        )}

        {!scanning && !summary && (
          <TouchableOpacity
            style={[styles.startBtn, busy && styles.startBtnDisabled]}
            onPress={handleStartIndexing}
            disabled={busy}
            activeOpacity={0.85}
          >
            {loadingStage === 'checking-permission' ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.startBtnText}>CHECKING PERMISSIONS…</Text>
              </View>
            ) : (
              <Text style={styles.startBtnText}>START INDEXING</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
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
  },
  contentInner: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
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
    marginBottom: THEME.spacing.sm,
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
  inputDisabled: {
    opacity: 0.5,
  },
  browseBtn: {
    height: 44,
    minWidth: 90,
    paddingHorizontal: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  browseBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0A0A0A',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  inlineSpinner: {
    color: THEME.colors.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  inlineLoaderText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: THEME.spacing.xl,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 4,
  },
  presetChipActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: '#1A1A0A',
  },
  presetText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
  },
  presetTextActive: {
    color: THEME.colors.accent,
    fontWeight: '700',
  },
  startBtn: {
    backgroundColor: THEME.colors.accent,
    height: 48,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: THEME.spacing.lg,
  },
  startBtnDisabled: {
    opacity: 0.6,
  },
  startBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 28,
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
  startupBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  startupText: {
    flex: 1,
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
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
  hintText: {
    marginTop: 10,
    color: THEME.colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
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
    lineHeight: 20,
  },
  viewLibraryBtn: {
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: THEME.radius.sm,
    minWidth: 200,
    alignItems: 'center',
  },
  viewLibraryBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scanAgainBtn: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  scanAgainBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});