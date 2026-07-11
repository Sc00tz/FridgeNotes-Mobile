export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface ChecklistItem {
  id: number | string;
  note_id: number;
  text: string;
  completed: boolean;
  order: number;
  category: string | null;
  created_at: string;
}

export interface Label {
  id: number;
  name: string;
  display_name: string;
  full_name: string;
  color: string;
  parent_id: number | null;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  note_id: number;
  uploader_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  attachment_type: 'image' | 'audio';
  url: string;
  created_at: string;
}

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
}

export interface Note {
  id: number | string;
  client_id?: string | null;
  user_id: number;
  title: string;
  content: string | null;
  note_type: 'text' | 'checklist';
  color: string;
  position: number;
  pinned: boolean;
  archived: boolean;
  is_private?: boolean;
  is_locked?: boolean; // server withheld content pending PIN unlock
  reminder_datetime: string | null;
  reminder_completed: boolean;
  reminder_snoozed_until: string | null;
  // Location-based reminder (geofence target; triggering is client/OS-side).
  reminder_latitude?: number | null;
  reminder_longitude?: number | null;
  reminder_radius?: number | null;
  reminder_location_name?: string | null;
  created_at: string;
  updated_at: string;
  checklist_items: ChecklistItem[];
  labels: Label[];
  attachments?: Attachment[];
  is_shared?: boolean;
  shared_with_current_user?: boolean;
  current_user_share_id?: number;
  current_user_access_level?: 'read' | 'edit';
  _offline?: boolean;
  _operationId?: string;
  // Local echo of the version an edit was based on, for 409 conflict detection.
  base_updated_at?: string;
}

export interface SyncChanges {
  changed: Note[];
  deleted: number[];
  server_time: string;
}

export type RootStackParamList = {
  ServerSetup: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  NoteEditor: { noteId: number | string };
  ShareReceiver: { text: string };
};

export type MainTabParamList = {
  Notes: undefined;
  Archived: undefined;
};
