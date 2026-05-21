import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Label, Note } from '../types';

// Simple colour palette for creating new labels
const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  note: Note;
  allLabels: Label[];
  onAddLabel: (noteId: number | string, labelId: number) => Promise<void>;
  onRemoveLabel: (noteId: number | string, labelId: number) => Promise<void>;
  onCreateLabel: (name: string, color: string) => Promise<Label>;
}

export const LabelPickerSheet: React.FC<Props> = ({
  visible,
  onClose,
  note,
  allLabels,
  onAddLabel,
  onRemoveLabel,
  onCreateLabel,
}) => {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[4]);
  const [saving, setSaving] = useState(false);

  const appliedIds = new Set(note.labels?.map(l => l.id) ?? []);

  const filtered = allLabels.filter(l =>
    l.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (label: Label) => {
    try {
      if (appliedIds.has(label.id)) {
        await onRemoveLabel(note.id, label.id);
      } else {
        await onAddLabel(note.id, label.id);
      }
    } catch {}
  };

  const handleCreate = async () => {
    if (!newLabelName.trim()) return;
    try {
      setSaving(true);
      await onCreateLabel(newLabelName.trim(), newLabelColor);
      setNewLabelName('');
      setCreating(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create label');
    } finally {
      setSaving(false);
    }
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

        <View style={styles.header}>
          <Text style={styles.title}>Labels</Text>
          <TouchableOpacity onPress={() => setCreating(v => !v)}>
            <Text style={styles.newLabelButton}>{creating ? 'Cancel' : '+ New'}</Text>
          </TouchableOpacity>
        </View>

        {/* Create new label inline */}
        {creating && (
          <View style={styles.createRow}>
            <TextInput
              style={styles.createInput}
              value={newLabelName}
              onChangeText={setNewLabelName}
              placeholder="Label name"
              placeholderTextColor="#6b7280"
              autoFocus
            />
            <View style={styles.colorRow}>
              {LABEL_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setNewLabelColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    c === newLabelColor && styles.colorDotSelected,
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity
              style={[styles.createButton, saving && styles.disabled]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.createButtonText}>Create</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Search */}
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search labels…"
          placeholderTextColor="#6b7280"
          clearButtonMode="while-editing"
        />

        {/* Label list */}
        <FlatList
          data={filtered}
          keyExtractor={l => String(l.id)}
          style={styles.list}
          renderItem={({ item: label }) => {
            const applied = appliedIds.has(label.id);
            return (
              <TouchableOpacity
                style={styles.labelRow}
                onPress={() => handleToggle(label)}
                activeOpacity={0.7}
              >
                <View style={[styles.labelDot, { backgroundColor: label.color }]} />
                <Text style={styles.labelName} numberOfLines={1}>{label.display_name}</Text>
                <View style={[
                  styles.checkbox,
                  applied && { backgroundColor: label.color, borderColor: label.color },
                ]}>
                  {applied && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {search ? 'No labels match' : 'No labels yet — create one above'}
            </Text>
          }
        />

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
    maxHeight: '70%',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#f9fafb' },
  newLabelButton: { fontSize: 15, color: '#60a5fa', fontWeight: '600' },
  createRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  createInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#f9fafb',
    transform: [{ scale: 1.15 }],
  },
  createButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  search: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  list: { flexGrow: 0 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  labelDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    flexShrink: 0,
  },
  labelName: {
    flex: 1,
    fontSize: 15,
    color: '#f9fafb',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
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
