/**
 * ScannerScreen.tsx — RetroScan ML Kit QR Scanner
 *
 * REWRITE SCOPE (Steps 2-5 from spec):
 *  - Camera permission via useCameraPermission hook
 *  - react-native-vision-camera v3 built-in ML Kit code scanner
 *  - 1500ms cooldown after successful scan
 *  - Green overlay flash + Vibration(100ms) on success
 *  - Auto torch after 5s of no scan (low-light fallback)
 *  - All error states with UI messages
 *  - Manual fallback TextInput always accessible
 *
 * NOT TOUCHED:
 *  - database.ts, launcher.ts, qr.ts, game matching logic
 *  - Navigation structure, RootStackParamList, route params
 *  - ConsoleBadge, GameLaunchAnimation, Header, ScanOverlay components
 *  - QR payload format (consoleId:type:value)
 *  - handleSelectGameToBind, handleOpenLinkModal, handleLaunchMatched flows
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
  StatusBar,
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
import { GameLaunchAnimation } from '../components/GameLaunchAnimation';
import { Header } from '../components/Header';
import { ScanOverlay } from '../components/ScanOverlay';
import { bindCardToGame, findGameByAnyMatch, getAllGames } from '../services/database';
import { launchEmulator } from '../services/launcher';
import { parseQRPayload } from '../services/qr';
import { GameRecord, RootStackParamList } from '../types';
import { useCameraPermission } from '../hooks/useCameraPermission';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

const PREMIUM = {
  colors: {
    bg: '#0A0E1A',
    bgSoft: '#111624',
    card: '#161B2C',
    border: '#232A42',
    borderLight: '#2E3654',
    accent: '#00A3FF',
    accentGreen: '#4ADE80',
    accentAmber: '#FBBF24',
    accentRed: '#F87171',
    textPrimary: '#FFFFFF',
    textSecondary: '#B8C1D9',
    textMuted: '#6B7490',
    overlay: 'rgba(10, 14, 26, 0.85)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 8, md: 12, lg: 16 },
};

const SCAN_COOLDOWN_MS = 1500;
const TORCH_FALLBACK_AFTER_MS = 5000;

export const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const { hasPermission, permissionStatus, isRequesting, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoResolution: { width: 1280, height: 720 } },
  ]);

  const [matchedGame, setMatchedGame] = useState<GameRecord | null>(null);
  const [unmatchedPayload, setUnmatchedPayload] = useState<string | null>(null);
  const [launchingGame, setLaunchingGame] = useState<GameRecord | null>(null);
  const [isLaunchAnimVisible, setIsLaunchAnimVisible] = useState<boolean>(false);
  const [isBooting, setIsBooting] = useState<boolean>(false);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState<boolean>(false);
  const [libraryGames, setLibraryGames] = useState<GameRecord[]>([]);
  const [linkSearchQuery, setLinkSearchQuery] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [invalidQRToast, setInvalidQRToast] = useState<boolean>(false);
  const [showManualFallback, setShowManualFallback] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const flashAnim = useRef(new Animated.Value(0)).current;
  const isProcessingRef = useRef<boolean>(false);
  const lastScannedCodeRef = useRef<string>('');
  const lastScanTimestampRef = useRef<number>(0);
  const torchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (permissionStatus === 'undetermined') {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetTorchTimer = useCallback(() => {
    if (torchTimerRef.current) clearTimeout(torchTimerRef.current);
    setIsTorchOn(false);
    torchTimerRef.current = setTimeout(() => setIsTorchOn(true), TORCH_FALLBACK_AFTER_MS);
  }, []);

  useEffect(() => {
    if (hasPermission && isFocused) resetTorchTimer();
    return () => { if (torchTimerRef.current) clearTimeout(torchTimerRef.current); };
  }, [hasPermission, isFocused, resetTorchTimer]);

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  const triggerSuccessFlash = useCallback(() => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
  }, [flashAnim]);

  const showInvalidQRToast = useCallback(() => {
    setInvalidQRToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setInvalidQRToast(false), 2500);
  }, []);

  const processScannedCode = useCallback(
    async (raw: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      resetTorchTimer();
      const parsed = parseQRPayload(raw);
      if (!parsed) {
        showInvalidQRToast();
        setTimeout(() => { isProcessingRef.current = false; }, SCAN_COOLDOWN_MS);
        return;
      }
      try {
        const game = await findGameByAnyMatch(raw);
        if (game) {
          setMatchedGame(game);
          setUnmatchedPayload(null);
          setLaunchingGame(game);
          setIsBooting(true);
          setIsLaunchAnimVisible(true);
          try { Vibration.vibrate(100); } catch { }
          triggerSuccessFlash();
          await new Promise(resolve => setTimeout(resolve, 850));
          const res = await launchEmulator(game);
          setIsLaunchAnimVisible(false);
          setLaunchingGame(null);
          setIsBooting(false);
          if (!res.success) {
            if (res.notInstalled) {
              Alert.alert('Emulator Missing', res.error || `Please install an emulator for ${game.console}.`, [
                { text: 'Configure Settings', onPress: () => navigation.navigate('Settings') },
                { text: 'Cancel', style: 'cancel' },
              ]);
            } else {
              Alert.alert('Launch Error', res.error || 'Could not launch emulator.');
            }
          }
        } else {
          setMatchedGame(null);
          setUnmatchedPayload(raw);
          setIsBooting(false);
          setIsLaunchAnimVisible(false);
          setLaunchingGame(null);
          try { Vibration.vibrate(100); } catch { }
          triggerSuccessFlash();
        }
      } catch (err) {
        console.warn('[ScannerScreen] processScannedCode error:', err);
        setIsBooting(false);
        setIsLaunchAnimVisible(false);
        setLaunchingGame(null);
      } finally {
        setTimeout(() => {
          isProcessingRef.current = false;
          lastScannedCodeRef.current = '';
          setIsBooting(false);
          setIsLaunchAnimVisible(false);
          setLaunchingGame(null);
        }, SCAN_COOLDOWN_MS);
      }
    },
    [navigation, resetTorchTimer, showInvalidQRToast, triggerSuccessFlash],
  );

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    setManualInput('');
    processScannedCode(trimmed);
  }, [manualInput, processScannedCode]);

  const onCodeScanned = useCallback(
    (codes: Code[]) => {
      if (codes.length === 0 || isProcessingRef.current) return;
      const rawValue = codes[0].value;
      if (!rawValue) return;
      const now = Date.now();
      if (rawValue === lastScannedCodeRef.current && now - lastScanTimestampRef.current < SCAN_COOLDOWN_MS) return;
      lastScannedCodeRef.current = rawValue;
      lastScanTimestampRef.current = now;
      processScannedCode(rawValue);
    },
    [processScannedCode],
  );

  const codeScanner = useCodeScanner({ codeTypes: ['qr'], onCodeScanned });

  const handleCameraError = useCallback((error: Error) => {
    console.error('[ScannerScreen] Camera hardware error:', error);
    setCameraError(error.message || 'Camera hardware error');
    setShowManualFallback(true);
  }, []);

  const handleOpenLinkModal = async () => {
    try {
      const all = await getAllGames();
      setLibraryGames(all || []);
      setLinkSearchQuery('');
      setIsLinkModalVisible(true);
    } catch (err) {
      console.warn('[ScannerScreen] Failed to load games for linking:', err);
    }
  };

  const handleSelectGameToBind = async (selected: GameRecord) => {
    if (!unmatchedPayload || isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      await bindCardToGame(unmatchedPayload, selected.id);
      setIsLinkModalVisible(false);
      setMatchedGame(selected);
      setUnmatchedPayload(null);
      setLaunchingGame(selected);
      setIsLaunchAnimVisible(true);
      setIsBooting(true);
      try { Vibration.vibrate(80); } catch { }
      await new Promise(resolve => setTimeout(resolve, 850));
      const res = await launchEmulator(selected);
      setIsLaunchAnimVisible(false);
      setLaunchingGame(null);
      setIsBooting(false);
      if (!res.success) {
        if (res.notInstalled) {
          Alert.alert('Emulator Missing', res.error || `Please install an emulator for ${selected.console}.`, [
            { text: 'Configure Settings', onPress: () => navigation.navigate('Settings') },
            { text: 'Cancel', style: 'cancel' },
          ]);
        } else {
          Alert.alert('Launch Error', res.error || 'Could not launch emulator.');
        }
      }
    } catch (err: any) {
      setIsLaunchAnimVisible(false);
      setLaunchingGame(null);
      setIsBooting(false);
      Alert.alert('Link Error', err?.message || 'Could not bind card to game.');
    } finally {
      setTimeout(() => { isProcessingRef.current = false; }, 2000);
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
      if (sameConsole.length > 0 && !linkSearchQuery.trim()) list = sameConsole;
    }
    if (linkSearchQuery.trim()) {
      const q = linkSearchQuery.toLowerCase();
      list = list.filter(g =>
        (g.title && g.title.toLowerCase().includes(q)) ||
        (g.fileName && g.fileName.toLowerCase().includes(q)) ||
        (g.console && g.console.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [libraryGames, detectedConsole, linkSearchQuery]);

  const handleLaunchMatched = async () => {
    if (matchedGame && !isProcessingRef.current) {
      isProcessingRef.current = true;
      setLaunchingGame(matchedGame);
      setIsBooting(true);
      setIsLaunchAnimVisible(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 850));
        const res = await launchEmulator(matchedGame);
        setIsLaunchAnimVisible(false);
        setLaunchingGame(null);
        setIsBooting(false);
        if (!res.success) {
          if (res.notInstalled) {
            Alert.alert('Emulator Missing', res.error || `Please install an emulator for ${matchedGame.console}.`, [
              { text: 'Configure Settings', onPress: () => navigation.navigate('Settings') },
              { text: 'Cancel', style: 'cancel' },
            ]);
          } else {
            Alert.alert('Launch Error', res.error || 'Could not launch emulator.');
          }
        }
      } catch {
        setIsLaunchAnimVisible(false);
        setLaunchingGame(null);
        setIsBooting(false);
      } finally {
        setTimeout(() => { isProcessingRef.current = false; }, 1500);
      }
    }
  };

  const cameraReady = isFocused && hasPermission && device != null && !cameraError;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PREMIUM.colors.bg} />
      <Header title="NFC/QR SCANNER" subtitle="ML Kit · Auto-Scan · 30 FPS" onBack={() => navigation.goBack()} />

      <View style={styles.cameraContainer}>

        {/* STEP 4 CASE 1 — Permission denied (retryable) */}
        {permissionStatus === 'denied' && !isRequesting && (
          <View style={styles.errorState}>
            <Text style={styles.errorIcon}>📷</Text>
            <Text style={styles.errorTitle}>Camera Permission Denied</Text>
            <Text style={styles.errorBody}>RetroScan needs camera access to scan your physical game cards.</Text>
            <TouchableOpacity style={styles.errorBtn} onPress={requestPermission} activeOpacity={0.8}>
              <Text style={styles.errorBtnText}>GRANT PERMISSION</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.errorBtn, styles.errorBtnSecondary]} onPress={() => setShowManualFallback(v => !v)} activeOpacity={0.8}>
              <Text style={styles.errorBtnTextSecondary}>ENTER CODE MANUALLY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4 CASE 1b — Permanently denied → open Settings */}
        {permissionStatus === 'denied_forever' && (
          <View style={styles.errorState}>
            <Text style={styles.errorIcon}>🔒</Text>
            <Text style={styles.errorTitle}>Camera Blocked in Settings</Text>
            <Text style={styles.errorBody}>Camera permission was permanently denied. Open Android Settings to allow it.</Text>
            <TouchableOpacity style={styles.errorBtn} onPress={() => Linking.openSettings()} activeOpacity={0.8}>
              <Text style={styles.errorBtnText}>ALLOW CAMERA IN SETTINGS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.errorBtn, styles.errorBtnSecondary]} onPress={() => setShowManualFallback(v => !v)} activeOpacity={0.8}>
              <Text style={styles.errorBtnTextSecondary}>ENTER CODE MANUALLY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4 CASE 2 — No camera device found */}
        {hasPermission && device == null && !cameraError && (
          <View style={styles.errorState}>
            <Text style={styles.errorIcon}>📵</Text>
            <Text style={styles.errorTitle}>No Camera Detected</Text>
            <Text style={styles.errorBody}>No back-facing camera found on this device. Use manual entry below.</Text>
            <TouchableOpacity style={styles.errorBtn} onPress={() => setShowManualFallback(true)} activeOpacity={0.8}>
              <Text style={styles.errorBtnText}>ENTER CODE MANUALLY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4 CASE 3 — Camera hardware error */}
        {cameraError && (
          <View style={styles.errorState}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Camera Hardware Error</Text>
            <Text style={styles.errorBody}>{cameraError}</Text>
            <TouchableOpacity style={styles.errorBtn} onPress={() => { setCameraError(null); setShowManualFallback(false); }} activeOpacity={0.8}>
              <Text style={styles.errorBtnText}>RETRY CAMERA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.errorBtn, styles.errorBtnSecondary]} onPress={() => setShowManualFallback(true)} activeOpacity={0.8}>
              <Text style={styles.errorBtnTextSecondary}>ENTER CODE MANUALLY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Live Camera — auto-scan, no button press needed */}
        {cameraReady && (
          <>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device!}
              isActive={isFocused && !isLaunchAnimVisible}
              codeScanner={codeScanner}
              format={format}
              fps={30}
              torch={isTorchOn ? 'on' : 'off'}
              onError={handleCameraError}
            />
            <Animated.View style={[styles.successFlash, { opacity: flashAnim }]} pointerEvents="none" />
          </>
        )}

        {cameraReady && <ScanOverlay />}

        {/* STEP 3 — Torch indicator */}
        {cameraReady && isTorchOn && (
          <View style={styles.torchBadge}>
            <Text style={styles.torchBadgeText}>🔦 TORCH ON — LOW LIGHT</Text>
          </View>
        )}

        {/* STEP 4 CASE 5 — Invalid QR toast (keeps scanning) */}
        {invalidQRToast && (
          <View style={styles.invalidToast}>
            <Text style={styles.invalidToastText}>❌ Invalid QR code — not a RetroScan card</Text>
          </View>
        )}

        {/* Matched game card */}
        {matchedGame && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <ConsoleBadge consoleId={matchedGame.console} size="small" />
              <View style={[styles.statusBadge, isBooting ? styles.statusBadgeActive : styles.statusBadgeReady]}>
                <Text style={styles.statusBadgeText}>{isBooting ? '⚡ BOOTING GAME...' : '● DIRECT PLAY'}</Text>
              </View>
            </View>
            <Text style={styles.matchedTitle} numberOfLines={1}>{matchedGame.title}</Text>
            <Text style={styles.matchedPayload} numberOfLines={1}>ID: {matchedGame.serial || matchedGame.qrPayload}</Text>
            <TouchableOpacity style={[styles.launchBtn, isBooting && styles.launchBtnActive]} onPress={handleLaunchMatched} activeOpacity={0.8}>
              <Text style={styles.launchBtnText}>{isBooting ? 'STARTING EMULATOR...' : 'PLAY NOW'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Unmatched card (STEP 4 CASE 6 — existing flow, no new logic) */}
        {unmatchedPayload && !matchedGame && (
          <View style={[styles.resultCard, styles.unmatchedCard]}>
            <View style={styles.resultHeader}>
              <Text style={styles.unmatchedTitle}>UNKNOWN GAME CARD</Text>
              {detectedConsole && <ConsoleBadge consoleId={detectedConsole} size="small" />}
            </View>
            <Text style={styles.unmatchedPayload} numberOfLines={1}>Raw: {unmatchedPayload}</Text>
            <Text style={styles.unmatchedHelp}>This physical card has no game mapped to it yet.</Text>
            <View style={styles.unmatchedActions}>
              <TouchableOpacity style={styles.linkCardBtn} onPress={handleOpenLinkModal} activeOpacity={0.8}>
                <Text style={styles.linkCardBtnText}>🔗 LINK TO A ROM</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.indexRomBtn} onPress={() => navigation.navigate('FolderScanner')} activeOpacity={0.8}>
                <Text style={styles.indexRomBtnText}>📁 SCAN ROMS</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 5 — Manual fallback input (always works even with broken camera) */}
        {(showManualFallback || (!hasPermission && permissionStatus !== 'undetermined')) && (
          <View style={styles.manualFallback}>
            <Text style={styles.manualFallbackLabel}>MANUAL CODE ENTRY</Text>
            <Text style={styles.manualFallbackHint}>Paste or type the QR payload (e.g. PS2:S:SCUS-97399)</Text>
            <View style={styles.manualInputRow}>
              <TextInput
                style={styles.manualInput}
                placeholder="PS2:S:SCUS-97399"
                placeholderTextColor={PREMIUM.colors.textMuted}
                value={manualInput}
                onChangeText={setManualInput}
                autoCorrect={false}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleManualSubmit}
              />
              <TouchableOpacity style={styles.manualSubmitBtn} onPress={handleManualSubmit} activeOpacity={0.8}>
                <Text style={styles.manualSubmitBtnText}>GO</Text>
              </TouchableOpacity>
            </View>
            {cameraReady && (
              <TouchableOpacity onPress={() => setShowManualFallback(false)}>
                <Text style={styles.manualDismissText}>← Back to camera scan</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Manual fallback toggle (always visible over camera) */}
        {cameraReady && !showManualFallback && (
          <TouchableOpacity style={styles.manualToggleBtn} onPress={() => setShowManualFallback(true)} activeOpacity={0.8}>
            <Text style={styles.manualToggleBtnText}>⌨ ENTER CODE MANUALLY</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Linking Modal — existing logic, untouched */}
      <Modal visible={isLinkModalVisible} transparent animationType="slide" onRequestClose={() => setIsLinkModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>LINK TO LOCAL ROM</Text>
              <TouchableOpacity onPress={() => setIsLinkModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle} numberOfLines={1}>Tag Code: {unmatchedPayload}</Text>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search by title, serial, filename..."
              placeholderTextColor={PREMIUM.colors.textMuted}
              value={linkSearchQuery}
              onChangeText={setLinkSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredGamesForLink}
              keyExtractor={item => String(item.id)}
              style={styles.modalList}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No compatible ROMs found in database.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalGameItem} onPress={() => handleSelectGameToBind(item)} activeOpacity={0.7}>
                  <ConsoleBadge consoleId={item.console} size="small" />
                  <View style={styles.modalGameInfo}>
                    <Text style={styles.modalGameTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.modalGameFile} numberOfLines={1}>{item.fileName}</Text>
                  </View>
                  <Text style={styles.modalSelectArrow}>➔</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <GameLaunchAnimation
        visible={isLaunchAnimVisible}
        gameTitle={launchingGame?.title || matchedGame?.title}
        consoleId={launchingGame?.console || matchedGame?.console}
        onDismiss={() => { setIsLaunchAnimVisible(false); setLaunchingGame(null); }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PREMIUM.colors.bg },
  cameraContainer: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000000' },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: PREMIUM.colors.bg },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { color: PREMIUM.colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  errorBody: { color: PREMIUM.colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  errorBtn: { width: '100%', backgroundColor: PREMIUM.colors.accent, height: 46, borderRadius: PREMIUM.radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  errorBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: PREMIUM.colors.border },
  errorBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  errorBtnTextSecondary: { color: PREMIUM.colors.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  successFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(74, 222, 128, 0.25)', zIndex: 5 },

  torchBadge: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: 'rgba(251, 191, 36, 0.9)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, zIndex: 10 },
  torchBadgeText: { color: '#000000', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  invalidToast: { position: 'absolute', top: 56, left: 24, right: 24, backgroundColor: 'rgba(248, 113, 113, 0.95)', borderRadius: PREMIUM.radius.sm, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', zIndex: 20 },
  invalidToastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  resultCard: { position: 'absolute', bottom: 24, left: 20, right: 20, backgroundColor: PREMIUM.colors.card, borderWidth: 1, borderColor: PREMIUM.colors.accentGreen, borderRadius: PREMIUM.radius.md, padding: PREMIUM.spacing.lg, elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, zIndex: 15 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: PREMIUM.spacing.sm },
  matchedTitle: { color: PREMIUM.colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  matchedPayload: { color: PREMIUM.colors.accent, fontSize: 12, fontWeight: '600', marginBottom: PREMIUM.spacing.md },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeActive: { backgroundColor: 'rgba(0, 163, 255, 0.15)', borderWidth: 1, borderColor: PREMIUM.colors.accent },
  statusBadgeReady: { backgroundColor: 'rgba(74, 222, 128, 0.15)', borderWidth: 1, borderColor: PREMIUM.colors.accentGreen },
  statusBadgeText: { color: PREMIUM.colors.textPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  launchBtn: { backgroundColor: PREMIUM.colors.accentGreen, height: 42, borderRadius: PREMIUM.radius.sm, alignItems: 'center', justifyContent: 'center' },
  launchBtnActive: { backgroundColor: PREMIUM.colors.accent },
  launchBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },

  unmatchedCard: { borderColor: PREMIUM.colors.accentAmber },
  unmatchedTitle: { color: PREMIUM.colors.accentAmber, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  unmatchedPayload: { color: PREMIUM.colors.textSecondary, fontSize: 12, fontFamily: 'monospace', marginBottom: 4 },
  unmatchedHelp: { color: PREMIUM.colors.textMuted, fontSize: 12, marginBottom: PREMIUM.spacing.md, lineHeight: 16 },
  unmatchedActions: { flexDirection: 'row', gap: 8 },
  linkCardBtn: { flex: 1, backgroundColor: PREMIUM.colors.accent, height: 40, borderRadius: PREMIUM.radius.sm, alignItems: 'center', justifyContent: 'center' },
  linkCardBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  indexRomBtn: { flex: 1, backgroundColor: PREMIUM.colors.bgSoft, borderWidth: 1, borderColor: PREMIUM.colors.border, height: 40, borderRadius: PREMIUM.radius.sm, alignItems: 'center', justifyContent: 'center' },
  indexRomBtnText: { color: PREMIUM.colors.textSecondary, fontSize: 12, fontWeight: '700' },

  manualFallback: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: PREMIUM.colors.bgSoft, borderTopWidth: 1, borderTopColor: PREMIUM.colors.border, padding: PREMIUM.spacing.lg, zIndex: 20 },
  manualFallbackLabel: { color: PREMIUM.colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  manualFallbackHint: { color: PREMIUM.colors.textMuted, fontSize: 11, marginBottom: 10 },
  manualInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  manualInput: { flex: 1, backgroundColor: PREMIUM.colors.card, borderRadius: PREMIUM.radius.sm, borderWidth: 1, borderColor: PREMIUM.colors.border, color: PREMIUM.colors.textPrimary, paddingHorizontal: 12, height: 44, fontSize: 13, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' },
  manualSubmitBtn: { backgroundColor: PREMIUM.colors.accentGreen, width: 52, height: 44, borderRadius: PREMIUM.radius.sm, alignItems: 'center', justifyContent: 'center' },
  manualSubmitBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  manualDismissText: { color: PREMIUM.colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2 },
  manualToggleBtn: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(22, 27, 44, 0.9)', borderWidth: 1, borderColor: PREMIUM.colors.borderLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, zIndex: 10 },
  manualToggleBtnText: { color: PREMIUM.colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 7, 13, 0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: PREMIUM.colors.bgSoft, borderTopLeftRadius: PREMIUM.radius.lg, borderTopRightRadius: PREMIUM.radius.lg, borderWidth: 1, borderColor: PREMIUM.colors.border, maxHeight: '80%', padding: PREMIUM.spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { color: PREMIUM.colors.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: { padding: 6 },
  closeBtnText: { color: PREMIUM.colors.textMuted, fontSize: 18, fontWeight: '700' },
  modalSubtitle: { color: PREMIUM.colors.accent, fontSize: 12, fontFamily: 'monospace', marginBottom: PREMIUM.spacing.md },
  modalSearchInput: { backgroundColor: PREMIUM.colors.card, borderRadius: PREMIUM.radius.sm, borderWidth: 1, borderColor: PREMIUM.colors.border, color: PREMIUM.colors.textPrimary, paddingHorizontal: 12, height: 44, fontSize: 14, marginBottom: PREMIUM.spacing.md },
  modalList: { maxHeight: 350 },
  modalGameItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: PREMIUM.spacing.md, paddingHorizontal: PREMIUM.spacing.sm, borderBottomWidth: 1, borderBottomColor: PREMIUM.colors.border },
  modalGameInfo: { flex: 1, marginLeft: 10 },
  modalGameTitle: { color: PREMIUM.colors.textPrimary, fontSize: 14, fontWeight: '800' },
  modalGameFile: { color: PREMIUM.colors.textMuted, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  modalSelectArrow: { color: PREMIUM.colors.accent, fontSize: 14, marginLeft: 8 },
  modalEmpty: { padding: PREMIUM.spacing.xl, alignItems: 'center' },
  modalEmptyText: { color: PREMIUM.colors.textMuted, fontSize: 13 },
});
