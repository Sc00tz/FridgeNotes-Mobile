import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Label } from '../types';

interface Props {
  labels: Label[];
  maxVisible?: number;
}

export const LabelBadges: React.FC<Props> = ({ labels, maxVisible = 3 }) => {
  if (!labels || labels.length === 0) return null;

  const visible = labels.slice(0, maxVisible);
  const overflow = labels.length - maxVisible;

  return (
    <View style={styles.row}>
      {visible.map(label => (
        <View
          key={label.id}
          style={[styles.badge, { backgroundColor: label.color + '33', borderColor: label.color + '88' }]}
        >
          <Text style={[styles.badgeText, { color: label.color }]} numberOfLines={1}>
            {label.display_name}
          </Text>
        </View>
      ))}
      {overflow > 0 && (
        <View style={styles.overflow}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 100,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  overflow: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overflowText: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
