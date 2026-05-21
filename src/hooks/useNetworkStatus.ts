import { useState, useEffect, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean | null;
  connectionType: string | null;
}

/**
 * Tracks network connectivity and fires `onReconnect` exactly once when
 * the device transitions from offline → online.
 */
export const useNetworkStatus = (onReconnect?: () => void) => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isConnected: null,
    connectionType: null,
  });

  // Track previous online state so we only fire onReconnect on the transition
  const wasOnline = useRef(true);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const nowOnline = !!(state.isConnected && state.isInternetReachable !== false);

      setStatus({
        isOnline: nowOnline,
        isConnected: state.isConnected,
        connectionType: state.type,
      });

      if (nowOnline && !wasOnline.current) {
        // Give the network stack a moment to stabilise before syncing
        setTimeout(() => onReconnectRef.current?.(), 1000);
      }

      wasOnline.current = nowOnline;
    });

    // Fetch initial state
    NetInfo.fetch().then((state: NetInfoState) => {
      const nowOnline = !!(state.isConnected && state.isInternetReachable !== false);
      wasOnline.current = nowOnline;
      setStatus({
        isOnline: nowOnline,
        isConnected: state.isConnected,
        connectionType: state.type,
      });
    });

    return unsubscribe;
  }, []);

  return status;
};
