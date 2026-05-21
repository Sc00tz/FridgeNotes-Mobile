import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Note, ChecklistItem, Label } from '../types';
import { ColorPicker, getColor } from '../components/ColorPicker';
import { ChecklistItemAutocomplete } from '../components/ChecklistItemAutocomplete';
import { LabelPickerSheet } from '../components/LabelPickerSheet';
import { ShareSheet } from '../components/ShareSheet';
import { ReminderPickerSheet } from '../components/ReminderPickerSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'NoteEditor'> & {
  note: Note;
  onUpdate: (noteId: number | string, data: Partial<Note>) => Promise<any>;
  onDelete: (noteId: number | string) => Promise<any>;
  onUpdateChecklistItem: (
    noteId: number | string,
    itemId: number | string,
    data: { completed?: boolean; text?: string },
  ) => Promise<void>;
  userSuggestions?: string[];
  onAddAutocompleteItem?: (text: string) => void;
  // Labels
  allLabels?: Label[];
  onAddLabel?: (noteId: number | string, labelId: number) => Promise<void>;
  onRemoveLabel?: (noteId: number | string, labelId: number) => Promise<void>;
  onCreateLabel?: (name: string, color: string) => Promise<Label>;
  // Sharing
  onShare?: (noteId: number | string, username: string, access: 'read' | 'edit') => Promise<void>;
  onUnshare?: (noteId: number | string, shareId: number) => Promise<void>;
  onGetShares?: (noteId: number | string) => Promise<any[]>;
  shareLoading?: boolean;
  // Reminders
  onSetReminder?: (noteId: number | string, isoDateTime: string) => Promise<void>;
  onClearReminder?: (noteId: number | string) => Promise<void>;
};

let tempIdCounter = 0;
const newTempId = () => `temp_${Date.now()}_${++tempIdCounter}`;

const AUTO_SAVE_DELAY = 1500; // ms after last keystroke before auto-saving

export const NoteEditorScreen: React.FC<Props> = ({
  navigation,
  note,
  onUpdate,
  onDelete,
  onUpdateChecklistItem,
  userSuggestions = [],
  onAddAutocompleteItem,
  allLabels = [],
  onAddLabel,
  onRemoveLabel,
  onCreateLabel,
  onShare,
  onUnshare,
  onGetShares,
  shareLoading = false,
  onSetReminder,
  onClearReminder,
}) => {
  const [title, setTitle] = useState(note.title ?? '');
  const [content, setContent] = useState(note.content ?? '');
  const [color, setColor] = useState(note.color ?? 'default');
  const [items, setItems] = useState<ChecklistItem[]>(note.checklist_items ?? []);
  const [newItemText, setNewItemText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newItemRef = useRef<TextInput>(null);
  const colors = getColor(color);

  // Cancel the auto-save timer when the screen unmounts
  useEffect(() => () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  }, []);

  const save = useCallback(async (
    overrides: Partial<{ title: string; content: string; color: string; items: ChecklistItem[] }> = {},
  ) => {
    const t = overrides.title ?? title;
    const c = overrides.content ?? content;
    const col = overrides.color ?? color;
    const it = overrides.items ?? items;

    try {
      setIsSaving(true);
      await onUpdate(note.id, {
        title: t,
        color: col,
        ...(note.note_type === 'text'
          ? { content: c }
          : { checklist_items: it }),
      });
      setLastSaved(new Date());
    } catch {
      // Error surfaced by useNotes
    } finally {
      setIsSaving(false);
    }
  }, [note.id, note.note_type, title, content, color, items, onUpdate]);

  // Schedule an auto-save whenever editable fields change
  const scheduleAutoSave = useCallback((
    overrides: Partial<{ title: string; content: string; color: string; items: ChecklistItem[] }> = {},
  ) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => save(overrides), AUTO_SAVE_DELAY);
  }, [save]);

  const handleTitleChange = (t: string) => {
    setTitle(t);
    scheduleAutoSave({ title: t });
  };

  const handleContentChange = (c: string) => {
    setContent(c);
    scheduleAutoSave({ content: c });
  };

  const handleColorChange = (col: string) => {
    setColor(col);
    save({ color: col }); // Color change saves immediately
  };

  const handleBack = () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      save(); // Flush any pending auto-save
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    Alert.alert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
          await onDelete(note.id);
          navigation.goBack();
        },
      },
    ]);
  };

  // Checklist helpers
  const handleToggleItem = (itemId: number | string, completed: boolean) => {
    Haptics.impactAsync(
      completed
        ? Haptics.ImpactFeedbackStyle.Medium  // checking off — satisfying thud
        : Haptics.ImpactFeedbackStyle.Light,  // unchecking — lighter
    );
    const updated = items.map(i => i.id === itemId ? { ...i, completed } : i);
    setItems(updated);
    onUpdateChecklistItem(note.id, itemId, { completed });
  };

  const handleItemTextChange = (itemId: number | string, text: string) => {
    const updated = items.map(i => i.id === itemId ? { ...i, text } : i);
    setItems(updated);
    scheduleAutoSave({ items: updated });
  };

  const handleAddItem = () => {
    const text = newItemText.trim();
    if (!text) return;

    const newItem: ChecklistItem = {
      id: newTempId(),
      note_id: typeof note.id === 'number' ? note.id : 0,
      text,
      completed: false,
      order: items.length,
      category: null,
      created_at: new Date().toISOString(),
    };

    const updated = [...items, newItem];
    setItems(updated);
    setNewItemText('');

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddAutocompleteItem?.(text);

    // Save immediately so the server creates the item
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    save({ items: updated });

    setTimeout(() => newItemRef.current?.focus(), 50);
  };

  const handleRemoveItem = (itemId: number | string) => {
    const updated = items.filter(i => i.id !== itemId);
    setItems(updated);
    scheduleAutoSave({ items: updated });
  };

  const activeItems = items.filter(i => !i.completed);
  const completedItems = items.filter(i => i.completed);

  const saveStatusText = isSaving
    ? 'Saving…'
    : lastSaved
    ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.toolbarButton}>
          <Text style={[styles.backText, { color: colors.text }]}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.saveStatus}>
          {isSaving
            ? <ActivityIndicator size="small" color={colors.text + '80'} />
            : <Text style={[styles.saveStatusText, { color: colors.text + '60' }]}>
                {saveStatusText}
              </Text>
          }
        </View>

        <View style={styles.toolbarActions}>
          <TouchableOpacity
            onPress={() => setShowColorPicker(v => !v)}
            style={styles.toolbarButton}
          >
            <Text style={styles.toolbarIcon}>🎨</Text>
          </TouchableOpacity>
          {onAddLabel && (
            <TouchableOpacity
              onPress={() => setShowLabelPicker(true)}
              style={styles.toolbarButton}
            >
              <Text style={styles.toolbarIcon}>🏷️</Text>
            </TouchableOpacity>
          )}
          {onShare && (
            <TouchableOpacity
              onPress={() => setShowShareSheet(true)}
              style={styles.toolbarButton}
            >
              <Text style={styles.toolbarIcon}>👥</Text>
            </TouchableOpacity>
          )}
          {onSetReminder && (
            <TouchableOpacity
              onPress={() => setShowReminderPicker(true)}
              style={styles.toolbarButton}
            >
              <Text style={[styles.toolbarIcon, note.reminder_datetime && !note.reminder_completed && { opacity: 1 }]}>
                {note.reminder_datetime && !note.reminder_completed ? '⏰' : '🔔'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDelete} style={styles.toolbarButton}>
            <Text style={styles.toolbarIcon}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Color picker (collapsible) */}
      {showColorPicker && (
        <View style={[styles.colorPickerRow, { borderBottomColor: colors.border }]}>
          <ColorPicker currentColor={color} onColorChange={handleColorChange} />
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <TextInput
            style={[styles.titleInput, { color: colors.text }]}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Title"
            placeholderTextColor={colors.text + '40'}
            returnKeyType="next"
          />

          {/* Body */}
          {note.note_type === 'text' ? (
            <TextInput
              style={[styles.contentInput, { color: colors.text }]}
              value={content}
              onChangeText={handleContentChange}
              placeholder="Start writing…"
              placeholderTextColor={colors.text + '30'}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.checklist}>
              {/* Active items */}
              {activeItems.map(item => (
                <EditorChecklistRow
                  key={String(item.id)}
                  item={item}
                  colors={colors}
                  onToggle={() => handleToggleItem(item.id, true)}
                  onTextChange={text => handleItemTextChange(item.id, text)}
                  onRemove={() => handleRemoveItem(item.id)}
                />
              ))}

              {/* New item input with autocomplete */}
              <View style={styles.addItemRow}>
                <View style={[styles.checkboxDashed, { borderColor: colors.text + '40' }]} />
                <ChecklistItemAutocomplete
                  value={newItemText}
                  onChange={setNewItemText}
                  onSelect={handleAddItem}
                  placeholder="Add item…"
                  userSuggestions={userSuggestions}
                  textColor={colors.text}
                  borderColor={colors.border}
                  backgroundColor={colors.background}
                />
              </View>

              {/* Completed items */}
              {completedItems.length > 0 && (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <Text style={[styles.completedLabel, { color: colors.text + '60' }]}>
                    {completedItems.length} completed
                  </Text>
                  {completedItems.map(item => (
                    <EditorChecklistRow
                      key={String(item.id)}
                      item={item}
                      colors={colors}
                      completed
                      onToggle={() => handleToggleItem(item.id, false)}
                      onTextChange={text => handleItemTextChange(item.id, text)}
                      onRemove={() => handleRemoveItem(item.id)}
                    />
                  ))}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Label picker sheet */}
      {onAddLabel && onRemoveLabel && onCreateLabel && (
        <LabelPickerSheet
          visible={showLabelPicker}
          onClose={() => setShowLabelPicker(false)}
          note={note}
          allLabels={allLabels}
          onAddLabel={onAddLabel}
          onRemoveLabel={onRemoveLabel}
          onCreateLabel={onCreateLabel}
        />
      )}

      {/* Share sheet */}
      {onShare && onUnshare && onGetShares && (
        <ShareSheet
          visible={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          note={note}
          onShare={onShare}
          onUnshare={onUnshare}
          onGetShares={onGetShares}
          shareLoading={shareLoading}
        />
      )}

      {/* Reminder picker sheet */}
      {onSetReminder && onClearReminder && (
        <ReminderPickerSheet
          visible={showReminderPicker}
          onClose={() => setShowReminderPicker(false)}
          currentReminder={note.reminder_datetime}
          onSet={async (iso) => {
            await onSetReminder(note.id, iso);
          }}
          onClear={async () => {
            await onClearReminder(note.id);
          }}
        />
      )}
    </SafeAreaView>
  );
};

interface EditorRowProps {
  item: ChecklistItem;
  colors: { background: string; border: string; text: string };
  onToggle: () => void;
  onTextChange: (text: string) => void;
  onRemove: () => void;
  completed?: boolean;
}

const EditorChecklistRow: React.FC<EditorRowProps> = ({
  item, colors, onToggle, onTextChange, onRemove, completed,
}) => (
  <View style={styles.editorRow}>
    <TouchableOpacity
      onPress={onToggle}
      style={[
        styles.checkbox,
        { borderColor: colors.text + '80' },
        completed && { backgroundColor: colors.text + '25' },
      ]}
    >
      {completed && <Text style={[styles.checkmark, { color: colors.text }]}>✓</Text>}
    </TouchableOpacity>
    <TextInput
      style={[
        styles.editorItemInput,
        { color: colors.text },
        completed && styles.strikethrough,
      ]}
      value={item.text}
      onChangeText={onTextChange}
      placeholderTextColor={colors.text + '40'}
    />
    <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={[styles.removeIcon, { color: colors.text + '50' }]}>✕</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolbarButton: { padding: 8 },
  backText: { fontSize: 17, fontWeight: '500' },
  saveStatus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  saveStatusText: { fontSize: 12 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center' },
  toolbarIcon: { fontSize: 20, padding: 6 },
  colorPickerRow: { borderBottomWidth: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
    padding: 0,
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
    padding: 0,
  },
  checklist: { gap: 4 },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmark: { fontSize: 13, fontWeight: '700' },
  editorItemInput: { flex: 1, fontSize: 16, padding: 0 },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.5 },
  removeIcon: { fontSize: 15 },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
    zIndex: 10,
  },
  checkboxDashed: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexShrink: 0,
  },
  divider: { height: 1, marginVertical: 14 },
  completedLabel: { fontSize: 12, marginBottom: 6 },
});
