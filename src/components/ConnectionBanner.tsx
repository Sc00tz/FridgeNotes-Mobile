import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Props {
  isOnline: boolean;
  queueSize?: number;
  isSyncing?: boolean;
}

/**
 * Thin banner that appears at the top when offline.
 * Shows queued operation count and syncing state.
 * Fades in on disconnect, briefly shows "Back online" then fades out.
 */
export const ConnectionBanner: React.FC<Props> = ({ isOnline, queueSize = 0, isSyncing = false }) => {
  const opacity = useRef(new Animated.Value(isOnline ? 0 : 1)).current;
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    if (prevOnline.current === isOnline) return;
    prevOnline.current = isOnline;

    if (!isOnline) {
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      }, 2000);
    }
  }, [isOnline, opacity]);

  const getMessage = () => {
    if (isOnline && isSyncing) return '↑ Syncing pending changes…';
    if (isOnline) return '✓ Back online';
    if (queueSize > 0) return `Offline · ${queueSize} change${queueSize !== 1 ? 's' : ''} queued`;
    return 'Offline · changes will sync when reconnected';
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        isOnline && !isSyncing ? styles.reconnected : styles.offline,
        { opacity },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{getMessage()}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 16,
    zIndex: 100,
    alignItems: 'center',
  },
  offline:     { backgroundColor: '#7f1d1d' },
  reconnected: { backgroundColor: '#14532d' },
  text: { color: '#fff', fontSize: 12, fontWeight: '500', textAlign: 'center' },
});
