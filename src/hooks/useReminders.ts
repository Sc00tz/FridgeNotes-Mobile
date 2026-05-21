/**
 * useReminders
 *
 * Manages reminder scheduling via expo-notifications.
 * - Requests permission on first use
 * - Schedules a local notification at the reminder datetime
 * - Cancels/reschedules on update
 * - Persists note→notificationId mapping in AsyncStorage so
 *   reminders survive app restarts
 * - Exposes completeReminder and snoozeReminder that call the API
 *   and then update/cancel the local notification
 */

import { useState, useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiClient } from '../lib/api';
import { Note } from '../types';

const NOTIF_MAP_KEY = 'fridgenotes_reminder_notifications';

// How notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type NotifMap = Record<string | number, string>; // noteId → notificationId

const loadNotifMap = async (): Promise<NotifMap> => {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveNotifMap = async (map: NotifMap) => {
  await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map)).catch(() => {});
};

export const useReminders = () => {
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Request permission and set up the default notification channel on Android
  useEffect(() => {
    const setup = async () => {
      if (!Device.isDevice) return; // Simulator — notifications don't work

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3b82f6',
        });
      }

      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') {
        setPermissionGranted(true);
        return;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionGranted(status === 'granted');
    };

    setup();
  }, []);

  const scheduleReminder = useCallback(async (note: Note) => {
    if (!note.reminder_datetime || note.reminder_completed) return;
    if (!permissionGranted) return;

    const triggerDate = new Date(note.reminder_datetime);
    if (triggerDate <= new Date()) return; // Already in the past

    const map = await loadNotifMap();

    // Cancel any existing notification for this note first
    if (map[note.id]) {
      await Notifications.cancelScheduledNotificationAsync(map[note.id]).catch(() => {});
    }

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: note.title || 'FridgeNotes Reminder',
        body: note.note_type === 'checklist'
          ? `${note.checklist_items?.filter(i => !i.completed).length ?? 0} items remaining`
          : (note.content?.slice(0, 80) ?? 'Your reminder is ready'),
        data: { noteId: note.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    map[note.id] = notifId;
    await saveNotifMap(map);
  }, [permissionGranted]);

  const cancelReminder = useCallback(async (noteId: number | string) => {
    const map = await loadNotifMap();
    if (map[noteId]) {
      await Notifications.cancelScheduledNotificationAsync(map[noteId]).catch(() => {});
      delete map[noteId];
      await saveNotifMap(map);
    }
  }, []);

  const completeReminder = useCallback(async (noteId: number | string) => {
    await cancelReminder(noteId);
    await apiClient.completeReminder(noteId);
  }, [cancelReminder]);

  const snoozeReminder = useCallback(async (note: Note, minutes: number) => {
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);

    // Cancel the fired notification and reschedule at snooze time
    await cancelReminder(note.id);

    if (permissionGranted) {
      const map = await loadNotifMap();
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: note.title || 'FridgeNotes Reminder',
          body: `Snoozed — ${minutes}m reminder`,
          data: { noteId: note.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: snoozeUntil,
        },
      });
      map[note.id] = notifId;
      await saveNotifMap(map);
    }
  }, [cancelReminder, permissionGranted]);

  return {
    permissionGranted,
    scheduleReminder,
    cancelReminder,
    completeReminder,
    snoozeReminder,
  };
};
