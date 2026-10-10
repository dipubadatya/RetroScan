import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import IntentLauncher from 'react-native-intent-launcher';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConsoleBadge } from '../components/ConsoleBadge';
import { Header } from '../components/Header';
import { CONSOLE_IDS } from '../constants/consoles';
import {
  CONSOLE_EMULATOR_OPTIONS,
  DEFAULT_EMULATORS,
  EmulatorConfig,
  RETROARCH_CORE_OPTIONS,
  PS2_BOOT_MODE_OPTIONS,
} from '../constants/emulators';
import { THEME } from '../constants/theme';
import {
  clearAllGames,
  getCustomEmulatorSettings,
  getLibraryStats,
  resetEmulatorSetting,
  saveEmulatorSetting,
} from '../services/database';
import { getActiveEmulator, isPackageInstalled, resolveInstalledPackageName } from '../services/launcher';
import { ConsoleId, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [stats, setStats] = useState<{
    total: number;
    byConsole: Record<string, number>;
  }>({ total: 0, byConsole: {} });

  const [activeEmulators, setActiveEmulators] = useState<
    Record<ConsoleId, EmulatorConfig>
  >({} as any);

  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});

  // Modal State
  const [editingConsole, setEditingConsole] = useState<ConsoleId | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [selectedPreferredCore, setSelectedPreferredCore] = useState<string>('');
  const [selectedPs2BootMode, setSelectedPs2BootMode] = useState<string>('auto');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customPackage, setCustomPackage] = useState<string>('');
  const [customClass, setCustomClass] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const s = await getLibraryStats();
      setStats(s);

      const activeMap: Record<ConsoleId, EmulatorConfig> = {} as any;
      const packageChecks: Record<string, boolean> = {};

      for (const id of CONSOLE_IDS) {
        const emulator = await getActiveEmulator(id);
        activeMap[id] = emulator;

        // Check active emulator package
        if (emulator.packageName && packageChecks[emulator.packageName] === undefined) {
          packageChecks[emulator.packageName] = await isPackageInstalled(
            emulator.packageName
          );
        }

        // Also pre-check all presets for this console
        const presets = CONSOLE_EMULATOR_OPTIONS[id] || [];
        for (const p of presets) {
          if (packageChecks[p.packageName] === undefined) {
            packageChecks[p.packageName] = await isPackageInstalled(p.packageName);
          }
        }
      }

      setActiveEmulators(activeMap);
      setInstalledMap(packageChecks);
    } catch (err) {
      console.warn('Error loading settings data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openConfigModal = (consoleId: ConsoleId) => {
    const current = activeEmulators[consoleId] || DEFAULT_EMULATORS[consoleId];
    setEditingConsole(consoleId);
    setSelectedPreferredCore(current.preferredCore || '');
    setSelectedPs2BootMode(current.ps2BootMode || 'auto');

    const presets = CONSOLE_EMULATOR_OPTIONS[consoleId] || [];
    const matchedPreset = presets.find(
      p => p.packageName.toLowerCase() === current.packageName.toLowerCase()
    );

    if (matchedPreset) {
      setIsCustomMode(false);
      setSelectedOptionId(matchedPreset.id);
      setCustomName('');
      setCustomPackage('');
      setCustomClass('');
    } else {
      setIsCustomMode(true);
      setSelectedOptionId('custom');
      setCustomName(current.name || '');
      setCustomPackage(current.packageName || '');
      setCustomClass(current.className || '');
    }
  };

  const handleSelectPreset = (preset: EmulatorConfig) => {
    setSelectedOptionId(preset.id);
    setIsCustomMode(false);
  };

  const handleSelectCustom = () => {
    setSelectedOptionId('custom');
    setIsCustomMode(true);
    if (!customName && editingConsole) {
      setCustomName(`${editingConsole} Emulator`);
    }
  };

  const handleSaveModal = async () => {
    if (!editingConsole) return;

    if (isCustomMode) {
      const trimmedPkg = customPackage.trim();
      const trimmedName = customName.trim() || `${editingConsole} Emulator`;
      if (!trimmedPkg) {
        Alert.alert('Package Name Required', 'Please enter a valid Android package name (e.g. xyz.nethersx2.android).');
        return;
      }

      const customConfig: EmulatorConfig = {
        id: `custom_${editingConsole.toLowerCase()}`,
        name: trimmedName,
        packageName: trimmedPkg,
        className: customClass.trim() || undefined,
        action: 'android.intent.action.MAIN',
        category: 'android.intent.category.LAUNCHER',
        extraKey: 'bootPath',
        useFileUri: false,
        preferredCore: selectedPreferredCore || undefined,
        ps2BootMode: editingConsole === 'PS2' ? (selectedPs2BootMode as any) : undefined,
      };

      await saveEmulatorSetting(editingConsole, customConfig);
    } else {
      const presets = CONSOLE_EMULATOR_OPTIONS[editingConsole] || [];
      const preset = presets.find(p => p.id === selectedOptionId);
      if (preset) {
        const resolvedPkg = (await resolveInstalledPackageName(preset.packageName)) || preset.packageName;
        await saveEmulatorSetting(editingConsole, {
          ...preset,
          packageName: resolvedPkg,
          preferredCore: selectedPreferredCore || undefined,
          ps2BootMode: editingConsole === 'PS2' ? (selectedPs2BootMode as any) : undefined,
        });
      }
    }

    setEditingConsole(null);
    await loadData();
  };

  const handleResetToDefault = async () => {
    if (!editingConsole) return;
    await resetEmulatorSetting(editingConsole);
    setSelectedPreferredCore('');
    setSelectedPs2BootMode('auto');
    setEditingConsole(null);
    await loadData();
  };

  const handleTestLaunch = async (pkg: string, name: string) => {
    if (!pkg) return;
    try {
      const actualPkg = (await resolveInstalledPackageName(pkg)) || pkg;
      await IntentLauncher.startAppByPackageName(actualPkg);
    } catch {
      Alert.alert(
        'App Not Found',
        `${name} (${pkg}) does not seem to be installed on this device.`
      );
    }
  };

  const handleWipeDatabase = () => {
    Alert.alert(
      'Wipe Offline Database',
      'Are you sure you want to delete all indexed game records? Your local ROM files will not be touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Database',
          style: 'destructive',
          onPress: async () => {
            await clearAllGames();
            await loadData();
            Alert.alert('Database Cleared', 'Library index is now empty.');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="SETTINGS & EMULATORS"
        subtitle="Console Launcher Configuration"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* STATS CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LIBRARY INDEX STATS</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Indexed ROMs</Text>
            <Text style={styles.statNumber}>{stats.total}</Text>
          </View>

          <View style={styles.consoleGrid}>
            {CONSOLE_IDS.map(id => (
              <View key={id} style={styles.gridItem}>
                <ConsoleBadge consoleId={id} size="small" />
                <Text style={styles.gridCount}>
                  {stats.byConsole[id] || 0}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* EMULATOR SETTINGS PER CONSOLE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONSOLE EMULATOR ASSIGNMENTS</Text>
          <Text style={styles.cardDesc}>
            Tap any console to select from recommended emulators (e.g. AetherSX2, NetherSX2, PPSSPP, DuckStation) or enter a custom package name.
          </Text>

          {CONSOLE_IDS.map(id => {
            const current = activeEmulators[id] || DEFAULT_EMULATORS[id];
            const isInstalled = !!installedMap[current?.packageName];

            return (
              <View key={id} style={styles.consoleRow}>
                <View style={styles.consoleLeft}>
                  <ConsoleBadge consoleId={id} size="small" />
                  <View style={styles.consoleInfo}>
                    <View style={styles.emulatorNameRow}>
                      <Text style={styles.emulatorName}>{current.name}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isInstalled ? styles.statusBadgeOk : styles.statusBadgeMissing,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            isInstalled ? styles.statusTextOk : styles.statusTextMissing,
                          ]}
                        >
                          {isInstalled ? '● Installed' : '○ Not Installed'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.emulatorPkg} numberOfLines={1}>
                      {current.packageName}
                    </Text>
                    {id === 'PS2' && (
                      <Text style={styles.activeDetailText}>
                        Mode: {PS2_BOOT_MODE_OPTIONS.find(o => o.id === current.ps2BootMode)?.name || 'Auto (Library Root)'}
                      </Text>
                    )}
                    {current.preferredCore ? (
                      <Text style={styles.activeDetailText}>
                        Core: {current.preferredCore.replace('_libretro_android.so', '')}
                      </Text>
                    ) : (current.packageName.includes('retroarch') || CONSOLE_EMULATOR_OPTIONS[id]?.some(p => p.packageName.includes('retroarch'))) ? (
                      <Text style={styles.activeDetailTextMuted}>
                        Core: Auto Fallback
                      </Text>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.changeBtn}
                  onPress={() => openConfigModal(id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeBtnText}>CHANGE</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* OFFLINE BATTERY RULES */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BATTERY & OFFLINE ARCHITECTURE</Text>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBullet}>✓</Text>
            <Text style={styles.ruleText}>
              Vision Camera capped at 5 FPS; unmounted outside scanner.
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBullet}>✓</Text>
            <Text style={styles.ruleText}>
              Strict direct component intents; zero generic file picker popups.
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBullet}>✓</Text>
            <Text style={styles.ruleText}>
              First 2MB binary header inspection only.
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBullet}>✓</Text>
            <Text style={styles.ruleText}>
              Chunked 10-file batches with SQLite transaction writes.
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleBullet}>✓</Text>
            <Text style={styles.ruleText}>
              True black OLED theme; zero background services or wake locks.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.wipeBtn} onPress={handleWipeDatabase}>
          <Text style={styles.wipeBtnText}>WIPE LIBRARY DATABASE</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL FOR EMULATOR SELECTION */}
      <Modal
        visible={editingConsole !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingConsole(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                {editingConsole && <ConsoleBadge consoleId={editingConsole} size="small" />}
                <Text style={styles.modalTitle}>
                  {editingConsole} EMULATOR
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditingConsole(null)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.sectionLabel}>PRESET EMULATORS</Text>

              {editingConsole &&
                (CONSOLE_EMULATOR_OPTIONS[editingConsole] || []).map(preset => {
                  const isInstalled = !!installedMap[preset.packageName];
                  const isSelected = !isCustomMode && selectedOptionId === preset.id;

                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => handleSelectPreset(preset)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.optionHeader}>
                        <View style={styles.radioOuter}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.optionTitle}>{preset.name}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            isInstalled ? styles.statusBadgeOk : styles.statusBadgeMissing,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              isInstalled ? styles.statusTextOk : styles.statusTextMissing,
                            ]}
                          >
                            {isInstalled ? 'Installed' : 'Missing'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.optionPkg}>{preset.packageName}</Text>

                      {isInstalled && (
                        <TouchableOpacity
                          style={styles.testBtn}
                          onPress={() => handleTestLaunch(preset.packageName, preset.name)}
                        >
                          <Text style={styles.testBtnText}>TEST OPEN</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}

              {/* PS2 LAUNCH MODE & GAME DIRECTORY TREE (Only when editing PS2) */}
              {editingConsole === 'PS2' && (
                <View style={styles.modalSubSection}>
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                    PS2 LAUNCH MODE (SAF TREE)
                  </Text>
                  <Text style={styles.sectionSublabel}>
                    Matches the folder you selected in AetherSX2 / NetherSX2 so direct boot works without opening game menu.
                  </Text>

                  {PS2_BOOT_MODE_OPTIONS.map(opt => {
                    const isSelected = selectedPs2BootMode === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.subOptionCard, isSelected && styles.optionCardSelected]}
                        onPress={() => setSelectedPs2BootMode(opt.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.optionHeader}>
                          <View style={styles.radioOuter}>
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <Text style={styles.optionTitle}>{opt.name}</Text>
                        </View>
                        <Text style={styles.optionSubDesc}>{opt.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* RETROARCH CORE SELECTION (When RetroArch is selected or console supports it) */}
              {editingConsole && RETROARCH_CORE_OPTIONS[editingConsole] && (
                <View style={styles.modalSubSection}>
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                    RETROARCH CORE (FALLBACK SYSTEM)
                  </Text>
                  <Text style={styles.sectionSublabel}>
                    Multiple cores are supported with automatic fallback. If your preferred core is missing, RetroScan will run with available cores.
                  </Text>

                  <TouchableOpacity
                    style={[styles.subOptionCard, !selectedPreferredCore && styles.optionCardSelected]}
                    onPress={() => setSelectedPreferredCore('')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionHeader}>
                      <View style={styles.radioOuter}>
                        {!selectedPreferredCore && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.optionTitle}>Auto (Smart Multi-Core Fallback)</Text>
                      <View style={[styles.statusBadge, styles.statusBadgeOk]}>
                        <Text style={[styles.statusText, styles.statusTextOk]}>Recommended</Text>
                      </View>
                    </View>
                    <Text style={styles.optionSubDesc}>
                      Automatically detects downloaded cores on device and falls back gracefully.
                    </Text>
                  </TouchableOpacity>

                  {RETROARCH_CORE_OPTIONS[editingConsole].map(core => {
                    const isSelected = selectedPreferredCore === core.id;
                    return (
                      <TouchableOpacity
                        key={core.id}
                        style={[styles.subOptionCard, isSelected && styles.optionCardSelected]}
                        onPress={() => setSelectedPreferredCore(core.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.optionHeader}>
                          <View style={styles.radioOuter}>
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <Text style={styles.optionTitle}>{core.name}</Text>
                          {core.isRecommended && (
                            <View style={[styles.statusBadge, styles.statusBadgeOk]}>
                              <Text style={[styles.statusText, styles.statusTextOk]}>Best</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.optionPkg}>{core.id}</Text>
                        <Text style={styles.optionSubDesc}>{core.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                CUSTOM PACKAGE (FORK / MOD)
              </Text>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  isCustomMode && styles.optionCardSelected,
                ]}
                onPress={handleSelectCustom}
                activeOpacity={0.8}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.radioOuter}>
                    {isCustomMode && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.optionTitle}>Custom Package Name</Text>
                </View>
                <Text style={styles.optionPkg}>
                  Specify any installed emulator (e.g. NetherSX2, ARMSX2)
                </Text>

                {isCustomMode && (
                  <View style={styles.customForm}>
                    <Text style={styles.inputLabel}>EMULATOR DISPLAY NAME</Text>
                    <TextInput
                      style={styles.input}
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder="e.g. NetherSX2"
                      placeholderTextColor={THEME.colors.textMuted}
                    />

                    <Text style={styles.inputLabel}>PACKAGE ID (REQUIRED)</Text>
                    <TextInput
                      style={styles.input}
                      value={customPackage}
                      onChangeText={setCustomPackage}
                      placeholder="e.g. xyz.nethersx2.android"
                      placeholderTextColor={THEME.colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <Text style={styles.inputLabel}>ACTIVITY CLASS (OPTIONAL)</Text>
                    <TextInput
                      style={styles.input}
                      value={customClass}
                      onChangeText={setCustomClass}
                      placeholder="e.g. xyz.nethersx2.android.MainActivity"
                      placeholderTextColor={THEME.colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={handleResetToDefault}
              >
                <Text style={styles.resetBtnText}>DEFAULT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveModal}
              >
                <Text style={styles.saveBtnText}>SAVE SELECTION</Text>
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.lg,
  },
  cardTitle: {
    color: THEME.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: THEME.spacing.sm,
  },
  cardDesc: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: THEME.spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: THEME.spacing.md,
  },
  statLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
  statNumber: {
    color: THEME.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  consoleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  gridCount: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  consoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  consoleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  consoleInfo: {
    flex: 1,
  },
  emulatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  emulatorName: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  statusBadgeOk: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  statusBadgeMissing: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusTextOk: {
    color: THEME.colors.accentGreen,
  },
  statusTextMissing: {
    color: THEME.colors.textMuted,
  },
  emulatorPkg: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  changeBtn: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  changeBtnText: {
    color: THEME.colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  ruleBullet: {
    color: THEME.colors.accentGreen,
    fontSize: 12,
    fontWeight: '800',
  },
  ruleText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  wipeBtn: {
    backgroundColor: '#190000',
    borderWidth: 1,
    borderColor: THEME.colors.accentRed,
    height: 46,
    borderRadius: THEME.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  wipeBtnText: {
    color: THEME.colors.accentRed,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: THEME.radius.lg,
    borderTopRightRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    maxHeight: '85%',
    padding: THEME.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    color: THEME.colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  modalScroll: {
    maxHeight: 400,
  },
  sectionLabel: {
    color: THEME.colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  optionCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderRadius: THEME.radius.sm,
    padding: 12,
    marginBottom: 8,
  },
  optionCardSelected: {
    borderColor: THEME.colors.accent,
    backgroundColor: '#051218',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.accent,
  },
  optionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  optionPkg: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
    marginLeft: 24,
  },
  modalSubSection: {
    marginTop: 12,
  },
  sectionSublabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  subOptionCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#202020',
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
  },
  optionSubDesc: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    marginLeft: 24,
    lineHeight: 14,
  },
  activeDetailText: {
    color: THEME.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  activeDetailTextMuted: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  testBtn: {
    alignSelf: 'flex-start',
    marginLeft: 24,
    marginTop: 8,
    backgroundColor: '#122212',
    borderWidth: 1,
    borderColor: THEME.colors.accentGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  testBtnText: {
    color: THEME.colors.accentGreen,
    fontSize: 9,
    fontWeight: '800',
  },
  customForm: {
    marginTop: 12,
    marginLeft: 24,
  },
  inputLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    borderRadius: 4,
    color: THEME.colors.textPrimary,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  resetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: 4,
    backgroundColor: THEME.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
