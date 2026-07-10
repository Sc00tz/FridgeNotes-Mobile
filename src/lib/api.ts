import { getServerUrl } from './config';
import { Note, Label, User, ChecklistItem, Attachment, GeocodeResult, SyncChanges } from '../types';
import * as SecureStore from 'expo-secure-store';

// Key under which the session cookie ("session=<value>") is persisted.
const SESSION_COOKIE_KEY = 'fridgenotes_session_cookie';

class APIClient {
  private async getBaseURL(): Promise<string> {
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured. Please set up your FridgeNotes server in Settings.');
    return `${serverUrl}/api`;
  }

  // React Native's fetch does not persist cookies like a browser, so we manage
  // the Flask session cookie manually: store it in expo-secure-store and inject
  // it as a Cookie header. (Replaces @react-native-cookies/cookies, which is
  // unmaintained and unsupported on the New Architecture.)
  public async getSessionCookieHeader(_baseURL?: string): Promise<string> {
    try {
      return (await SecureStore.getItemAsync(SESSION_COOKIE_KEY)) ?? '';
    } catch {
      return '';
    }
  }

  // Persist the session cookie from a response's Set-Cookie header.
  private async persistCookies(response: Response): Promise<void> {
    try {
      const setCookie = response.headers.get('set-cookie');
      if (!setCookie) return;
      // Take the first cookie directive ("session=<value>"), dropping attributes.
      const nameValue = setCookie.split(';')[0]?.trim();
      const eq = nameValue.indexOf('=');
      if (eq > 0) {
        const name = nameValue.slice(0, eq).trim();
        const value = nameValue.slice(eq + 1).trim();
        if (name && value) {
          await SecureStore.setItemAsync(SESSION_COOKIE_KEY, `${name}=${value}`);
        }
      }
    } catch {
      // Non-fatal — worst case the next request re-authenticates.
    }
  }

  // Clear the stored session (used on logout).
  public async clearSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
    } catch {
      // ignore
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseURL = await this.getBaseURL();
    const url = `${baseURL}${endpoint}`;
    const cookieHeader = await this.getSessionCookieHeader(baseURL);

    // Multipart uploads must NOT get a JSON Content-Type — the runtime sets
    // the multipart boundary itself. Detect FormData bodies and let them pass.
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const config: RequestInit = {
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...options.headers,
      },
      ...options,
    };

    // Only JSON-stringify plain-object bodies (never FormData).
    if (config.body && typeof config.body === 'object' && !isFormData) {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    await this.persistCookies(response);

    if (!response.ok) {
      let errorData: { error?: string; message?: string; current?: Note } = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP ${response.status}` };
      }
      const err = new Error(errorData.error || errorData.message || `HTTP ${response.status}`) as
        Error & { status?: number; current?: Note };
      err.status = response.status;
      // 409 conflict responses carry the server's current note for reconciliation.
      if (response.status === 409 && errorData.current) err.current = errorData.current;
      throw err;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return { success: true } as T;
  }

  // Auth
  async login(data: { username?: string; email?: string; password: string; remember?: boolean }) {
    return this.request<{ user: User; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async register(data: { username: string; email: string; password: string }) {
    return this.request<{ user: User; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout() {
    try {
      return await this.request('/auth/logout', { method: 'POST' });
    } finally {
      // Always drop the local session, even if the server call fails.
      await this.clearSession();
    }
  }

  async checkAuth() {
    return this.request<{ authenticated: boolean; user: User | null }>('/auth/check');
  }

  async changePassword(data: { current_password: string; new_password: string }) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Notes
  async getNotes(): Promise<Note[]> {
    return this.request('/notes');
  }

  async createNote(data: Partial<Note>): Promise<Note> {
    return this.request('/notes', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateNote(noteId: number | string, data: Partial<Note>): Promise<Note> {
    return this.request(`/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteNote(noteId: number | string): Promise<void> {
    return this.request(`/notes/${noteId}`, { method: 'DELETE' });
  }

  // Delta-sync: notes changed and deleted since a cursor (omit for full sync).
  async getChanges(since?: string): Promise<SyncChanges> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request(`/sync${qs}`);
  }

  // Attachments
  async listAttachments(noteId: number | string): Promise<Attachment[]> {
    return this.request(`/notes/${noteId}/attachments`);
  }

  // Upload a local file (from image picker / audio recorder) to a note.
  // In React Native, FormData accepts { uri, name, type } file descriptors.
  async uploadAttachment(
    noteId: number | string,
    file: { uri: string; name: string; type: string },
  ): Promise<Attachment> {
    const form = new FormData();
    // RN's FormData file shape differs from the DOM's; cast through unknown.
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    return this.request(`/notes/${noteId}/attachments`, { method: 'POST', body: form });
  }

  async deleteAttachment(noteId: number | string, attachmentId: number): Promise<void> {
    return this.request(`/notes/${noteId}/attachments/${attachmentId}`, { method: 'DELETE' });
  }

  // Build an authenticated URI + headers for rendering/playing an attachment
  // (RN <Image>/audio player can take { uri, headers }); attachments require
  // the session cookie.
  async getAttachmentSource(
    noteId: number | string,
    attachmentId: number,
  ): Promise<{ uri: string; headers: Record<string, string> }> {
    const serverUrl = await getServerUrl();
    const cookieHeader = await this.getSessionCookieHeader(serverUrl || '');
    return {
      uri: `${serverUrl}/api/notes/${noteId}/attachments/${attachmentId}`,
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    };
  }

  // Geocoding: address/business search proxied via the server (Nominatim).
  async geocode(query: string): Promise<GeocodeResult[]> {
    if (!query.trim()) return [];
    return this.request(`/geocode?q=${encodeURIComponent(query.trim())}`);
  }

  async pinNote(noteId: number | string, pinned: boolean) {
    return this.request(`/notes/${noteId}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ pinned }),
    });
  }

  async reorderNotes(noteIds: number[]) {
    return this.request('/notes/reorder', {
      method: 'PUT',
      body: JSON.stringify({ note_ids: noteIds }),
    });
  }

  async updateChecklistItem(
    noteId: number | string,
    itemId: number | string,
    data: Partial<ChecklistItem>,
  ): Promise<ChecklistItem> {
    return this.request(`/notes/${noteId}/checklist-items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Labels
  async getLabels(): Promise<Label[]> {
    return this.request('/labels');
  }

  async createLabel(data: { name: string; color: string }): Promise<Label> {
    return this.request('/labels', { method: 'POST', body: JSON.stringify(data) });
  }

  async addLabelToNote(noteId: number | string, labelId: number): Promise<void> {
    return this.request(`/notes/${noteId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ label_id: labelId }),
    });
  }

  async removeLabelFromNote(noteId: number | string, labelId: number): Promise<void> {
    return this.request(`/notes/${noteId}/labels/${labelId}`, { method: 'DELETE' });
  }

  // Reminders
  async completeReminder(noteId: number | string) {
    return this.request(`/notes/${noteId}/reminder/complete`, { method: 'POST' });
  }

  async snoozeReminder(noteId: number | string, snoozeUntil: string) {
    return this.request(`/notes/${noteId}/reminder/snooze`, {
      method: 'POST',
      body: JSON.stringify({ snooze_until: snoozeUntil }),
    });
  }

  // Sharing
  async shareNote(
    noteId: number | string,
    data: { username: string; access_level: 'read' | 'edit' },
  ) {
    return this.request(`/notes/${noteId}/share`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getNoteShares(noteId: number | string) {
    return this.request<Array<{
      id: number;
      note_id: number;
      user_id: number;
      access_level: 'read' | 'edit';
      shared_at: string;
      user: { id: number; username: string } | null;
    }>>(`/notes/${noteId}/shares`);
  }

  async unshareNote(noteId: number | string, shareId: number): Promise<void> {
    return this.request(`/notes/${noteId}/shares/${shareId}`, { method: 'DELETE' });
  }

  async hideSharedNote(noteId: number | string, shareId: number): Promise<void> {
    return this.request(`/notes/${noteId}/shares/${shareId}/hide`, {
      method: 'PUT',
      body: JSON.stringify({ hidden: true }),
    });
  }
}

export const apiClient = new APIClient();
