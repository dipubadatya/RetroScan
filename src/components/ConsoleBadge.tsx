import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CONSOLE_CONFIG } from '../constants/consoles';
import { ConsoleId } from '../types';

interface ConsoleBadgeProps {
  consoleId: ConsoleId;
  size?: 'small' | 'medium';
}

export const ConsoleBadge: React.FC<ConsoleBadgeProps> = React.memo(
  ({ consoleId, size = 'small' }) => {
    const meta = CONSOLE_CONFIG[consoleId];
    const isSmall = size === 'small';

    return (
      <View
        style={[
          styles.container,
          { borderColor: meta?.color || '#555555' },
          isSmall ? styles.containerSmall : styles.containerMedium,
        ]}
      >
        <View
          style={[
            styles.dot,
            { backgroundColor: meta?.color || '#555555' },
          ]}
        />
        <Text
          style={[
            styles.text,
            isSmall ? styles.textSmall : styles.textMedium,
          ]}
        >
          {consoleId}
        </Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: '#080808',
  },
  containerSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  containerMedium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 12,
  },
});
