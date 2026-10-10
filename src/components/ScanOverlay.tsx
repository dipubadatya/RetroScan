import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { THEME } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_SIZE = 260;

export const ScanOverlay: React.FC = React.memo(() => {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={styles.topMask} />
      <View style={styles.middleRow}>
        <View style={styles.sideMask} />
        <View style={styles.box}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          <View style={styles.laser} />
        </View>
        <View style={styles.sideMask} />
      </View>
      <View style={styles.bottomMask} />
    </View>
  );
});

const styles = StyleSheet.create({
  topMask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  middleRow: {
    height: SCAN_SIZE,
    flexDirection: 'row',
  },
  sideMask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  box: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomMask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: THEME.colors.accent,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  laser: {
    width: SCAN_SIZE - 20,
    height: 2,
    backgroundColor: THEME.colors.accentGreen,
    shadowColor: THEME.colors.accentGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
});
