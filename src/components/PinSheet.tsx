import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { apiClient } from '../lib/api';
import { Note } from '../types';

/**
 * PIN modal for private notes. Modes:
 *  - 'setup':  create the first PIN (requires account password)
 *  - 'unlock': enter the PIN to reveal a note (calls onUnlocked(fullNote))
 *  - 'change': change the PIN (requires current PIN)
 */
interface Props {
  visible: boolean;
  mode: 'setup' | 'unlock' | 'change' | 'makePrivate';
  noteId?: number | string;
  onClose: () => void;
  onUnlocked?: (note: Note) => void;
  onPinSet?: () => void;
  onMakePrivate?: () => void;
}

const validPin = (p: string) => /^\d{4,12}$/.test(p);

export const PinSheet: React.FC<Props> = ({ visible, mode, noteId, onClose, onUnlocked, onPinSet, onMakePrivate }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [password, setPassword] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // For 'makePrivate': whether a PIN already exists. null = still checking.
  const [hasPin, setHasPin] = useState<boolean | null>(null);

  useEffect(() => {
    if (visible) {
      setPin(''); setConfirmPin(''); setPassword(''); setCurrentPin(''); setError(null); setBusy(false);
      setHasPin(null);
      // For makePrivate, check whether a PIN exists so we know whether to prompt
      // setup or just confirm. Timeout-protected, and any failure defaults to
      // "set up a PIN" so the sheet is always actionable.
      if (mode === 'makePrivate') {
        apiClient.getPrivatePinStatus()
          .then(s => setHasPin(!!s.has_private_pin))
          .catch(() => setHasPin(false));
      }
    }
  }, [visible, mode]);

  // 'makePrivate' with an existing PIN needs no new PIN entry — just confirm.
  const makePrivateConfirmed = mode === 'makePrivate' && hasPin === true;
  // 'makePrivate' with no PIN behaves like first-time setup.
  const isSetup = mode === 'setup' || (mode === 'makePrivate' && hasPin === false);

  const submit = async () => {
    setError(null);
    if (mode === 'unlock') {
      if (!pin) return setError('Enter your PIN');
      setBusy(true);
      try {
        const note = await apiClient.unlockNote(noteId!, pin);
        onUnlocked?.(note);
        onClose();
      } catch (e: any) {
        setError(e?.message === 'Incorrect PIN' ? 'Incorrect PIN' : (e?.message || 'Failed to unlock'));
      } finally { setBusy(false); }
      return;
    }
    if (makePrivateConfirmed) {
      // PIN already set — just mark the note private.
      onMakePrivate?.();
      onClose();
      return;
    }
    if (!validPin(pin)) return setError('PIN must be 4-12 digits');
    if (pin !== confirmPin) return setError('PINs do not match');
    if (isSetup && !password) return setError('Enter your account password');
    if (mode === 'change' && !currentPin) return setError('Enter your current PIN');
    setBusy(true);
    try {
      const body: any = { new_pin: pin };
      if (isSetup) body.password = password;
      if (mode === 'change') body.current_pin = currentPin;
      await apiClient.setPrivatePin(body);
      (mode === 'makePrivate' ? onMakePrivate : onPinSet)?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to set PIN');
    } finally { setBusy(false); }
  };

  const title = mode === 'unlock' ? 'Enter PIN'
    : mode === 'change' ? 'Change PIN'
    : makePrivateConfirmed ? 'Make private'
    : 'Set a PIN';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>🔒 {title}</Text>

          {mode === 'makePrivate' && hasPin === null ? (
            // Still checking whether a PIN exists.
            <ActivityIndicator size="small" color="#9ca3af" style={{ paddingVertical: 12 }} />
          ) : makePrivateConfirmed ? (
            <Text style={styles.info}>This note will require your PIN to view. Continue?</Text>
          ) : (
            <>
              {isSetup && (
                <Text style={styles.info}>Choose a PIN to protect your private notes.</Text>
              )}
              {mode === 'change' && (
                <TextInput style={styles.input} placeholder="Current PIN" placeholderTextColor="#6b7280"
                  secureTextEntry keyboardType="number-pad" value={currentPin} onChangeText={setCurrentPin} />
              )}
              <TextInput style={styles.input} placeholder={mode === 'unlock' ? 'PIN' : 'New PIN (4-12 digits)'}
                placeholderTextColor="#6b7280" secureTextEntry keyboardType="number-pad" autoFocus
                value={pin} onChangeText={setPin} />
              {mode !== 'unlock' && (
                <TextInput style={styles.input} placeholder="Confirm PIN" placeholderTextColor="#6b7280"
                  secureTextEntry keyboardType="number-pad" value={confirmPin} onChangeText={setConfirmPin} />
              )}
              {isSetup && (
                <TextInput style={styles.input} placeholder="Account password" placeholderTextColor="#6b7280"
                  secureTextEntry value={password} onChangeText={setPassword} />
              )}
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={submit}
              disabled={busy || (mode === 'makePrivate' && hasPin === null)}>
              {busy ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.primaryText}>{mode === 'unlock' ? 'Unlock' : makePrivateConfirmed ? 'Make private' : 'Save PIN'}</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: '#1f2937', borderRadius: 14, padding: 20, gap: 12 },
  title: { color: '#f9fafb', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  input: { backgroundColor: '#111827', borderColor: '#374151', borderWidth: 1, borderRadius: 8, color: '#f9fafb', paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  error: { color: '#f87171', fontSize: 13 },
  info: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancel: { backgroundColor: '#374151' },
  cancelText: { color: '#e5e7eb', fontWeight: '600' },
  primary: { backgroundColor: '#3b82f6', minWidth: 90, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});
