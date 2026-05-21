import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { saveServerUrl } from '../lib/config';

interface Props {
  onComplete: () => void;
}

export const ServerSetupScreen: React.FC<Props> = ({ onComplete }) => {
  const [url, setUrl] = useState('http://');
  const [testing, setTesting] = useState(false);

  const handleConnect = async () => {
    const trimmed = url.trim().replace(/\/$/, '');

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('Invalid URL', 'URL must start with http:// or https://');
      return;
    }

    setTesting(true);
    try {
      // Hit the auth check endpoint to verify the server is reachable
      const response = await fetch(`${trimmed}/api/auth/check`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok && response.status !== 200 && response.status !== 401) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Valid FridgeNotes server — save and proceed
      await saveServerUrl(trimmed);
      onComplete();
    } catch (err: any) {
      Alert.alert(
        'Could not connect',
        `Make sure:\n• Your phone is on the same network as the server\n• The URL is correct\n• FridgeNotes is running\n\nError: ${err.message}`,
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>FridgeNotes</Text>
        <Text style={styles.subtitle}>Connect to your server</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.100:5009"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleConnect}
          />
          <Text style={styles.hint}>
            This is the IP address and port of your FridgeNotes server.{'\n'}
            Your phone must be on the same network.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, testing && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={testing}
        >
          {testing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Connect</Text>
          }
        </TouchableOpacity>

        <View style={styles.examples}>
          <Text style={styles.examplesTitle}>Examples</Text>
          {[
            'http://192.168.1.100:5009',
            'http://192.168.66.73:5009',
            'https://notes.yourdomain.com',
          ].map(example => (
            <TouchableOpacity key={example} onPress={() => setUrl(example)}>
              <Text style={styles.exampleUrl}>{example}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f9fafb',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#f9fafb',
    marginBottom: 12,
  },
  hint: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  examples: {
    gap: 8,
  },
  examplesTitle: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  exampleUrl: {
    color: '#60a5fa',
    fontSize: 14,
    paddingVertical: 4,
  },
});
