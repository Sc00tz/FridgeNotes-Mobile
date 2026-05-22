import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentReminder: string | null;
  onSet: (isoDateTime: string) => void;
  onClear: () => void;
}

const QUICK_PICKS: Array<{ label: string; resolve: () => Date }> = [
  { label: 'In 30 minutes',  resolve: () => new Date(Date.now() + 30 * 60 * 1000) },
  { label: 'In 1 hour',      resolve: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: 'In 3 hours',     resolve: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
  { label: 'Tonight 8 pm',   resolve: () => { const d = new Date(); d.setHours(20, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return d; } },
  { label: 'Tomorrow 9 am',  resolve: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  { label: 'Tomorrow noon',  resolve: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; } },
  { label: 'In 2 days',      resolve: () => { const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(9, 0, 0, 0); return d; } },
  { label: 'Next week',      resolve: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d; } },
];

// Format as local datetime string with no timezone — matches web app behaviour.
// The backend stores and compares these as local time.
function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function formatReminder(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const ReminderPickerSheet: React.FC<Props> = ({
  visible,
  onClose,
  currentReminder,
  onSet,
  onClear,
}) => {
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  const handleQuickPick = (date: Date) => {
    onSet(toLocalISOString(date));
    onClose();
  };

  const handleDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // iOS keeps picker open
    if (selected) setCustomDate(prev => {
      const d = new Date(selected);
      d.setHours(prev.getHours(), prev.getMinutes());
      return d;
    });
  };

  const handleTimeChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selected) setCustomDate(prev => {
      const d = new Date(prev);
      d.setHours(selected.getHours(), selected.getMinutes());
      return d;
    });
  };

  const handleSetCustom = () => {
    onSet(toLocalISOString(customDate));
    setCustomMode(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Set Reminder</Text>
          {currentReminder && (
            <TouchableOpacity onPress={() => { onClear(); onClose(); }}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {currentReminder && (
          <View style={styles.currentRow}>
            <Text style={styles.currentLabel}>Current: </Text>
            <Text style={styles.currentValue}>{formatReminder(currentReminder)}</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Custom date/time section */}
          <TouchableOpacity
            style={styles.customToggle}
            onPress={() => setCustomMode(v => !v)}
          >
            <Text style={styles.sectionTitle}>
              {customMode ? '▾  Custom date & time' : '▸  Custom date & time'}
            </Text>
          </TouchableOpacity>

          {customMode && (
            <View style={styles.customSection}>
              {/* Date picker row */}
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => { setShowDatePicker(true); setShowTimePicker(false); }}
              >
                <Text style={styles.pickerLabel}>Date</Text>
                <Text style={styles.pickerValue}>
                  {customDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {/* Time picker row */}
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => { setShowTimePicker(true); setShowDatePicker(false); }}
              >
                <Text style={styles.pickerLabel}>Time</Text>
                <Text style={styles.pickerValue}>
                  {customDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>

              {/* Native pickers — rendered inline on iOS, as dialog on Android */}
              {showDatePicker && (
                <DateTimePicker
                  value={customDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                  themeVariant="dark"
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={customDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleTimeChange}
                  themeVariant="dark"
                />
              )}

              <TouchableOpacity style={styles.setButton} onPress={handleSetCustom}>
                <Text style={styles.setButtonText}>
                  Set for {customDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick picks */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Quick pick</Text>
          {QUICK_PICKS.map(pick => {
            const target = pick.resolve();
            return (
              <TouchableOpacity
                key={pick.label}
                style={styles.pickButton}
                onPress={() => handleQuickPick(target)}
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#4b5563',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#374151',
    marginBottom: 4,
  },
  currentLabel: { fontSize: 13, color: '#9ca3af' },
  currentValue: { fontSize: 13, color: '#60a5fa', fontWeight: '500', flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  customToggle: { paddingVertical: 4 },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  customSection: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerLabel: { color: '#9ca3af', fontSize: 14 },
  pickerValue: { color: '#f9fafb', fontSize: 14, fontWeight: '500' },
  setButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  setButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
