import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/api';
import { User } from '../types';

const USER_STORAGE_KEY = 'fridgenotes_user';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  // Check stored session on app launch
  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.checkAuth();
      if (response.authenticated && response.user) {
        setCurrentUser(response.user);
        setIsAuthenticated(true);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
      }
      return response;
    } catch {
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (data: {
    username?: string;
    email?: string;
    password: string;
    remember?: boolean;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.login(data);
      setCurrentUser(response.user);
      setIsAuthenticated(true);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      return response;
    } catch (err: any) {
      showError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const register = useCallback(async (data: {
    username: string;
    email: string;
    password: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.register(data);
      setCurrentUser(response.user);
      setIsAuthenticated(true);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      return response;
    } catch (err: any) {
      showError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // Continue logout even if the server call fails
    } finally {
      setCurrentUser(null);
      setIsAuthenticated(false);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  return {
    currentUser,
    isAuthenticated,
    loading,
    error,
    checkAuthStatus,
    login,
    register,
    logout,
  };
};
