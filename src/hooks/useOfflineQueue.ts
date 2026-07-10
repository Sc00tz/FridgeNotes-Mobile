/**
 * useOfflineQueue
 *
 * AsyncStorage-backed operation queue for offline support.
 * When the device is offline, write operations are queued here.
 * On reconnect (or manual flush), queued operations are replayed
 * against the API in order.
 *
 * Supports: create_note, update_note, delete_note, update_checklist_item
 */

import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/api';

const QUEUE_KEY = 'fridgenotes_mobile_offline_queue';
const MAX_QUEUE = 500;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export type OperationType =
  | 'create_note'
  | 'update_note'
  | 'delete_note'
  | 'update_checklist_item';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  noteId?: number | string;
  itemId?: number | string;
  data: Record<string, any>;
  timestamp: string;
  retryCount: number;
}

const genId = () => `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const readQueue = async (): Promise<QueuedOperation[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: QueuedOperation[]) => {
  const limited = queue.slice(-MAX_QUEUE);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(limited)).catch(() => {});
};

// Returns the API result (used to capture created-note ids for remapping).
const executeOperation = async (op: QueuedOperation): Promise<any> => {
  switch (op.type) {
    case 'create_note':
      return apiClient.createNote(op.data as any);
    case 'update_note':
      if (op.noteId) return apiClient.updateNote(op.noteId, op.data as any);
      return undefined;
    case 'delete_note':
      if (op.noteId) return apiClient.deleteNote(op.noteId);
      return undefined;
    case 'update_checklist_item':
      if (op.noteId && op.itemId) {
        return apiClient.updateChecklistItem(op.noteId, op.itemId, op.data as any);
      }
      return undefined;
  }
};

export const useOfflineQueue = () => {
  const [queueSize, setQueueSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const enqueue = useCallback(async (
    type: OperationType,
    data: Record<string, any>,
    noteId?: number | string,
    itemId?: number | string,
  ): Promise<string> => {
    const op: QueuedOperation = {
      id: genId(),
      type,
      noteId,
      itemId,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    const queue = await readQueue();
    queue.push(op);
    await writeQueue(queue);
    setQueueSize(queue.length);
    return op.id;
  }, []);

  const flushQueue = useCallback(async (): Promise<{ succeeded: number; failed: number }> => {
    if (syncingRef.current) return { succeeded: 0, failed: 0 };
    syncingRef.current = true;
    setIsSyncing(true);
    setLastSyncError(null);

    let succeeded = 0;
    let failed = 0;

    try {
      const queue = await readQueue();
      if (queue.length === 0) return { succeeded: 0, failed: 0 };

      const remaining: QueuedOperation[] = [];
      // Maps an offline note's client_id (its optimistic local id) to the real
      // server id once its create syncs, so follow-up ops queued against the
      // client_id target the right note instead of 404ing.
      const idMap: Record<string, number | string> = {};

      for (let op of queue) {
        // Rewrite noteId if it referenced an offline note now given a real id.
        if (op.noteId != null && idMap[String(op.noteId)] != null) {
          op = { ...op, noteId: idMap[String(op.noteId)] };
        }
        try {
          const result = await executeOperation(op);
          succeeded++;
          // Record client_id -> real id from a create so later ops remap.
          if (op.type === 'create_note' && result?.id != null) {
            const clientId = op.data?.client_id;
            if (clientId && clientId !== result.id) idMap[String(clientId)] = result.id;
          }
        } catch (err: any) {
          // A 409 is terminal (server-wins): retrying replays the same stale
          // edit and conflicts again. Drop it; a reload reconciles to server.
          if (err?.status === 409) {
            failed++;
            continue;
          }
          failed++;
          if (op.retryCount < MAX_RETRIES) {
            remaining.push({ ...op, retryCount: op.retryCount + 1 });
          }
          // Operations that hit max retries are silently dropped —
          // a full reload will reconcile state with the server.
        }
      }

      await writeQueue(remaining);
      setQueueSize(remaining.length);

      if (failed > 0 && remaining.length > 0) {
        setLastSyncError(`${failed} operation(s) failed — will retry`);
        // Schedule a retry after a backoff delay
        setTimeout(() => {
          syncingRef.current = false;
          flushQueue();
        }, RETRY_DELAY_MS);
        return { succeeded, failed };
      }

      setLastSyncError(null);
    } catch (err: any) {
      setLastSyncError('Sync failed: ' + err.message);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }

    return { succeeded, failed };
  }, []);

  const clearQueue = useCallback(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
    setQueueSize(0);
    setLastSyncError(null);
  }, []);

  // Load queue size on mount
  const initQueueSize = useCallback(async () => {
    const q = await readQueue();
    setQueueSize(q.length);
  }, []);

  return {
    queueSize,
    isSyncing,
    lastSyncError,
    enqueue,
    flushQueue,
    clearQueue,
    initQueueSize,
  };
};
