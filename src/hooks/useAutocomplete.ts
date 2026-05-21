/**
 * useAutocomplete
 *
 * Ported from the web app's useAutocomplete.js. Learns from checklist items
 * the user has added before and ranks suggestions by frequency + recency.
 * Uses AsyncStorage instead of localStorage.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, User } from '../types';

const STORAGE_KEY_PREFIX = 'fridgenotes_autocomplete_';
const MAX_ITEMS = 500;
const MIN_USAGE_COUNT = 2;

interface AutocompleteItem {
  text: string;
  count: number;
  firstUsed: string;
  lastUsed: string;
}

interface StorageData {
  version: number;
  items: AutocompleteItem[];
  lastUpdated: string;
}

export const useAutocomplete = (currentUser: User | null) => {
  const [userItems, setUserItems] = useState<AutocompleteItem[]>([]);
  const storageKey = currentUser ? `${STORAGE_KEY_PREFIX}${currentUser.id}` : null;

  // Throttle state for learnFromNotes — stored in a ref so it survives re-renders
  // without being a hook dependency.
  const learnThrottleRef = useRef({ lastTime: 0, lastCount: 0 });

  useEffect(() => {
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey).then(stored => {
      if (!stored) return;
      try {
        const data: StorageData = JSON.parse(stored);
        if (data.version === 1 && Array.isArray(data.items)) {
          setUserItems(data.items);
        }
      } catch {}
    });
  }, [storageKey]);

  const saveUserItems = useCallback((items: AutocompleteItem[]) => {
    if (!storageKey) return;
    const data: StorageData = {
      version: 1,
      items: items.slice(0, MAX_ITEMS),
      lastUpdated: new Date().toISOString(),
    };
    AsyncStorage.setItem(storageKey, JSON.stringify(data)).catch(() => {});
  }, [storageKey]);

  const scoreItem = (item: AutocompleteItem) =>
    item.count * 10 + new Date(item.lastUsed).getTime() / 1_000_000;

  const addItem = useCallback((itemText: string) => {
    if (!itemText.trim()) return;
    const normalized = itemText.trim();

    setUserItems(prev => {
      const idx = prev.findIndex(i => i.text.toLowerCase() === normalized.toLowerCase());
      let next: AutocompleteItem[];

      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], count: next[idx].count + 1, lastUsed: new Date().toISOString() };
      } else {
        const now = new Date().toISOString();
        next = [...prev, { text: normalized, count: 1, firstUsed: now, lastUsed: now }];
      }

      next.sort((a, b) => scoreItem(b) - scoreItem(a));
      saveUserItems(next);
      return next;
    });
  }, [saveUserItems]);

  const learnFromNotes = useCallback((notes: Note[]) => {
    if (!notes.length) return;

    const now = Date.now();
    const { lastTime, lastCount } = learnThrottleRef.current;
    if (now - lastTime < 10_000 && Math.abs(notes.length - lastCount) < 5) return;
    learnThrottleRef.current = { lastTime: now, lastCount: notes.length };

    const counts = new Map<string, number>();
    for (const note of notes) {
      if (note.note_type !== 'checklist') continue;
      for (const item of note.checklist_items ?? []) {
        const key = item.text.trim().toLowerCase();
        if (key.length > 1) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    setUserItems(prev => {
      const existingMap = new Map(prev.map(i => [i.text.toLowerCase(), i]));
      const merged: AutocompleteItem[] = [];

      counts.forEach((count, text) => {
        const existing = existingMap.get(text);
        if (existing) {
          merged.push({ ...existing, count: Math.max(existing.count, count) });
        } else if (count >= MIN_USAGE_COUNT) {
          const now = new Date().toISOString();
          merged.push({
            text: text.charAt(0).toUpperCase() + text.slice(1),
            count,
            firstUsed: now,
            lastUsed: now,
          });
        }
      });

      // Re-add items not found in notes
      prev.forEach(item => {
        if (!counts.has(item.text.toLowerCase())) merged.push(item);
      });

      const sorted = merged.sort((a, b) => scoreItem(b) - scoreItem(a)).slice(0, MAX_ITEMS);
      saveUserItems(sorted);
      return sorted;
    });
  }, [saveUserItems]);

  const suggestions = useMemo(
    () => userItems.filter(i => i.count >= MIN_USAGE_COUNT).map(i => i.text),
    [userItems],
  );

  const clearItems = useCallback(() => {
    setUserItems([]);
    if (storageKey) AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  return { suggestions, addItem, learnFromNotes, clearItems };
};
