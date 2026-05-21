import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api';

export const useShare = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }, []);

  const shareNote = useCallback(async (
    noteId: number | string,
    username: string,
    accessLevel: 'read' | 'edit',
  ) => {
    try {
      setLoading(true);
      await apiClient.shareNote(noteId, { username, access_level: accessLevel });
    } catch (err: any) {
      showError(err.message || 'Failed to share note');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const unshareNote = useCallback(async (noteId: number | string, shareId: number) => {
    try {
      setLoading(true);
      await apiClient.unshareNote(noteId, shareId);
    } catch (err: any) {
      showError(err.message || 'Failed to remove share');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const getShares = useCallback(async (noteId: number | string) => {
    try {
      return await apiClient.getNoteShares(noteId);
    } catch {
      return [];
    }
  }, []);

  const hideSharedNote = useCallback(async (noteId: number | string, shareId: number) => {
    try {
      await apiClient.hideSharedNote(noteId, shareId);
    } catch (err: any) {
      showError(err.message || 'Failed to hide note');
      throw err;
    }
  }, [showError]);

  return { loading, error, shareNote, unshareNote, getShares, hideSharedNote };
};
