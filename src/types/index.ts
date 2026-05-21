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

export interface Note {
  id: number | string;
  user_id: number;
  title: string;
  content: string | null;
  note_type: 'text' | 'checklist';
  color: string;
  position: number;
  pinned: boolean;
  archived: boolean;
  reminder_datetime: string | null;
  reminder_completed: boolean;
  reminder_snoozed_until: string | null;
  created_at: string;
  updated_at: string;
  checklist_items: ChecklistItem[];
  labels: Label[];
  is_shared?: boolean;
  shared_with_current_user?: boolean;
  current_user_share_id?: number;
  current_user_access_level?: 'read' | 'edit';
  _offline?: boolean;
  _operationId?: string;
}

export type RootStackParamList = {
  ServerSetup: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  NoteEditor: { noteId: number | string };
};

export type MainTabParamList = {
  Notes: undefined;
  Archived: undefined;
};
