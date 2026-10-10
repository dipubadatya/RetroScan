import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import {
  Camera,
  Code,
  useCameraDevice,
  useCameraFormat,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConsoleBadge } from '../components/ConsoleBadge';
import { Header } from '../components/Header';
import { ScanOverlay } from '../components/ScanOverlay';
import { THEME } from '../constants/theme';
import { bindCardToGame, findGameByAnyMatch, getAllGames } from '../services/database';
import { launchEmulator } from '../services/launcher';
import { parseQRPayload } from '../services/qr';
import { GameRecord, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: 5 },
    { videoResolution: { width: 1280, height: 720 } },
  ]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [matchedGame, setMatchedGame] = useState<GameRecord | null>(null);
  const [unmatchedPayload, setUnmatchedPayload] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState<boolean>(false);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState<boolean>(false);
  const [libraryGames, setLibraryGames] = useState<GameRecord[]>([]);
  const [linkSearchQuery, setLinkSearchQuery] = useState<string>('');

  const isProcessingRef = useRef<boolean>(false);
  const lastScannedCodeRef = useRef<string>('');
  const lastScanTimestampRef = useRef<number>(0);

  const handleOpenLinkModal = async () => {
    try {
      const all = await getAllGames();
      setLibraryGames(all);
      setLinkSearchQuery('');
      setIsLinkModalVisible(true);
    } catch (err) {
      console.warn('Failed to load games for linking:', err);
    }
  };

  const handleSelectGameToBind = async (selected: GameRecord) => {
    if (!unmatchedPayload) return;
    try {
      await bindCardToGame(unmatchedPayload, selected.id);
      setIsLinkModalVisible(false);
      setMatchedGame(selected);
      setUnmatchedPayload(null);
      setIsBooting(true);
      try {
        Vibration.vibrate(80);
      } catch { }
      const res = await launchEmulator(selected);
      setIsBooting(false);
      if (!res.success) {
        if (res.notInstalled) {
          Alert.alert(
            'Emulator Missing',
            res.error || `Please install an emulator for ${selected.console}.`,
            [
              {
                text: 'Configure in Settings',
                onPress: () => navigation.navigate('Settings'),
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        } else {
          Alert.alert('Launch Error', res.error || 'Could not launch emulator.');
        }
      }
    } catch (err: any) {
      Alert.alert('Link Error', err?.message || 'Could not bind card to game.');
    }
  };

  const detectedConsole = useMemo(() => {
    if (!unmatchedPayload) return null;
    const p = parseQRPayload(unmatchedPayload);
    return p?.console || null;
  }, [unmatchedPayload]);

  const filteredGamesForLink = useMemo(() => {
    let list = libraryGames;
    if (detectedConsole) {
      const sameConsole = list.filter(g => g.console === detectedConsole);
      if (sameConsole.length > 0 && !linkSearchQuery.trim()) {
        list = sameConsole;
      }
    }
    if (linkSearchQuery.trim()) {
      const q = linkSearchQuery.toLowerCase();
      list = list.filter(
        g =>
          (g.name && g.name.toLowerCase().includes(q)) ||
          (g.fileName && g.fileName.toLowerCase().includes(q)) ||
          (g.console && g.console.toLowerCase().includes(q))
      );
    }
    return list;
  }, [libraryGames, detectedConsole, linkSearchQuery]);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const processScannedCode = useCallback(async (raw: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      const game = await findGameByAnyMatch(raw);

      if (game) {
        setMatchedGame(game);
        setUnmatchedPayload(null);
        setIsBooting(true);

        // Haptic feedback for tactile scan confirmation
        try {
          Vibration.vibrate(80);
        } catch { }

        // Instant automatic emulator launch & direct boot - zero clicks required!
        const res = await launchEmulator(game);

        if (!res.success) {
          setIsBooting(false);
          if (res.notInstalled) {
            Alert.alert(
              'Emulator Missing',
              res.error || `Please install an emulator for ${game.console}.`,
              [
                {
                  text: 'Configure in Settings',
                  onPress: () => navigation.navigate('Settings'),
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          } else {
            Alert.alert('Launch Error', res.error || 'Could not launch emulator.');
          }
        }
      } else {
        setMatchedGame(null);
        setUnmatchedPayload(raw);
        setIsBooting(false);
      }
    } catch (err: any) {
      console.warn('Scan processing error:', err);
      setIsBooting(false);
    } finally {
      // Cooldown debounce so the user can scan another game when returning
      setTimeout(() => {
        isProcessingRef.current = false;
        lastScannedCodeRef.current = '';
        setIsBooting(false);
      }, 3500);
    }
  }, [navigation]);

  const onCodeScanned = useCallback(
    (codes: Code[]) => {
      if (codes.length === 0 || isProcessingRef.current) return;
      const first = codes[0];
      const rawValue = first.value;
      if (!rawValue) return;

      const now = Date.now();
      if (
        rawValue === lastScannedCodeRef.current &&
        now - lastScanTimestampRef.current < 4000
      ) {
        return;
      }

      lastScannedCodeRef.current = rawValue;
      lastScanTimestampRef.current = now;

      processScannedCode(rawValue);
    },
    [processScannedCode]
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned,
  });

  const handleLaunchMatched = async () => {
    if (matchedGame) {
      setIsBooting(true);
      const res = await launchEmulator(matchedGame);
      setIsBooting(false);
      if (!res.success) {
        if (res.notInstalled) {
          Alert.alert(
            'Emulator Missing',
            res.error || `Please install an emulator for ${matchedGame.console}.`,
            [
              {
                text: 'Configure in Settings',
                onPress: () => navigation.navigate('Settings'),
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        } else {
          Alert.alert('Launch Error', res.error || 'Could not launch emulator.');
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="QR SCANNER"
        subtitle="5 FPS Battery Optimized"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.cameraContainer}>
        {isFocused && hasPermission && device != null ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused}
            codeScanner={codeScanner}
            format={format}
            fps={format ? 5 : undefined}
          />
        ) : (
          <View style={styles.inactiveCamera}>
            <Text style={styles.inactiveText}>
              {!hasPermission
                ? 'Camera permission required.'
                : 'Camera is currently unmounted.'}
            </Text>
          </View>
        )}

        <ScanOverlay />

        {matchedGame && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <ConsoleBadge consoleId={matchedGame.console} size="small" />
              <View style={[styles.statusBadge, isBooting ? styles.statusBadgeActive : styles.statusBadgeReady]}>
                <Text style={styles.statusBadgeText}>
                  {isBooting ? '⚡ AUTO-LAUNCHING...' : '● DIRECT PLAY'}
                </Text>
              </View>
            </View>
            <Text style={styles.matchedTitle} numberOfLines={1}>
              {matchedGame.title}
            </Text>
            <Text style={styles.matchedPayload} numberOfLines={1}>
              {matchedGame.qrPayload}
            </Text>
            <TouchableOpacity
              style={[styles.launchBtn, isBooting && styles.launchBtnActive]}
              onPress={handleLaunchMatched}
            >
              <Text style={styles.launchBtnText}>
                {isBooting ? '▶ BOOTING IN EMULATOR...' : '▶ PLAY NOW'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {unmatchedPayload && !matchedGame && (
          <View style={[styles.resultCard, styles.unmatchedCard]}>
            <View style={styles.resultHeader}>
              <Text style={styles.unmatchedTitle}>UNKNOWN / UNINDEXED CARD</Text>
              {detectedConsole && <ConsoleBadge consoleId={detectedConsole} size="small" />}
            </View>
            <Text style={styles.unmatchedPayload} numberOfLines={1}>
              {unmatchedPayload}
            </Text>
            <Text style={styles.unmatchedHelp}>
              Card detected! Link it to any ROM in your library or index your ROM folder.
            </Text>
            <View style={styles.unmatchedActions}>
              <TouchableOpacity
                style={styles.linkCardBtn}
                onPress={handleOpenLinkModal}
              >
                <Text style={styles.linkCardBtnText}>🔗 LINK TO A GAME</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.indexRomBtn}
                onPress={() => navigation.navigate('FolderScanner')}
              >
                <Text style={styles.indexRomBtnText}>📁 INDEX ROMS</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Modal
        visible={isLinkModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLinkModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>LINK CARD TO ROM</Text>
              <TouchableOpacity
                onPress={() => setIsLinkModalVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle} numberOfLines={1}>
              Card: {unmatchedPayload}
            </Text>

            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search ROM by name..."
              placeholderTextColor={THEME.colors.textMuted}
              value={linkSearchQuery}
              onChangeText={setLinkSearchQuery}
            />

            <FlatList
              data={filteredGamesForLink}
              keyExtractor={item => String(item.id)}
              style={styles.modalList}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>
                    No matching ROMs found in your library.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalGameItem}
                  onPress={() => handleSelectGameToBind(item)}
                >
                  <ConsoleBadge consoleId={item.console} size="small" />
                  <View style={styles.modalGameInfo}>
                    <Text style={styles.modalGameTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.modalGameFile} numberOfLines={1}>
                      {item.fileName}
                    </Text>
                  </View>
                  <Text style={styles.modalSelectArrow}>➔</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  inactiveCamera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  inactiveText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  resultCard: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: THEME.colors.accentGreen,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  matchedLabel: {
    color: THEME.colors.accentGreen,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  matchedTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  matchedPayload: {
    color: THEME.colors.accent,
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  statusBadgeActive: {
    backgroundColor: '#00E5FF22',
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  statusBadgeReady: {
    backgroundColor: '#00FF6622',
    borderWidth: 1,
    borderColor: THEME.colors.accentGreen,
  },
  statusBadgeText: {
    color: THEME.colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  launchBtn: {
    backgroundColor: THEME.colors.accentGreen,
    height: 38,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchBtnActive: {
    backgroundColor: '#00E5FF',
  },
  launchBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  unmatchedCard: {
    borderColor: THEME.colors.accentAmber,
  },
  unmatchedTitle: {
    color: THEME.colors.accentAmber,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  unmatchedPayload: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  unmatchedHelp: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginBottom: 10,
  },
  unmatchedActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  linkCardBtn: {
    flex: 1,
    backgroundColor: THEME.colors.accentGreen,
    height: 36,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCardBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  indexRomBtn: {
    flex: 1,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    height: 36,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexRomBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: THEME.radius.lg,
    borderTopRightRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    maxHeight: '80%',
    padding: THEME.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: THEME.colors.accent,
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  modalSearchInput: {
    backgroundColor: '#191919',
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    color: THEME.colors.textPrimary,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    marginBottom: 12,
  },
  modalList: {
    maxHeight: 350,
  },
  modalGameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalGameInfo: {
    flex: 1,
    marginLeft: 10,
  },
  modalGameTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalGameFile: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  modalSelectArrow: {
    color: THEME.colors.accentGreen,
    fontSize: 14,
    marginLeft: 8,
  },
  modalEmpty: {
    padding: 24,
    alignItems: 'center',
  },
  modalEmptyText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
});
