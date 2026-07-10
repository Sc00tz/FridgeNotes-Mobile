import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { apiClient } from '../lib/api';
import { Attachment } from '../types';

/**
 * Plays back an audio attachment. The file is behind session auth, so the
 * source is resolved to an authenticated { uri, headers } before playing.
 */
interface Props {
  noteId: number | string;
  attachment: Attachment;
  textColor: string;
  borderColor: string;
}

export const AudioAttachment: React.FC<Props> = ({ noteId, attachment, textColor, borderColor }) => {
  const [source, setSource] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  // useAudioPlayer accepts null until the source resolves.
  const player = useAudioPlayer(source);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.getAttachmentSource(noteId, attachment.id).then(src => {
      if (!cancelled) setSource(src);
    });
    return () => { cancelled = true; };
  }, [noteId, attachment.id]);

  const toggle = () => {
    if (!source) return;
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.seekTo(0);
      player.play();
      setPlaying(true);
    }
  };

  return (
    <View style={[styles.container, { borderColor }]}>
      <TouchableOpacity onPress={toggle} disabled={!source} style={styles.playBtn}>
        <Text style={[styles.icon, { color: textColor }]}>{playing ? '⏸' : '▶️'}</Text>
      </TouchableOpacity>
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {attachment.filename || 'Voice memo'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10,
    width: 100, height: 100, justifyContent: 'center', gap: 4,
  },
  playBtn: { padding: 4 },
  icon: { fontSize: 20 },
  label: { fontSize: 10, textAlign: 'center' },
});
