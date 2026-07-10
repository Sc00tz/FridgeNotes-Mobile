import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';

/**
 * Records a voice memo via expo-audio and hands the resulting file to onRecorded
 * for upload. Uses the HIGH_QUALITY preset (produces .m4a on both platforms,
 * which the server's audio allowlist accepts).
 */
interface Props {
  onRecorded: (file: { uri: string; name: string; type: string }) => Promise<void> | void;
  textColor: string;
  borderColor: string;
  disabled?: boolean;
}

export const VoiceMemo: React.FC<Props> = ({ onRecorded, textColor, borderColor, disabled }) => {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);

  // Best-effort: leave recording mode on unmount if still active.
  useEffect(() => () => {
    if (recorder.isRecording) {
      recorder.stop().catch(() => {});
    }
  }, [recorder]);

  const start = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow microphone access to record a memo.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e: any) {
      Alert.alert('Recording failed', e?.message ?? 'Could not start recording');
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri;
      if (uri) {
        await onRecorded({ uri, name: `voice-memo-${Date.now()}.m4a`, type: 'audio/mp4' });
      }
    } catch (e: any) {
      setRecording(false);
      Alert.alert('Recording failed', e?.message ?? 'Could not save the recording');
    }
  };

  return (
    <TouchableOpacity
      onPress={recording ? stop : start}
      style={[styles.btn, { borderColor: recording ? '#dc2626' : borderColor }]}
      disabled={disabled}
    >
      <Text style={[styles.text, { color: recording ? '#dc2626' : textColor }]}>
        {recording ? '⏹  Stop' : '🎤  Memo'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  text: { fontSize: 14, fontWeight: '500' },
});
