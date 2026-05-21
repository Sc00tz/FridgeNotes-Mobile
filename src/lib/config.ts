import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'fridgenotes_server_url';

// In-memory cache so every request doesn't hit AsyncStorage
let cachedUrl: string | null = null;

export const getServerUrl = async (): Promise<string | null> => {
  if (cachedUrl) return cachedUrl;
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  if (stored) cachedUrl = stored;
  return stored;
};

export const saveServerUrl = async (url: string): Promise<void> => {
  // Normalise: strip trailing slash
  const normalised = url.trim().replace(/\/$/, '');
  cachedUrl = normalised;
  await AsyncStorage.setItem(SERVER_URL_KEY, normalised);
};

export const clearServerUrl = async (): Promise<void> => {
  cachedUrl = null;
  await AsyncStorage.removeItem(SERVER_URL_KEY);
};

// Synchronous read of the cache — only valid after getServerUrl() has been
// awaited at least once during app startup.
export const getCachedServerUrl = (): string | null => cachedUrl;
