import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../constants/theme';
import { GameRecord } from '../types';
import { ConsoleBadge } from './ConsoleBadge';

export const GAME_CARD_HEIGHT = 88;

interface GameCardProps {
  game: GameRecord;
  onPress: (game: GameRecord) => void;
  onLaunch: (game: GameRecord) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const GameCard: React.FC<GameCardProps> = React.memo(
  ({ game, onPress, onLaunch }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => onPress(game)}
      >
        <View style={styles.leftColumn}>
          <View style={styles.topRow}>
            <ConsoleBadge consoleId={game.console} size="small" />
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{game.identityType}</Text>
            </View>
            <Text style={styles.identityValue} numberOfLines={1}>
              {game.identityValue}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {game.title}
          </Text>
          <Text style={styles.sizeText}>{formatBytes(game.fileSize)}</Text>
        </View>

        <TouchableOpacity
          style={styles.launchButton}
          activeOpacity={0.6}
          onPress={() => onLaunch(game)}
        >
          <Text style={styles.launchIcon}>▶</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  card: {
    height: GAME_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.lg,
  },
  leftColumn: {
    flex: 1,
    justifyContent: 'center',
    marginRight: THEME.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: '#1E1E1E',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
    marginRight: 6,
  },
  typeText: {
    color: THEME.colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  identityValue: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  sizeText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  launchButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchIcon: {
    color: THEME.colors.accentGreen,
    fontSize: 14,
    marginLeft: 2,
  },
});
