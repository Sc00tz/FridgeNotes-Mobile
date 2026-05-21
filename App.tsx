import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { RootNavigator, navigationRef } from './src/navigation/RootNavigator';

export default function App() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Banner is handled automatically by setNotificationHandler in useReminders.
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const noteId = response.notification.request.content.data?.noteId as number | string | undefined;
      if (!noteId) return;

      // Navigate to the note editor. The ref may not be ready yet if the app
      // is cold-launching from a notification tap, so we poll briefly.
      const tryNavigate = (attempts = 0) => {
        if (navigationRef.current?.isReady()) {
          navigationRef.current.navigate('NoteEditor', { noteId });
        } else if (attempts < 10) {
          setTimeout(() => tryNavigate(attempts + 1), 200);
        }
      };
      tryNavigate();
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
