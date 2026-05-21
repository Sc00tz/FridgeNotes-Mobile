import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Note } from '../types';

interface Share {
  id: number;
  note_id: number;
  user_id: number;
  access_level: 'read' | 'edit';
  shared_at: string;
  user: { id: number; username: string } | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  note: Note;
  onShare: (noteId: number | string, username: string, access: 'read' | 'edit') => Promise<void>;
  onUnshare: (noteId: number | string, shareId: number) => Promise<void>;
  onGetShares: (noteId: number | string) => Promise<Share[]>;
  shareLoading: boolean;
}

export const ShareSheet: React.FC<Props> = ({
  visible,
  onClose,
  note,
  onShare,
  onUnshare,
  onGetShares,
  shareLoading,
}) => {
  const [username, setUsername] = useState('');
  const [accessLevel, setAccessLevel] = useState<'read' | 'edit'>('edit');
  const [shares, setShares] = useState<Share[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingShares(true);
    onGetShares(note.id).then(data => {
      setShares(data);
    }).finally(() => setLoadingShares(false));
  }, [visible, note.id]);

  const handleShare = async () => {
    if (!username.trim()) return;
    try {
      setSubmitting(true);
      await onShare(note.id, username.trim(), accessLevel);
      setUsername('');
      // Reload shares list
      const fresh = await onGetShares(note.id);
      setShares(fresh);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to share note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnshare = (share: Share) => {
    Alert.alert(
      'Remove access',
      `Remove ${share.user?.username ?? 'this user'}'s access?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await onUnshare(note.id, share.id);
            setShares(prev => prev.filter(s => s.id !== share.id));
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>Share note</Text>

        {/* Username input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username to share with"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleShare}
          />
        </View>

        {/* Access level toggle */}
        <View style={styles.accessRow}>
          <Text style={styles.accessLabel}>Access:</Text>
          <TouchableOpacity
            style={[styles.accessButton, accessLevel === 'read' && styles.accessButtonActive]}
            onPress={() => setAccessLevel('read')}
          >
            <Text style={[styles.accessText, accessLevel === 'read' && styles.accessTextActive]}>
              View only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.accessButton, accessLevel === 'edit' && styles.accessButtonActive]}
            onPress={() => setAccessLevel('edit')}
          >
            <Text style={[styles.accessText, accessLevel === 'edit' && styles.accessTextActive]}>
              Can edit
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.shareButton, (!username.trim() || submitting) && styles.disabled]}
          onPress={handleShare}
          disabled={!username.trim() || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.shareButtonText}>Share</Text>
          }
        </TouchableOpacity>

        {/* Current shares */}
        <Text style={styles.sectionTitle}>Shared with</Text>

        {loadingShares
          ? <ActivityIndicator color="#60a5fa" style={{ marginVertical: 20 }} />
          : (
            <FlatList
              data={shares}
              keyExtractor={s => String(s.id)}
              style={styles.list}
              renderItem={({ item: share }) => (
                <View style={styles.shareRow}>
                  <View style={styles.shareAvatar}>
                    <Text style={styles.shareAvatarText}>
                      {(share.user?.username?.[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.shareInfo}>
                    <Text style={styles.shareUsername}>
                      {share.user?.username ?? 'Unknown'}
                    </Text>
                    <Text style={styles.shareAccess}>
                      {share.access_level === 'edit' ? 'Can edit' : 'View only'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleUnshare(share)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>Not shared with anyone yet</Text>
              }
            />
          )
        }

        <TouchableOpacity style={styles.doneButton} onPress={onClose}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4b5563',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f9fafb',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  inputRow: { paddingHorizontal: 20, marginBottom: 12 },
  input: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  accessLabel: { color: '#9ca3af', fontSize: 14, marginRight: 4 },
  accessButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  accessButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  accessText: { color: '#9ca3af', fontSize: 14 },
  accessTextActive: { color: '#fff', fontWeight: '600' },
  shareButton: {
    marginHorizontal: 20,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabled: { opacity: 0.5 },
  shareButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: { flexGrow: 0, maxHeight: 200 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  shareAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  shareInfo: { flex: 1 },
  shareUsername: { color: '#f9fafb', fontSize: 15, fontWeight: '500' },
  shareAccess: { color: '#9ca3af', fontSize: 12, marginTop: 1 },
  removeButton: { padding: 6 },
  removeText: { color: '#ef4444', fontSize: 14 },
  empty: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  doneButton: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  doneText: { color: '#f9fafb', fontSize: 16, fontWeight: '600' },
});
