// Ensure TextEncoder is always polyfilled before react-native-qrcode-svg executes
if (typeof (global as any).TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding');
  (global as any).TextEncoder = TextEncoder;
  (global as any).TextDecoder = TextDecoder;
}

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import { THEME } from '../constants/theme';
import { GameRecord } from '../types';

interface QRCodeCardProps {
  game: GameRecord;
}

export const QRCodeCard: React.FC<QRCodeCardProps> = React.memo(({ game }) => {
  const viewShotRef = useRef<ViewShot>(null);
  const [saving, setSaving] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 33) {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    }
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  };

  const handleSaveToGallery = async () => {
    if (!viewShotRef.current) return;
    setSaving(true);

    try {
      const hasPerm = await requestStoragePermission();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Storage permission required to save QR.');
        setSaving(false);
        return;
      }

      const uri = await viewShotRef.current.capture!();
      await CameraRoll.save(uri, { type: 'photo', album: 'RetroScan' });
      Alert.alert('Saved to Gallery', 'Physical Game Card sticker saved successfully!');
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not export QR code image.');
    } finally {
      setSaving(false);
    }
  };

  const payloadValue =
    game.qrPayload ||
    game.game_key ||
    `${game.console}:${game.id_type || 'N'}:${game.id_value || game.title || game.name}` ||
    'RETROSCAN';

  return (
    <View style={styles.wrapper}>
      {/* THIS IS THE ONLY AREA THAT GETS DOWNLOADED FOR YOUR PHYSICAL CARD */}
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', quality: 1.0 }}
        style={styles.physicalStickerContainer}
      >
        {/* White QR Code Section */}
        <View style={styles.qrBox} collapsable={false}>
          {qrError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>QR ERROR</Text>
            </View>
          ) : (
            <QRCode
              value={payloadValue}
              size={220}
              color="#000000"
              backgroundColor="#FFFFFF"
              quietZone={10}
              onError={(err: any) => {
                console.warn('QRCode generation failed:', err);
                setQrError(err?.message || 'Error');
              }}
            />
          )}
        </View>

        {/* Solid Black "SCAN TO PLAY" Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerText}>SCAN TO PLAY</Text>
        </View>
      </ViewShot>

      {/* App Export Button (Not included in the saved image) */}
      <TouchableOpacity
        style={styles.exportButton}
        activeOpacity={0.8}
        onPress={handleSaveToGallery}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <Text style={styles.exportButtonText}>Export Sticker to Gallery</Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  // Exact Physical Sticker Layout
  physicalStickerContainer: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden', // Clips the bottom banner flush to the border
  },
  qrBox: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    width: '100%',
    backgroundColor: '#000000',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  errorBox: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#D32F2F',
    fontWeight: '800',
  },
  // Export Action Button inside the App
  exportButton: {
    marginTop: 20,
    backgroundColor: THEME?.colors?.accent || '#FFB800',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});