/**
 * WebSocket client for FridgeNotes real-time collaboration.
 * Mirrors the web app's socket.js but adapted for React Native
 * (no window.location — uses API_URL from config directly).
 */

import { io, Socket } from 'socket.io-client';
import { getCachedServerUrl } from './config';

type EventCallback = (...args: any[]) => void;

class WebSocketManager {
  private socket: Socket | null = null;
  isConnected = false;
  private currentUserId: number | null = null;
  private joinedNotes = new Set<number | string>();
  private eventListeners = new Map<string, EventCallback>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private roomOperationTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingRoomOperations = new Set<{ type: 'join' | 'leave'; noteId: number | string }>();
  private lastEventTime = new Map<string, number>();
  private readonly eventThrottleMs = 100;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectDelay = 2000;
  private reconnectAttempts = 0;

  connect(userId: number) {
    if (this.socket && this.isConnected) {
      this.disconnect();
    }

    const serverUrl = getCachedServerUrl();
    if (!serverUrl) return null; // Not yet configured — caller should handle this

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.currentUserId = userId;
    this.setupEventListeners();
    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.removeAllListeners();

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      if (this.currentUserId) {
        this.socket?.emit('join_user', { user_id: this.currentUserId });
      }
      this.joinedNotes.forEach(noteId => this.joinNote(noteId));
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      if (reason === 'io server disconnect' && this.currentUserId) {
        this.reconnectTimeout = setTimeout(() => {
          if (!this.isConnected && this.currentUserId) {
            this.connect(this.currentUserId);
          }
        }, this.reconnectDelay);
      }
    });

    this.socket.on('connect_error', () => {
      this.isConnected = false;
      this.reconnectAttempts++;
    });
  }

  disconnect() {
    if (this.socket) {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      if (this.roomOperationTimeout) {
        clearTimeout(this.roomOperationTimeout);
        this.roomOperationTimeout = null;
      }
      this.pendingRoomOperations.clear();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.joinedNotes.clear();
      this.eventListeners.clear();
      this.currentUserId = null;
      this.reconnectAttempts = 0;
    }
  }

  joinNote(noteId: number | string) {
    if (!noteId) return;
    this.pendingRoomOperations.add({ type: 'join', noteId });
    this._processPendingRoomOperations();
  }

  leaveNote(noteId: number | string) {
    if (!noteId) return;
    this.pendingRoomOperations.add({ type: 'leave', noteId });
    this._processPendingRoomOperations();
  }

  private _processPendingRoomOperations() {
    if (this.roomOperationTimeout) clearTimeout(this.roomOperationTimeout);
    this.roomOperationTimeout = setTimeout(() => {
      if (!this.socket || !this.isConnected || !this.currentUserId) return;
      const operations = Array.from(this.pendingRoomOperations);
      this.pendingRoomOperations.clear();
      operations.forEach(op => {
        if (op.type === 'join' && !this.joinedNotes.has(op.noteId)) {
          this.socket?.emit('join_note', { note_id: op.noteId, user_id: this.currentUserId });
          this.joinedNotes.add(op.noteId);
        } else if (op.type === 'leave' && this.joinedNotes.has(op.noteId)) {
          this.socket?.emit('leave_note', { note_id: op.noteId, user_id: this.currentUserId });
          this.joinedNotes.delete(op.noteId);
        }
      });
    }, 50);
  }

  private _shouldThrottle(eventKey: string): boolean {
    const now = Date.now();
    const last = this.lastEventTime.get(eventKey) || 0;
    if (now - last < this.eventThrottleMs) return true;
    if (this.lastEventTime.size > 500) {
      const cutoff = now - 60000;
      for (const [key, time] of this.lastEventTime) {
        if (time < cutoff) this.lastEventTime.delete(key);
      }
    }
    this.lastEventTime.set(eventKey, now);
    return false;
  }

  emitNoteUpdate(noteId: number | string, updateType: string, data: object) {
    if (!this.socket || !this.isConnected || !this.currentUserId) return;
    if (this._shouldThrottle(`note_update_${noteId}_${updateType}`)) return;
    this.socket.emit('note_updated', {
      note_id: noteId,
      user_id: this.currentUserId,
      update_type: updateType,
      data,
    });
  }

  emitChecklistItemToggle(noteId: number | string, itemId: number | string, completed: boolean) {
    if (!this.socket || !this.isConnected || !this.currentUserId) return;
    this.socket.emit('checklist_item_toggled', {
      note_id: noteId,
      item_id: itemId,
      completed,
      user_id: this.currentUserId,
    });
  }

  onNoteUpdate(callback: EventCallback) {
    if (!this.socket) return;
    this.socket.on('note_update_received', callback);
    this.eventListeners.set('note_update_received', callback);
  }

  onChecklistItemToggle(callback: EventCallback) {
    if (!this.socket) return;
    this.socket.on('checklist_item_toggle_received', callback);
    this.eventListeners.set('checklist_item_toggle_received', callback);
  }

  offNoteUpdate(callback: EventCallback) {
    this.socket?.off('note_update_received', callback);
    this.eventListeners.delete('note_update_received');
  }

  offChecklistItemToggle(callback: EventCallback) {
    this.socket?.off('checklist_item_toggle_received', callback);
    this.eventListeners.delete('checklist_item_toggle_received');
  }

  isSocketConnected() {
    return this.socket?.connected && this.isConnected;
  }
}

export const socketClient = new WebSocketManager();
