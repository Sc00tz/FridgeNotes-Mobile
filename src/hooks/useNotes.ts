import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api';
import { socketClient } from '../lib/socket';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineQueue } from './useOfflineQueue';
import { Note, User } from '../types';

export const useNotes = (currentUser: User | null, isAuthenticated: boolean) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queue = useOfflineQueue();

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  // Flush the queue and then reload notes when connectivity is restored
  const handleReconnect = useCallback(async () => {
    if (queue.queueSize === 0) return;
    const { failed } = await queue.flushQueue();
    if (failed === 0) {
      // Full reload to reconcile any optimistic state
      await loadNotes();
    }
  }, [queue.queueSize, queue.flushQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  const network = useNetworkStatus(handleReconnect);

  // Initialise queue size from storage on mount
  useEffect(() => {
    queue.initQueueSize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNoteUpdate = useCallback((data: any) => {
    if (data.update_type === 'deleted') {
      setNotes(prev => prev.filter(n => n.id !== data.data.id));
    } else if (data.update_type === 'created') {
      setNotes(prev => {
        if (prev.some(n => n.id === data.data.id)) return prev;
        return [data.data, ...prev];
      });
    } else {
      setNotes(prev =>
        prev.map(n => n.id === data.note_id ? { ...n, ...data.data } : n)
      );
    }
  }, []);

  const handleChecklistToggle = useCallback((data: any) => {
    setNotes(prev =>
      prev.map(note => {
        if (note.id !== data.note_id) return note;
        return {
          ...note,
          checklist_items: note.checklist_items.map(item =>
            item.id === data.item_id ? { ...item, completed: data.completed } : item
          ),
        };
      })
    );
  }, []);

  const loadNotes = useCallback(async () => {
    if (!isAuthenticated || !currentUser) return;
    try {
      setLoading(true);
      const userNotes = await apiClient.getNotes();
      setNotes(userNotes);
      return userNotes;
    } catch (err: any) {
      showError('Failed to load notes: ' + err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentUser, showError]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    let mounted = true;

    socketClient.connect(currentUser.id);
    socketClient.onNoteUpdate(handleNoteUpdate);
    socketClient.onChecklistItemToggle(handleChecklistToggle);

    loadNotes().catch(() => {
      if (mounted) showError('Failed to load notes');
    });

    return () => {
      mounted = false;
      socketClient.offNoteUpdate(handleNoteUpdate);
      socketClient.offChecklistItemToggle(handleChecklistToggle);
      socketClient.disconnect();
    };
  }, [isAuthenticated, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const createNote = useCallback(async (noteData: Partial<Note>) => {
    if (!network.isOnline) {
      // Optimistic note — will be created for real when back online
      const tempId = `temp_${Date.now()}`;
      const optimistic: Note = {
        id: tempId,
        user_id: currentUser?.id ?? 0,
        title: noteData.title ?? '',
        content: noteData.content ?? null,
        note_type: noteData.note_type ?? 'text',
        color: noteData.color ?? 'default',
        position: 0,
        pinned: false,
        archived: false,
        reminder_datetime: null,
        reminder_completed: false,
        reminder_snoozed_until: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        checklist_items: noteData.checklist_items ?? [],
        labels: [],
        _offline: true,
      };
      setNotes(prev => [optimistic, ...prev]);
      await queue.enqueue('create_note', noteData as Record<string, any>);
      return optimistic;
    }

    try {
      setLoading(true);
      const newNote = await apiClient.createNote(noteData);
      setNotes(prev => {
        if (prev.some(n => n.id === newNote.id)) return prev;
        return [newNote, ...prev];
      });
      return newNote;
    } catch (err: any) {
      showError('Failed to create note: ' + err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [network.isOnline, currentUser, queue, showError]);

  const updateNote = useCallback(async (noteId: number | string, data: Partial<Note>) => {
    // Always apply optimistically to local state
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...data } : n));

    if (!network.isOnline) {
      await queue.enqueue('update_note', data as Record<string, any>, noteId);
      // Return a synthetic merged note so callers don't error
      const existing = notes.find(n => n.id === noteId);
      return { ...(existing ?? {}), ...data } as Note;
    }

    try {
      const savedNote = await apiClient.updateNote(noteId, data);
      setNotes(prev => prev.map(n => n.id === savedNote.id ? savedNote : n));
      if (socketClient.isSocketConnected()) {
        socketClient.emitNoteUpdate(savedNote.id, 'content', savedNote);
      }
      return savedNote;
    } catch (err: any) {
      // Revert on API failure
      await loadNotes().catch(() => {});
      showError('Failed to update note: ' + err.message);
      throw err;
    }
  }, [network.isOnline, notes, queue, showError, loadNotes]);

  const deleteNote = useCallback(async (noteId: number | string) => {
    // Optimistic removal
    setNotes(prev => prev.filter(n => n.id !== noteId));

    if (!network.isOnline) {
      await queue.enqueue('delete_note', {}, noteId);
      return;
    }

    try {
      await apiClient.deleteNote(noteId);
    } catch (err: any) {
      // Restore the note on failure
      await loadNotes().catch(() => {});
      showError('Failed to delete note: ' + err.message);
      throw err;
    }
  }, [network.isOnline, queue, showError, loadNotes]);

  const updateChecklistItem = useCallback(async (
    noteId: number | string,
    itemId: number | string,
    data: { completed?: boolean; text?: string },
  ) => {
    // Temp IDs — item not yet on server
    if (String(itemId).startsWith('temp_')) {
      setNotes(prev =>
        prev.map(note => {
          if (note.id !== noteId) return note;
          return {
            ...note,
            checklist_items: note.checklist_items.map(item =>
              item.id === itemId ? { ...item, ...data } : item
            ),
          };
        })
      );
      return;
    }

    // Optimistic update
    setNotes(prev =>
      prev.map(note => {
        if (note.id !== noteId) return note;
        return {
          ...note,
          checklist_items: note.checklist_items.map(item =>
            item.id === itemId ? { ...item, ...data } : item
          ),
        };
      })
    );

    if (!network.isOnline) {
      await queue.enqueue('update_checklist_item', data, noteId, itemId);
      return;
    }

    try {
      await apiClient.updateChecklistItem(noteId, itemId, data);
      if (data.completed !== undefined && socketClient.isSocketConnected()) {
        socketClient.emitChecklistItemToggle(noteId, itemId, data.completed);
      }
    } catch (err: any) {
      // Revert on failure
      setNotes(prev =>
        prev.map(note => {
          if (note.id !== noteId) return note;
          return {
            ...note,
            checklist_items: note.checklist_items.map(item =>
              item.id === itemId ? { ...item, ...Object.fromEntries(
                Object.keys(data).map(k => [k, !(data as any)[k]])
              ) } : item
            ),
          };
        })
      );
      showError('Failed to update item: ' + err.message);
      throw err;
    }
  }, [network.isOnline, queue, showError]);

  const pinToggle = useCallback(async (noteId: number | string, pinned: boolean) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, pinned } : n));
    try {
      await apiClient.pinNote(noteId, pinned);
    } catch (err: any) {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, pinned: !pinned } : n));
      showError('Failed to update pin: ' + err.message);
      throw err;
    }
  }, [showError]);

  return {
    notes,
    loading,
    error,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    updateChecklistItem,
    pinToggle,
    setNotes,
    // Expose offline state for UI
    isOnline: network.isOnline,
    queueSize: queue.queueSize,
    isSyncing: queue.isSyncing,
    syncError: queue.lastSyncError,
    flushQueue: queue.flushQueue,
  };
};
