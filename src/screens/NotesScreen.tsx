import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Note, User, RootStackParamList } from '../types';
import { NoteCard } from '../components/NoteCard';
import { OfflineStatusBar } from '../components/OfflineStatusBar';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  notes: Note[];
  currentUser: User;
  loading: boolean;
  onLogout: () => void;
  onChangeServer?: () => void;
  onRefresh: () => Promise<any>;
  onCreateNote: (type: 'text' | 'checklist') => Promise<any>;
  onUpdateNote: (noteId: number | string, data: Partial<Note>) => Promise<any>;
  onDeleteNote: (noteId: number | string) => Promise<any>;
  onUpdateChecklistItem: (
    noteId: number | string,
    itemId: number | string,
    data: { completed?: boolean; text?: string },
  ) => Promise<void>;
  onPinToggle: (noteId: number | string, pinned: boolean) => Promise<void>;
  showArchived?: boolean;
  isOnline?: boolean;
  queueSize?: number;
  isSyncing?: boolean;
  syncError?: string | null;
  onForceSync?: () => void;
}

export const NotesScreen: React.FC<Props> = ({
  notes,
  currentUser,
  loading,
  onLogout,
  onChangeServer,
  onRefresh,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onUpdateChecklistItem,
  onPinToggle,
  showArchived = false,
  isOnline = true,
  queueSize = 0,
  isSyncing = false,
  syncError = null,
  onForceSync,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();

  // Two columns with a 10px gap between them and 12px outer padding
  const COLUMN_GAP = 10;
  const OUTER_PAD = 12;
  const cardWidth = (width - OUTER_PAD * 2 - COLUMN_GAP) / 2;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh]);

  const handleCreateNote = async (type: 'text' | 'checklist') => {
    try {
      const newNote = await onCreateNote(type);
      if (newNote?.id) {
        navigation.push('NoteEditor', { noteId: newNote.id });
      }
    } catch {}
  };

  const handleDelete = (noteId: number | string, title: string) => {
    Alert.alert('Delete Note', `Delete "${title || 'Untitled'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteNote(noteId) },
    ]);
  };

  const filteredNotes = notes.filter(note => {
    if (!(showArchived ? note.archived : !note.archived)) return false;
    if (!searchTerm) return true;

    if (searchTerm.startsWith('label:')) {
      const labelName = searchTerm.slice(6).toLowerCase();
      return note.labels?.some(l => l.display_name.toLowerCase().includes(labelName));
    }
    const q = searchTerm.toLowerCase();
    return (
      note.title?.toLowerCase().includes(q) ||
      note.content?.toLowerCase().includes(q) ||
      note.checklist_items?.some(i => i.text.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    if (a.position !== b.position) return a.position - b.position;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Build two-column pairs for the grid layout
  const pairs: Array<[Note, Note | null]> = [];
  for (let i = 0; i < filteredNotes.length; i += 2) {
    pairs.push([filteredNotes[i], filteredNotes[i + 1] ?? null]);
  }

  const handleLogout = () => {
    const buttons: any[] = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onLogout },
    ];
    if (onChangeServer) {
      buttons.splice(1, 0, {
        text: 'Change server',
        onPress: onChangeServer,
      });
    }
    Alert.alert(`Signed in as ${currentUser.username}`, undefined, buttons);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FridgeNotes</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.userButton}>
          <Text style={styles.userText}>{currentUser.username[0].toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search or label:name…"
          placeholderTextColor="#6b7280"
          value={searchTerm}
          onChangeText={setSearchTerm}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Two-column grid */}
      <FlatList
        data={pairs}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={({ item: [left, right] }) => (
          <View style={[styles.row, { paddingHorizontal: OUTER_PAD, gap: COLUMN_GAP }]}>
            <View style={{ width: cardWidth }}>
              <NoteCard
                note={left}
                onPress={() => navigation.push('NoteEditor', { noteId: left.id })}
                onUpdate={data => onUpdateNote(left.id, data)}
                onDelete={() => handleDelete(left.id, left.title)}
                onChecklistItemUpdate={(itemId, data) =>
                  onUpdateChecklistItem(left.id, itemId, data)
                }
                onPinToggle={pinned => onPinToggle(left.id, pinned)}
              />
            </View>
            {right ? (
              <View style={{ width: cardWidth }}>
                <NoteCard
                  note={right}
                  onPress={() => navigation.push('NoteEditor', { noteId: right.id })}
                  onUpdate={data => onUpdateNote(right.id, data)}
                  onDelete={() => handleDelete(right.id, right.title)}
                  onChecklistItemUpdate={(itemId, data) =>
                    onUpdateChecklistItem(right.id, itemId, data)
                  }
                  onPinToggle={pinned => onPinToggle(right.id, pinned)}
                />
              </View>
            ) : (
              <View style={{ width: cardWidth }} />
            )}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#60a5fa" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {showArchived ? 'No archived notes' : 'No notes yet'}
            </Text>
            {!showArchived && (
              <Text style={styles.emptySubtitle}>Tap + Note or ☑ List to get started</Text>
            )}
          </View>
        }
      />

      {/* Offline status bar */}
      <OfflineStatusBar
        isOnline={isOnline}
        queueSize={queueSize}
        isSyncing={isSyncing}
        syncError={syncError}
        onForceSync={onForceSync ?? (() => {})}
      />

      {/* FABs */}
      {!showArchived && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={[styles.fab, styles.fabSecondary]}
            onPress={() => handleCreateNote('checklist')}
          >
            <Text style={styles.fabText}>☑ List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={() => handleCreateNote('text')}>
            <Text style={styles.fabText}>+ Note</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f9fafb' },
  userButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  searchContainer: { paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#f9fafb',
    borderWidth: 1,
    borderColor: '#374151',
  },
  listContent: { paddingBottom: 110, paddingTop: 4 },
  row: { flexDirection: 'row', marginBottom: 0 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#6b7280', fontSize: 17, fontWeight: '500' },
  emptySubtitle: { color: '#4b5563', fontSize: 14 },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  fab: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabSecondary: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  fabText: { color: '#f9fafb', fontSize: 15, fontWeight: '600' },
});
