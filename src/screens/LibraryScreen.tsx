import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConsoleBadge } from '../components/ConsoleBadge';
import { GameCard } from '../components/GameCard';
import { CONSOLE_IDS } from '../constants/consoles';
import { THEME } from '../constants/theme';
import { getAllGames } from '../services/database';
import { launchEmulator } from '../services/launcher';
import { ConsoleId, GameRecord, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export const LibraryScreen: React.FC<Props> = ({ navigation }) => {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [selectedConsole, setSelectedConsole] = useState<ConsoleId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Fetch games from SQLite
  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const records = await getAllGames(undefined, searchQuery);
      setGames(records);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadGames();
    });
    return unsubscribe;
  }, [navigation, loadGames]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // 2. Group them strictly by EXACT console name string using ===
  const grouped = useMemo(() => {
    return games.reduce((acc: Record<string, GameRecord[]>, game: GameRecord) => {
      const key = game.console; // Must exactly match 'PS2', 'PSP', etc.
      if (!acc[key]) acc[key] = [];
      acc[key].push(game);
      return acc;
    }, {});
  }, [games]);

  const sections = useMemo(() => {
    const allKeys = [
      ...CONSOLE_IDS.filter(id => !!grouped[id] && grouped[id].length > 0),
      ...Object.keys(grouped).filter(
        k => !CONSOLE_IDS.includes(k as ConsoleId) && grouped[k]?.length > 0
      ),
    ];

    const keys = allKeys.filter(key => {
      if (selectedConsole !== null) {
        return key === selectedConsole;
      }
      return true;
    });

    return keys.map(key => ({
      title: key,
      data: grouped[key] || [],
    }));
  }, [grouped, selectedConsole]);

  const handleGamePress = useCallback(
    (game: GameRecord) => {
      navigation.navigate('GameDetail', { gameId: game.id, game });
    },
    [navigation]
  );

  const handleLaunch = useCallback(async (game: GameRecord) => {
    const res = await launchEmulator(game);
    if (!res.success) {
      Alert.alert('Emulator Required', res.error || 'Could not start emulator.');
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: GameRecord }) => {
      return (
        <GameCard
          game={item}
          onPress={handleGamePress}
          onLaunch={handleLaunch}
        />
      );
    },
    [handleGamePress, handleLaunch]
  );

  const keyExtractor = useCallback((item: GameRecord) => item.id.toString(), []);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.titleContainer}>
          <Text style={styles.appName}>RETROSCAN</Text>
          <Text style={styles.appSub}>OFFLINE INDEXER</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Scanner')}
          >
            <Text style={styles.actionBtnText}>SCAN QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => navigation.navigate('FolderScanner')}
          >
            <Text style={styles.actionBtnPrimaryText}>+ ROMS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by title, serial, or QR..."
          placeholderTextColor={THEME.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...CONSOLE_IDS]}
          keyExtractor={item => item || 'ALL'}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isSelected = selectedConsole === item;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipSelected,
                ]}
                onPress={() =>
                  setSelectedConsole(selectedConsole === item ? null : item)
                }
              >
                {item ? (
                  <ConsoleBadge consoleId={item} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}
                  >
                    ALL ({games.length})
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <ConsoleBadge consoleId={title as ConsoleId} size="small" />
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        refreshing={loading}
        onRefresh={loadGames}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>NO ROMS INDEXED</Text>
            <Text style={styles.emptyBody}>
              Tap '+ ROMS' to select your local folder and index games offline.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  titleContainer: {
    justifyContent: 'center',
  },
  appName: {
    color: THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  appSub: {
    color: THEME.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  actionBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionBtnPrimary: {
    backgroundColor: THEME.colors.accent,
    borderColor: THEME.colors.accent,
  },
  actionBtnPrimaryText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  settingsBtn: {
    padding: 6,
    borderRadius: THEME.radius.sm,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  settingsIcon: {
    color: THEME.colors.textSecondary,
    fontSize: 15,
  },
  searchSection: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.sm,
  },
  searchInput: {
    height: 40,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: THEME.spacing.md,
    color: THEME.colors.textPrimary,
    fontSize: 13,
  },
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingVertical: 6,
  },
  filterList: {
    paddingHorizontal: THEME.spacing.lg,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipSelected: {
    borderColor: THEME.colors.accent,
    backgroundColor: '#141414',
  },
  filterChipText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: THEME.colors.accent,
  },
  emptyContainer: {
    padding: THEME.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: THEME.colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: THEME.spacing.sm,
  },
  emptyBody: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.xs,
    backgroundColor: THEME.colors.background,
  },
  sectionHeaderText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
