import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  isOnline: boolean;
  queueSize: number;
  isSyncing: boolean;
  syncError: string | null;
  onForceSync: () => void;
}

/**
 * Persistent status bar shown at the bottom of NotesScreen when there
 * are queued operations or a sync error. Hidden when online and queue is empty.
 */
export const OfflineStatusBar: React.FC<Props> = ({
  isOnline,
  queueSize,
  isSyncing,
  syncError,
  onForceSync,
}) => {
  // Nothing to show when fully up-to-date
  if (isOnline && queueSize === 0 && !isSyncing && !syncError) return null;

  return (
    <View style={[styles.bar, !isOnline && styles.barOffline]}>
      <View style={styles.left}>
        {isSyncing && <ActivityIndicator size="small" color="#60a5fa" style={styles.spinner} />}
        <Text style={styles.text}>
          {isSyncing
            ? 'Syncing…'
            : !isOnline
            ? `Offline${queueSize > 0 ? ` · ${queueSize} pending` : ''}`
            : syncError
            ? syncError
            : queueSize > 0
            ? `${queueSize} change${queueSize !== 1 ? 's' : ''} to sync`
            : ''}
        </Text>
      </View>

      {isOnline && queueSize > 0 && !isSyncing && (
        <TouchableOpacity style={styles.syncButton} onPress={onForceSync}>
          <Text style={styles.syncButtonText}>Sync now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  barOffline: {
    backgroundColor: '#7f1d1d33',
    borderTopColor: '#7f1d1d',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  spinner: { marginRight: 8 },
  text: {
    color: '#9ca3af',
    fontSize: 12,
  },
  syncButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
