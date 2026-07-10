import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../lib/api';
import { Attachment } from '../types';
import { VoiceMemo } from './VoiceMemo';
import { AudioAttachment } from './AudioAttachment';

/**
 * Attachments (images + voice memos) for a note. Self-contained: seeds from the
 * note's attachments and refreshes from the server after add/delete.
 *
 * Uploads are only possible once the note has a real server id (offline-created
 * notes carry a client_id string until they sync).
 */
interface Props {
  noteId: number | string;
  attachments: Attachment[];
  textColor: string;
  borderColor: string;
}

export const AttachmentSection: React.FC<Props> = ({
  noteId,
  attachments,
  textColor,
  borderColor,
}) => {
  const [items, setItems] = useState<Attachment[]>(attachments);
  const [busy, setBusy] = useState(false);
  const [imageSources, setImageSources] = useState<Record<number, { uri: string; headers: Record<string, string> }>>({});

  useEffect(() => { setItems(attachments); }, [attachments]);

  // Attachments are behind session auth; resolve authenticated sources for images.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<number, { uri: string; headers: Record<string, string> }> = {};
      for (const a of items) {
        if (a.attachment_type === 'image') {
          next[a.id] = await apiClient.getAttachmentSource(noteId, a.id);
        }
      }
      if (!cancelled) setImageSources(next);
    })();
    return () => { cancelled = true; };
  }, [items, noteId]);

  const noteSaved = typeof noteId === 'number' || (!String(noteId).startsWith('cid_') && !String(noteId).startsWith('temp_'));

  const refresh = useCallback(async () => {
    try {
      const list = await apiClient.listAttachments(noteId);
      if (Array.isArray(list)) setItems(list);
    } catch { /* keep current */ }
  }, [noteId]);

  const uploadFile = useCallback(async (file: { uri: string; name: string; type: string }) => {
    setBusy(true);
    try {
      await apiClient.uploadAttachment(noteId, file);
      await refresh();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload the file');
    } finally {
      setBusy(false);
    }
  }, [noteId, refresh]);

  const pickImage = useCallback(async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Please allow ${fromCamera ? 'camera' : 'photo'} access.`);
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const name = asset.fileName || `image-${Date.now()}.jpg`;
    const type = asset.mimeType || 'image/jpeg';
    await uploadFile({ uri: asset.uri, name, type });
  }, [uploadFile]);

  const handleDelete = useCallback((attachmentId: number) => {
    Alert.alert('Remove attachment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.deleteAttachment(noteId, attachmentId);
            await refresh();
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message ?? 'Could not remove the attachment');
          }
        },
      },
    ]);
  }, [noteId, refresh]);

  return (
    <View style={styles.container}>
      {items.length > 0 && (
        <View style={styles.grid}>
          {items.map(a => (
            <View key={a.id} style={styles.itemWrap}>
              {a.attachment_type === 'image' ? (
                imageSources[a.id] ? (
                  <Image source={imageSources[a.id]} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={[styles.image, styles.imageLoading, { borderColor }]}>
                    <ActivityIndicator size="small" color={textColor + '80'} />
                  </View>
                )
              ) : (
                <AudioAttachment noteId={noteId} attachment={a} textColor={textColor} borderColor={borderColor} />
              )}
              <TouchableOpacity
                onPress={() => handleDelete(a.id)}
                style={styles.deleteBadge}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteBadgeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {noteSaved ? (
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => pickImage(false)} style={[styles.actionBtn, { borderColor }]} disabled={busy}>
            <Text style={[styles.actionText, { color: textColor }]}>🖼  Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => pickImage(true)} style={[styles.actionBtn, { borderColor }]} disabled={busy}>
            <Text style={[styles.actionText, { color: textColor }]}>📷  Camera</Text>
          </TouchableOpacity>
          <VoiceMemo onRecorded={uploadFile} textColor={textColor} borderColor={borderColor} disabled={busy} />
        </View>
      ) : (
        <Text style={[styles.hint, { color: textColor + '80' }]}>
          Attachments can be added once the note has synced.
        </Text>
      )}
      {busy && <ActivityIndicator size="small" color={textColor + '80'} style={{ marginTop: 8 }} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  itemWrap: { position: 'relative' },
  image: { width: 100, height: 100, borderRadius: 8 },
  imageLoading: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  deleteBadge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 11,
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
  },
  deleteBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  actionText: { fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 13, fontStyle: 'italic' },
});
