import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareReceiver'> & {
  onCreateNote: (data: { title: string; content: string; note_type: 'text' }) => Promise<any>;
};

export const ShareReceiverScreen: React.FC<Props> = ({ route, navigation, onCreateNote }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(route.params.text);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onCreateNote({ title, content, note_type: 'text' });
      navigation.goBack();
    } catch {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Save as Note</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !content.trim()}
            style={[styles.saveButton, (!content.trim() || saving) && styles.saveButtonDisabled]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            placeholderTextColor="#6b7280"
            returnKeyType="next"
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="Content"
            placeholderTextColor="#6b7280"
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  cancelButton: { padding: 4 },
  cancelText: { fontSize: 16, color: '#9ca3af' },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  body: {
    padding: 16,
    flexGrow: 1,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f9fafb',
    padding: 0,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#1f2937',
    marginBottom: 12,
  },
  contentInput: {
    fontSize: 16,
    color: '#f9fafb',
    padding: 0,
    lineHeight: 24,
    minHeight: 200,
  },
});
