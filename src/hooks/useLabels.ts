import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';
import { Label, User } from '../types';

export const useLabels = (currentUser: User | null, isAuthenticated: boolean) => {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }, []);

  const loadLabels = useCallback(async () => {
    if (!isAuthenticated || !currentUser) return;
    try {
      setLoading(true);
      const data = await apiClient.getLabels();
      setLabels(data);
    } catch (err: any) {
      showError('Failed to load labels: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentUser, showError]);

  useEffect(() => {
    if (isAuthenticated && currentUser) loadLabels();
    else setLabels([]);
  }, [isAuthenticated, currentUser, loadLabels]);

  const createLabel = useCallback(async (name: string, color: string) => {
    try {
      const label = await apiClient.createLabel({ name, color });
      setLabels(prev => [label, ...prev]);
      return label;
    } catch (err: any) {
      showError('Failed to create label: ' + err.message);
      throw err;
    }
  }, [showError]);

  const addLabelToNote = useCallback(async (noteId: number | string, labelId: number) => {
    try {
      await apiClient.addLabelToNote(noteId, labelId);
    } catch (err: any) {
      showError('Failed to add label: ' + err.message);
      throw err;
    }
  }, [showError]);

  const removeLabelFromNote = useCallback(async (noteId: number | string, labelId: number) => {
    try {
      await apiClient.removeLabelFromNote(noteId, labelId);
    } catch (err: any) {
      // 404 / already-removed is fine — swallow silently
      if (!err.message.includes('404') && !err.message.includes('not found')) {
        showError('Failed to remove label: ' + err.message);
        throw err;
      }
    }
  }, [showError]);

  return {
    labels,
    loading,
    error,
    loadLabels,
    createLabel,
    addLabelToNote,
    removeLabelFromNote,
  };
};
