import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Note, ChecklistItem } from '../types';
import { getColor } from './ColorPicker';
import { LabelBadges } from './LabelBadge';

interface Props {
  note: Note;
  onPress: () => void;
  onUpdate: (data: Partial<Note>) => Promise<any>;
  onDelete: () => void;
  onChecklistItemUpdate: (
    itemId: number | string,
    data: { completed?: boolean },
  ) => Promise<void>;
  onPinToggle: (pinned: boolean) => Promise<void>;
}

export const NoteCard: React.FC<Props> = ({
  note,
  onPress,
  onUpdate,
  onDelete,
  onChecklistItemUpdate,
  onPinToggle,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const colors = getColor(note.color);

  const activeItems = note.checklist_items?.filter(i => !i.completed) ?? [];
  const completedItems = note.checklist_items?.filter(i => i.completed) ?? [];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}
      onPress={onPress}
      onLongPress={() => setShowMenu(v => !v)}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        {note.title ? (
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {note.title}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() => setShowMenu(v => !v)}
          style={styles.menuButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.menuDots, { color: colors.text + '99' }]}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Context menu */}
      {showMenu && (
        <View style={[styles.menu, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {[
            {
              label: 'Edit',
              color: colors.text,
              onPress: () => { setShowMenu(false); onPress(); },
            },
            {
              label: note.pinned ? 'Unpin' : 'Pin',
              color: colors.text,
              onPress: () => { onPinToggle(!note.pinned); setShowMenu(false); },
            },
            {
              label: note.archived ? 'Unarchive' : 'Archive',
              color: colors.text,
              onPress: () => { onUpdate({ archived: !note.archived }); setShowMenu(false); },
            },
            {
              label: 'Delete',
              color: '#ef4444',
              onPress: () => { onDelete(); setShowMenu(false); },
            },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
              <Text style={[styles.menuItemText, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Text note body */}
      {note.note_type === 'text' && note.content ? (
        <Text style={[styles.content, { color: colors.text }]} numberOfLines={6}>
          {note.content}
        </Text>
      ) : null}

      {/* Checklist preview */}
      {note.note_type === 'checklist' && (
        <View style={styles.checklistPreview}>
          {note.checklist_items?.length > 0 && (
            <Text style={[styles.progress, { color: colors.text + '99' }]}>
              {completedItems.length} / {note.checklist_items.length}
            </Text>
          )}
          {activeItems.slice(0, 5).map(item => (
            <ChecklistRow
              key={String(item.id)}
              item={item}
              colors={colors}
              onToggle={() => onChecklistItemUpdate(item.id, { completed: true })}
            />
          ))}
          {activeItems.length > 5 && (
            <Text style={[styles.moreItems, { color: colors.text + '70' }]}>
              +{activeItems.length - 5} more items
            </Text>
          )}
        </View>
      )}

      {/* Labels */}
      {note.labels?.length > 0 && (
        <LabelBadges labels={note.labels} maxVisible={3} />
      )}

      {/* Reminder badge */}
      {note.reminder_datetime && !note.reminder_completed && (
        <View style={[styles.reminderRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.reminderText, { color: colors.text + '99' }]}>
            {'⏰ '}
            {new Date(note.reminder_datetime).toLocaleString([], {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.date, { color: colors.text + '60' }]}>
          {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : ''}
        </Text>
        <View style={styles.footerBadges}>
          {note.pinned && <Text style={styles.badge}>📌</Text>}
          {note.is_shared && <Text style={styles.badge}>👥</Text>}
          {note.attachments && note.attachments.length > 0 && <Text style={styles.badge}>📎</Text>}
          {note.reminder_latitude != null && <Text style={styles.badge}>📍</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface ChecklistRowProps {
  item: ChecklistItem;
  colors: { text: string; border: string };
  onToggle: () => void;
}

const ChecklistRow: React.FC<ChecklistRowProps> = ({ item, colors, onToggle }) => (
  <TouchableOpacity
    style={styles.checklistRow}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle();
    }}
    activeOpacity={0.7}
  >
    <View style={[styles.checkbox, { borderColor: colors.text + '80' }]} />
    <Text style={[styles.checklistText, { color: colors.text }]} numberOfLines={1}>
      {item.text}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
    lineHeight: 20,
  },
  menuButton: {
    paddingLeft: 6,
  },
  menuDots: {
    fontSize: 18,
  },
  menu: {
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 14,
  },
  content: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  checklistPreview: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  progress: {
    fontSize: 11,
    marginBottom: 4,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 8,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  checklistText: {
    fontSize: 13,
    flex: 1,
  },
  moreItems: {
    fontSize: 12,
    marginTop: 2,
  },
  reminderRow: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderTopWidth: 1,
  },
  reminderText: {
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  date: {
    fontSize: 10,
  },
  footerBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    fontSize: 11,
  },
});
