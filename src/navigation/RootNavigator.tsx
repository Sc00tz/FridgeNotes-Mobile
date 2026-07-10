import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../types';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { NoteEditorScreen } from '../screens/NoteEditorScreen';
import { ServerSetupScreen } from '../screens/ServerSetupScreen';
import { ShareReceiverScreen } from '../screens/ShareReceiverScreen';
import { useAuth } from '../hooks/useAuth';
import { useNotes } from '../hooks/useNotes';
import { useLabels } from '../hooks/useLabels';
import { useShare } from '../hooks/useShare';
import { useReminders } from '../hooks/useReminders';
import { useAutocomplete } from '../hooks/useAutocomplete';
import { getServerUrl, clearServerUrl } from '../lib/config';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ErrorToast } from '../components/ErrorToast';
import * as Linking from 'expo-linking';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Exported so App.tsx can call navigate() from outside the React tree
// (e.g. when the user taps a notification from the lock screen).
export const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

const MainTabs: React.FC<{
  notes: ReturnType<typeof useNotes>;
  auth: ReturnType<typeof useAuth>;
  autocomplete: ReturnType<typeof useAutocomplete>;
  reminders: ReturnType<typeof useReminders>;
  onChangeServer: () => void;
}> = ({ notes, auth, autocomplete, reminders, onChangeServer }) => {
  // Sync autocomplete learning whenever notes change
  useEffect(() => {
    if (notes.notes.length > 0) autocomplete.learnFromNotes(notes.notes);
  }, [notes.notes]);

  // Re-schedule any future reminders when notes are loaded
  useEffect(() => {
    if (!reminders.permissionGranted) return;
    notes.notes
      .filter(n => n.reminder_datetime && !n.reminder_completed)
      .forEach(n => reminders.scheduleReminder(n));
  }, [notes.notes, reminders.permissionGranted]);

  const sharedNotesScreenProps = {
    notes: notes.notes,
    currentUser: auth.currentUser!,
    loading: notes.loading,
    onLogout: auth.logout,
    onChangeServer,
    onRefresh: notes.loadNotes,
    onCreateNote: async (type: 'text' | 'checklist') =>
      notes.createNote({
        title: '',
        note_type: type,
        content: type === 'text' ? '' : undefined,
        checklist_items: type === 'checklist' ? [] : undefined,
      }),
    onUpdateNote: notes.updateNote,
    onDeleteNote: notes.deleteNote,
    onUpdateChecklistItem: notes.updateChecklistItem,
    onPinToggle: notes.pinToggle,
    isOnline: notes.isOnline,
    queueSize: notes.queueSize,
    isSyncing: notes.isSyncing,
    syncError: notes.syncError,
    onForceSync: notes.flushQueue,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#1f2937' },
        tabBarActiveTintColor: '#60a5fa',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tab.Screen
        name="Notes"
        options={{
          tabBarLabel: 'Notes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📝</Text>,
        }}
      >
        {() => <NotesScreen {...sharedNotesScreenProps} showArchived={false} />}
      </Tab.Screen>

      <Tab.Screen
        name="Archived"
        options={{
          tabBarLabel: 'Archived',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📦</Text>,
        }}
      >
        {() => <NotesScreen {...sharedNotesScreenProps} showArchived={true} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);
  const auth = useAuth();
  const notes = useNotes(auth.currentUser, auth.isAuthenticated);
  const labels = useLabels(auth.currentUser, auth.isAuthenticated);
  const share = useShare();
  const reminders = useReminders();
  const autocomplete = useAutocomplete(auth.currentUser);

  // Check for saved server URL before doing anything else
  useEffect(() => {
    getServerUrl().then(url => {
      setServerConfigured(!!url);
      if (url) auth.checkAuthStatus();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle incoming share intents — fired when the user shares text to FridgeNotes
  // from another app while FridgeNotes is already running.
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const parsed = Linking.parse(event.url);
      const text = parsed.queryParams?.text as string | undefined;
      if (text && navigationRef.current?.isReady()) {
        navigationRef.current.navigate('ShareReceiver', { text });
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);

    // Also handle the case where the app was cold-launched via a share intent
    Linking.getInitialURL().then(url => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const text = parsed.queryParams?.text as string | undefined;
      if (text) {
        const tryNavigate = (attempts = 0) => {
          if (navigationRef.current?.isReady()) {
            navigationRef.current.navigate('ShareReceiver', { text });
          } else if (attempts < 15) {
            setTimeout(() => tryNavigate(attempts + 1), 200);
          }
        };
        tryNavigate();
      }
    });

    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show splash spinner until we know whether a server URL is saved
  if (serverConfigured === null || (auth.loading && !auth.currentUser && serverConfigured)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!serverConfigured ? (
            <Stack.Screen name="ServerSetup">
              {() => (
                <ServerSetupScreen
                  onComplete={() => {
                    setServerConfigured(true);
                    auth.checkAuthStatus();
                  }}
                />
              )}
            </Stack.Screen>
          ) : auth.isAuthenticated && auth.currentUser ? (
            <>
              <Stack.Screen name="Main">
                {() => (
                  <MainTabs
                    notes={notes}
                    auth={auth}
                    autocomplete={autocomplete}
                    reminders={reminders}
                    onChangeServer={async () => {
                      await auth.logout();
                      await clearServerUrl();
                      setServerConfigured(false);
                    }}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen
                name="NoteEditor"
                options={{ animation: 'slide_from_bottom' }}
              >
                {({ route, navigation }) => {
                  const note = notes.notes.find(n => n.id === route.params.noteId);
                  if (!note) return (
                    <View style={{ flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#9ca3af' }}>Note not found</Text>
                    </View>
                  );
                  return (
                    <NoteEditorScreen
                      route={route as any}
                      navigation={navigation as any}
                      note={note}
                      onUpdate={notes.updateNote}
                      onDelete={notes.deleteNote}
                      onUpdateChecklistItem={notes.updateChecklistItem}
                      userSuggestions={autocomplete.suggestions}
                      onAddAutocompleteItem={autocomplete.addItem}
                      allLabels={labels.labels}
                      onAddLabel={async (noteId, labelId) => {
                        await labels.addLabelToNote(noteId, labelId);
                        // Optimistically add the label to local note state
                        const label = labels.labels.find(l => l.id === labelId);
                        if (label) {
                          notes.setNotes(prev => prev.map(n =>
                            n.id === noteId
                              ? { ...n, labels: [...(n.labels ?? []), label] }
                              : n
                          ));
                        }
                      }}
                      onRemoveLabel={async (noteId, labelId) => {
                        await labels.removeLabelFromNote(noteId, labelId);
                        notes.setNotes(prev => prev.map(n =>
                          n.id === noteId
                            ? { ...n, labels: (n.labels ?? []).filter(l => l.id !== labelId) }
                            : n
                        ));
                      }}
                      onCreateLabel={labels.createLabel}
                      onShare={share.shareNote}
                      onUnshare={share.unshareNote}
                      onGetShares={share.getShares}
                      shareLoading={share.loading}
                      onSetReminder={async (noteId, iso) => {
                        const updated = await notes.updateNote(noteId, { reminder_datetime: iso, reminder_completed: false });
                        await reminders.scheduleReminder(updated);
                      }}
                      onClearReminder={async (noteId) => {
                        await notes.updateNote(noteId, { reminder_datetime: null, reminder_completed: false });
                        await reminders.cancelReminder(noteId);
                      }}
                    />
                  );
                }}
              </Stack.Screen>
            </>
          ) : (
            <>
              <Stack.Screen name="Login">
                {props => <LoginScreen {...props} onLogin={auth.login} />}
              </Stack.Screen>
              <Stack.Screen name="Register">
                {props => <RegisterScreen {...props} onRegister={auth.register} />}
              </Stack.Screen>
            </>
          )}

          {/* Share receiver — presented as a modal over any screen when another
              app shares text to FridgeNotes. Only functional when authenticated. */}
          {auth.isAuthenticated && (
            <Stack.Screen
              name="ShareReceiver"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            >
              {({ route, navigation }) => (
                <ShareReceiverScreen
                  route={route as any}
                  navigation={navigation as any}
                  onCreateNote={notes.createNote}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* Overlays rendered outside NavigationContainer so they appear above all screens */}
      {auth.isAuthenticated && (
        <ConnectionBanner
          isOnline={notes.isOnline}
          queueSize={notes.queueSize}
          isSyncing={notes.isSyncing}
        />
      )}
      <ErrorToast message={notes.error} />
    </View>
  );
};
