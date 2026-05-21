import { getServerUrl } from './config';
import { Note, Label, User, ChecklistItem } from '../types';
import CookieManager from '@react-native-cookies/cookies';

class APIClient {
  private async getBaseURL(): Promise<string> {
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured. Please set up your FridgeNotes server in Settings.');
    return `${serverUrl}/api`;
  }

  // Read the session cookie from the native cookie store and inject it manually.
  // React Native's fetch does not automatically send cookies the way a browser does.
  private async getSessionCookieHeader(baseURL: string): Promise<string> {
    try {
      const serverUrl = await getServerUrl();
      if (!serverUrl) return '';
      const cookies = await CookieManager.get(serverUrl);
      return Object.values(cookies)
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    } catch {
      return '';
    }
  }

  // Persist any Set-Cookie headers from a response into the native cookie store.
  private async persistCookies(response: Response, baseURL: string): Promise<void> {
    try {
      const serverUrl = await getServerUrl();
      if (!serverUrl) return;
      const setCookie = response.headers.get('set-cookie');
      if (!setCookie) return;
      // Parse each directive and store via CookieManager
      const parts = setCookie.split(';').map(s => s.trim());
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=');
      if (name && value) {
        await CookieManager.set(serverUrl, { name: name.trim(), value: value.trim(), path: '/' });
      }
    } catch {
      // Non-fatal — worst case the next request re-authenticates
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseURL = await this.getBaseURL();
    const url = `${baseURL}${endpoint}`;
    const cookieHeader = await this.getSessionCookieHeader(baseURL);

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    await this.persistCookies(response, baseURL);

    if (!response.ok) {
      let errorData: { error?: string; message?: string } = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `HTTP ${response.status}` };
      }
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
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
    return this.request('/auth/logout', { method: 'POST' });
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
