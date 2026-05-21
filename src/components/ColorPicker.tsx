import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Text } from 'react-native';

export const NOTE_COLORS: Record<string, { background: string; border: string; text: string; label: string }> = {
  default:  { background: '#1f2937', border: '#374151', text: '#f9fafb', label: 'Default' },
  coral:    { background: '#7f1d1d', border: '#dc2626', text: '#fef2f2', label: 'Coral' },
  peach:    { background: '#7c2d12', border: '#ea580c', text: '#fff7ed', label: 'Peach' },
  sand:     { background: '#854d0e', border: '#ca8a04', text: '#fefce8', label: 'Sand' },
  mint:     { background: '#134e4a', border: '#0d9488', text: '#f0fdfa', label: 'Mint' },
  sage:     { background: '#14532d', border: '#16a34a', text: '#f0fdf4', label: 'Sage' },
  fog:      { background: '#1e3a5f', border: '#3b82f6', text: '#eff6ff', label: 'Fog' },
  storm:    { background: '#374151', border: '#6b7280', text: '#f9fafb', label: 'Storm' },
  dusk:     { background: '#4a1d96', border: '#8b5cf6', text: '#faf5ff', label: 'Dusk' },
  blossom:  { background: '#831843', border: '#ec4899', text: '#fdf2f8', label: 'Blossom' },
  clay:     { background: '#451a03', border: '#92400e', text: '#fff7ed', label: 'Clay' },
  chalk:    { background: '#365314', border: '#65a30d', text: '#f7fee7', label: 'Chalk' },
};

export const getColor = (colorValue: string) => NOTE_COLORS[colorValue] ?? NOTE_COLORS.default;

const COLOR_KEYS = Object.keys(NOTE_COLORS);

interface Props {
  currentColor: string;
  onColorChange: (color: string) => void;
}

export const ColorPicker: React.FC<Props> = ({ currentColor, onColorChange }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.row}
  >
    {COLOR_KEYS.map(key => {
      const c = NOTE_COLORS[key];
      const isSelected = key === currentColor;
      return (
        <TouchableOpacity
          key={key}
          onPress={() => onColorChange(key)}
          style={[
            styles.swatch,
            { backgroundColor: c.background, borderColor: c.border },
            isSelected && styles.swatchSelected,
          ]}
          activeOpacity={0.7}
        >
          {isSelected && <Text style={[styles.check, { color: c.text }]}>✓</Text>}
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  check: {
    fontSize: 14,
    fontWeight: '700',
  },
});
