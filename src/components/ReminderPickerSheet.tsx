import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentReminder: string | null;
  onSet: (isoDateTime: string) => void;
  onClear: () => void;
}

// Quick-pick options — most reminders are one of these
const QUICK_PICKS: Array<{ label: string; offsetMinutes: number }> = [
  { label: 'In 30 minutes', offsetMinutes: 30 },
  { label: 'In 1 hour',     offsetMinutes: 60 },
  { label: 'In 3 hours',    offsetMinutes: 180 },
  { label: 'Tonight 8 pm',  offsetMinutes: -1 }, // special — see below
  { label: 'Tomorrow 9 am', offsetMinutes: -2 },
  { label: 'Tomorrow noon', offsetMinutes: -3 },
  { label: 'In 2 days',     offsetMinutes: 60 * 24 * 2 },
  { label: 'Next week',     offsetMinutes: 60 * 24 * 7 },
];

function resolveQuickPick(offsetMinutes: number): Date {
  const now = new Date();
  if (offsetMinutes >= 0) {
    return new Date(now.getTime() + offsetMinutes * 60 * 1000);
  }
  // Special cases
  const d = new Date(now);
  if (offsetMinutes === -1) { // Tonight 8 pm
    d.setHours(20, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1); // already past — push to tomorrow
    return d;
  }
  if (offsetMinutes === -2) { // Tomorrow 9 am
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  // Tomorrow noon
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatReminder(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ReminderPickerSheet: React.FC<Props> = ({
  visible,
  onClose,
  currentReminder,
  onSet,
  onClear,
}) => {
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
          <Text style={styles.title}>Set Reminder</Text>
          {currentReminder && (
            <TouchableOpacity onPress={onClear}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Current reminder display */}
        {currentReminder && (
          <View style={styles.currentRow}>
            <Text style={styles.currentLabel}>Current:</Text>
            <Text style={styles.currentValue}>{formatReminder(currentReminder)}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick pick</Text>

        <ScrollView contentContainerStyle={styles.picks}>
          {QUICK_PICKS.map(pick => {
            const target = resolveQuickPick(pick.offsetMinutes);
            return (
              <TouchableOpacity
                key={pick.label}
                style={styles.pickButton}
                onPress={() => {
                  onSet(target.toISOString());
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.pickLabel}>{pick.label}</Text>
                <Text style={styles.pickTime}>
                  {target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {target.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#f9fafb' },
  clearButton: { fontSize: 15, color: '#ef4444', fontWeight: '600' },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#374151',
    paddingVertical: 10,
  },
  currentLabel: { fontSize: 13, color: '#9ca3af' },
  currentValue: { fontSize: 13, color: '#60a5fa', fontWeight: '500', flex: 1 },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  picks: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 8,
  },
  pickButton: {
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickLabel: { color: '#f9fafb', fontSize: 15, fontWeight: '500' },
  pickTime: { color: '#9ca3af', fontSize: 12 },
  doneButton: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  doneText: { color: '#f9fafb', fontSize: 16, fontWeight: '600' },
});
