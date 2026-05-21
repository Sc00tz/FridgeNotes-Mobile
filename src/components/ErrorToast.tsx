import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';

interface Props {
  message: string | null;
}

/**
 * Slides up from the bottom when `message` is non-null, then disappears.
 * Pairs with useNotes' error state which auto-clears after 5 s.
 */
export const ErrorToast: React.FC<Props> = ({ message }) => {
  const translateY = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    if (message) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: 80,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [message, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.toast, { transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  text: { color: '#fef2f2', fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
