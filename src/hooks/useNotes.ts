import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api';
import { socketClient } from '../lib/socket';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineQueue } from './useOfflineQueue';
import { Note, User } from '../types';

// Client-generated id for offline note creation (idempotent create on server).
const genClientId = () =>
  `cid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const useNotes = (currentUser: User | null, isAuthenticated: boolean) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queue = useOfflineQueue();
  // Delta-sync cursor (server_time of the last sync) for incremental catch-up.
  const syncCursorRef = useRef<string | null>(null);
  // Holds the latest deltaSync so handleReconnect (defined earlier) can call it
  // without a stale-closure / definition-order problem.
  const deltaSyncRef = useRef<(() => Promise<void>) | null>(null);

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  // On reconnect: flush queued writes, then pull changes from other devices.
  const handleReconnect = useCallback(async () => {
    // Flush any queued offline writes first.
    if (queue.queueSize > 0) {
      await queue.flushQueue();
    }
    // Then catch up on changes made elsewhere (incremental if we have a cursor,
    // full reload otherwise). Reconciles optimistic state and remapped ids.
    await deltaSyncRef.current?.();
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
      // Full delta-sync (no cursor): all accessible notes + a cursor to seed
      // subsequent incremental syncs.
      const result = await apiClient.getChanges();
      const userNotes = Array.isArray(result?.changed) ? result.changed : [];
      setNotes(userNotes);
      if (result?.server_time) syncCursorRef.current = result.server_time;
      return userNotes;
    } catch (err: any) {
      showError('Failed to load notes: ' + err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentUser, showError]);

  // Incremental catch-up: fetch only what changed/was deleted since the cursor,
  // merge changed notes and drop tombstoned ones. Falls back to a full load if
  // there's no cursor yet.
  const deltaSync = useCallback(async () => {
    if (!isAuthenticated || !currentUser) return;
    const since = syncCursorRef.current;
    if (!since) { await loadNotes(); return; }
    try {
      const result = await apiClient.getChanges(since);
      const changed = Array.isArray(result?.changed) ? result.changed : [];
      const deleted = Array.isArray(result?.deleted) ? result.deleted : [];
      if (changed.length || deleted.length) {
        const deletedSet = new Set(deleted);
        const changedById = new Map(changed.map(n => [n.id, n]));
        setNotes(prev => {
          const merged = prev
            .filter(n => !deletedSet.has(n.id as number))
            .map(n => (changedById.has(n.id) ? changedById.get(n.id)! : n));
          const existing = new Set(merged.map(n => n.id));
          for (const n of changed) if (!existing.has(n.id)) merged.unshift(n);
          return merged;
        });
      }
      if (result?.server_time) syncCursorRef.current = result.server_time;
    } catch {
      // Non-fatal: a failed catch-up shouldn't disrupt the session.
    }
  }, [isAuthenticated, currentUser, loadNotes]);

  // Keep the ref current so handleReconnect always calls the latest deltaSync.
  deltaSyncRef.current = deltaSync;

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
      // Optimistic note. Use a client_id as the local id so follow-up offline
      // edits queue against a stable id the server will recognize on sync
      // (the server makes create idempotent on client_id and returns it).
      const clientId = genClientId();
      const optimistic: Note = {
        id: clientId,
        client_id: clientId,
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
      await queue.enqueue('create_note', { ...noteData, client_id: clientId } as Record<string, any>);
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
      // Send base_updated_at (the version this edit is based on) so the server
      // can detect a concurrent change and reject with 409 instead of clobbering.
      const existing = notes.find(n => n.id === noteId);
      const payload: Partial<Note> =
        existing?.updated_at && data.base_updated_at === undefined
          ? { ...data, base_updated_at: existing.updated_at }
          : data;
      const savedNote = await apiClient.updateNote(noteId, payload);
      setNotes(prev => prev.map(n => n.id === savedNote.id ? savedNote : n));
      if (socketClient.isSocketConnected()) {
        socketClient.emitNoteUpdate(savedNote.id, 'content', savedNote);
      }
      return savedNote;
    } catch (err: any) {
      // Concurrent-edit conflict: server-wins. Adopt the server's current
      // version locally and tell the user their edit was superseded.
      if (err?.status === 409) {
        if (err.current) {
          setNotes(prev => prev.map(n => n.id === err.current.id ? err.current : n));
        } else {
          await loadNotes().catch(() => {});
        }
        showError('This note was changed elsewhere; showing the latest version.');
        return err.current ?? null;
      }
      // Revert on other API failures
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
    deltaSync,
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
