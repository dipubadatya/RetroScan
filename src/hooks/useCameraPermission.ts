/**
 * useCameraPermission.ts
 *
 * Reusable hook for Android camera permission management.
 * Handles: GRANTED, DENIED (retryable), DENIED_FOREVER (open Settings).
 *
 * RULES:
 *  - Call this hook BEFORE the <Camera> component mounts, never inside it.
 *  - CLI only — no Expo. Uses PermissionsAndroid directly.
 *  - requestPermission() is idempotent: safe to call multiple times.
 */

import { useCallback, useEffect, useState } from 'react';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

export type CameraPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'denied_forever';

export interface UseCameraPermissionResult {
  permissionStatus: CameraPermissionStatus;
  hasPermission: boolean;
  isRequesting: boolean;
  requestPermission: () => Promise<CameraPermissionStatus>;
}

export function useCameraPermission(): UseCameraPermissionResult {
  const [permissionStatus, setPermissionStatus] =
    useState<CameraPermissionStatus>('undetermined');
  const [isRequesting, setIsRequesting] = useState(false);

  // Check current permission state on mount (no dialog)
  useEffect(() => {
    if (Platform.OS !== 'android') {
      setPermissionStatus('granted');
      return;
    }

    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
      .then(already => {
        setPermissionStatus(already ? 'granted' : 'undetermined');
      })
      .catch(() => {
        setPermissionStatus('undetermined');
      });
  }, []);

  const requestPermission =
    useCallback(async (): Promise<CameraPermissionStatus> => {
      if (Platform.OS !== 'android') {
        setPermissionStatus('granted');
        return 'granted';
      }

      // Permanently denied — open Settings instead of showing the dialog again
      if (permissionStatus === 'denied_forever') {
        await Linking.openSettings();
        return 'denied_forever';
      }

      setIsRequesting(true);
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission Required',
            message:
              'RetroScan needs camera access to scan your physical game cards.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
            buttonNeutral: 'Ask Later',
          },
        );

        let mapped: CameraPermissionStatus;
        switch (result) {
          case PermissionsAndroid.RESULTS.GRANTED:
            mapped = 'granted';
            break;
          case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
            mapped = 'denied_forever';
            break;
          default:
            mapped = 'denied';
        }

        setPermissionStatus(mapped);
        return mapped;
      } catch {
        setPermissionStatus('denied');
        return 'denied';
      } finally {
        setIsRequesting(false);
      }
    }, [permissionStatus]);

  return {
    permissionStatus,
    hasPermission: permissionStatus === 'granted',
    isRequesting,
    requestPermission,
  };
}
