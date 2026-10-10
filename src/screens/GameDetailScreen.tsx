import React, { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConsoleBadge } from '../components/ConsoleBadge';
import { Header } from '../components/Header';
import { QRCodeCard } from '../components/QRCodeCard';
import { EmulatorConfig, PS2_BOOT_MODE_OPTIONS } from '../constants/emulators';
import { THEME } from '../constants/theme';
import { deleteGame, getGameById } from '../services/database';
import { getActiveEmulator, launchEmulator } from '../services/launcher';
import { GameRecord, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'GameDetail'>;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const GameDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { gameId, game: initialGame } = route.params;
  const [game, setGame] = useState<GameRecord | null>(initialGame || null);
  const [activeConfig, setActiveConfig] = useState<EmulatorConfig | null>(null);

  useEffect(() => {
    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  useEffect(() => {
    if (!game) {
      (async () => {
        try {
          const record = await getGameById(Number(gameId));
          if (record) {
            setGame(record);
          }
        } catch (err) {
          console.warn('Failed to load game by id:', err);
        }
      })();
    }
  }, [gameId, game]);

  useEffect(() => {
    if (game) {
      getActiveEmulator(game.console).then(setActiveConfig);
    }
  }, [game]);

  if (!game) {
    return (
      <View style={styles.container}>
        <Header title="GAME DETAILS" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading game record...</Text>
        </View>
      </View>
    );
  }

  const emulatorPackage = activeConfig?.packageName || 'Auto-detect';
  const emulatorName = activeConfig?.name || game.console;

  const handleLaunch = async () => {
    const res = await launchEmulator(game);
    if (!res.success) {
      if (res.notInstalled) {
        Alert.alert(
          'Emulator Missing',
          res.error || `Please install an emulator for ${game.console}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Configure in Settings',
              onPress: () => navigation.navigate('Settings'),
            },
          ]
        );
      } else {
        Alert.alert('Launch Error', res.error || 'Could not start emulator.');
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove from Library',
      'Remove this game record from the offline index? The ROM file will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteGame(game.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="GAME DETAILS"
        subtitle={game.console}
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: '🗑',
          onPress: handleDelete,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleSection}>
          <ConsoleBadge consoleId={game.console} size="medium" />
          <Text style={styles.gameTitle}>{game.title}</Text>
        </View>

        <QRCodeCard game={game} />

        <TouchableOpacity style={styles.launchBtn} onPress={handleLaunch}>
          <Text style={styles.launchBtnIcon}>▶</Text>
          <Text style={styles.launchBtnText}>
            LAUNCH IN {emulatorName.toUpperCase()}
          </Text>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <Text style={styles.sectionHeader}>TECHNICAL IDENTITY</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>STRATEGY LEVEL</Text>
            <Text style={styles.infoValue}>
              {game.id_type === 'S' || game.identityType === 'S'
                ? 'Level 1: Serial'
                : game.id_type === 'H' || game.identityType === 'H'
                  ? 'Level 2: CRC'
                  : 'Level 3: Name'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SERIAL</Text>
            <Text style={[styles.infoValue, styles.monoValue]}>
              {game.serial || '—'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CRC</Text>
            <Text style={[styles.infoValue, styles.monoValue]}>
              {game.crc || '—'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>QR PAYLOAD</Text>
            <Text style={[styles.infoValue, styles.monoValue]}>
              {game.game_key || game.qrPayload}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>VALUE</Text>
            <Text style={[styles.infoValue, styles.monoValue]}>
              {game.id_value || game.identityValue}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>FILE SIZE</Text>
            <Text style={styles.infoValue}>{formatBytes(game.fileSize)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>TARGET PACKAGE</Text>
            <Text style={[styles.infoValue, styles.monoValue]}>
              {emulatorPackage}
            </Text>
          </View>

          {game.console === 'PS2' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>PS2 LAUNCH MODE</Text>
              <Text style={[styles.infoValue, { color: THEME.colors.accent }]}>
                {PS2_BOOT_MODE_OPTIONS.find(o => o.id === activeConfig?.ps2BootMode)?.name || 'Auto (Library Root)'}
              </Text>
            </View>
          )}

          {(activeConfig?.preferredCore || emulatorPackage.includes('retroarch')) && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>LIBRETRO CORE</Text>
              <Text style={[styles.infoValue, { color: THEME.colors.accent }]}>
                {activeConfig?.preferredCore
                  ? activeConfig.preferredCore.replace('_libretro_android.so', '')
                  : 'Auto Multi-Core Fallback'}
              </Text>
            </View>
          )}

          <View style={styles.infoRowStacked}>
            <Text style={styles.infoLabel}>STORAGE PATH</Text>
            <Text style={styles.pathValue} selectable>
              {game.filePath}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.configBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.configBtnText}>⚙ CONFIGURE EMULATOR & CORES</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  scrollContent: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
  },
  gameTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: THEME.spacing.sm,
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.accentGreen,
    height: 50,
    borderRadius: THEME.radius.md,
    marginTop: THEME.spacing.lg,
    marginBottom: THEME.spacing.xl,
    gap: 8,
  },
  launchBtnIcon: {
    color: '#000000',
    fontSize: 16,
  },
  launchBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  infoSection: {
    backgroundColor: '#090909',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.lg,
  },
  sectionHeader: {
    color: THEME.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: THEME.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  infoRowStacked: {
    paddingVertical: 8,
  },
  infoLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  infoValue: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  monoValue: {
    fontFamily: 'monospace',
    color: THEME.colors.accent,
  },
  pathValue: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
    backgroundColor: '#000000',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#191919',
  },
  configBtn: {
    marginTop: 14,
    backgroundColor: '#0F1820',
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configBtnText: {
    color: THEME.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
