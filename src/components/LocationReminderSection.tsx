import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { apiClient } from '../lib/api';
import { Note, GeocodeResult } from '../types';

/**
 * Location-based reminder editor: search an address/business (server-proxied
 * geocoding), use current GPS location, and set a trigger radius. Geofence
 * triggering itself is OS-side; this captures the target the server stores.
 *
 * Reports the four reminder_location_* fields (or nulls to clear) via onChange.
 */
interface Props {
  note: Note;
  onChange: (fields: Partial<Note>) => void;
  textColor: string;
  borderColor: string;
}

const RADIUS_OPTIONS = [100, 200, 500, 1000];

export const LocationReminderSection: React.FC<Props> = ({ note, onChange, textColor, borderColor }) => {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const hasLocation = note.reminder_latitude != null && note.reminder_longitude != null;
  const radius = note.reminder_radius ?? 200;

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await apiClient.geocode(query);
      if (!res.length) Alert.alert('No matches', 'No places found for that search.');
      setResults(res);
    } catch (e: any) {
      Alert.alert('Search failed', e?.message ?? 'Location search is unavailable');
    } finally {
      setSearching(false);
    }
  };

  const pick = (r: GeocodeResult) => {
    onChange({
      reminder_latitude: r.latitude,
      reminder_longitude: r.longitude,
      reminder_radius: radius,
      reminder_location_name: (r.name || '').split(',')[0],
    });
    setResults([]);
    setQuery('');
    setExpanded(false);
  };

  const useCurrent = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow location access.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      onChange({
        reminder_latitude: pos.coords.latitude,
        reminder_longitude: pos.coords.longitude,
        reminder_radius: radius,
        reminder_location_name: note.reminder_location_name || 'Current location',
      });
      setExpanded(false);
    } catch (e: any) {
      Alert.alert('Location failed', e?.message ?? 'Could not get your location');
    } finally {
      setLocating(false);
    }
  };

  const clear = () => {
    onChange({
      reminder_latitude: null,
      reminder_longitude: null,
      reminder_radius: null,
      reminder_location_name: null,
    });
    setExpanded(false);
  };

  const setRadius = (r: number) => {
    onChange({
      reminder_latitude: note.reminder_latitude,
      reminder_longitude: note.reminder_longitude,
      reminder_radius: r,
      reminder_location_name: note.reminder_location_name,
    });
  };

  return (
    <View style={[styles.container, { borderColor }]}>
      {hasLocation ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summary, { color: textColor }]} numberOfLines={1}>
            📍 {note.reminder_location_name ||
              `${note.reminder_latitude!.toFixed(4)}, ${note.reminder_longitude!.toFixed(4)}`}
            {note.reminder_radius ? ` · ${note.reminder_radius}m` : ''}
          </Text>
          <TouchableOpacity onPress={() => setExpanded(v => !v)}>
            <Text style={[styles.link, { color: textColor }]}>{expanded ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.link, { color: '#dc2626' }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setExpanded(v => !v)}>
          <Text style={[styles.addText, { color: textColor }]}>📍  Add location reminder</Text>
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.editor}>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder="Search address or place"
              placeholderTextColor={textColor + '60'}
              style={[styles.input, { color: textColor, borderColor }]}
              returnKeyType="search"
            />
            <TouchableOpacity onPress={search} style={[styles.searchBtn, { borderColor }]} disabled={searching}>
              {searching
                ? <ActivityIndicator size="small" color={textColor} />
                : <Text style={[styles.link, { color: textColor }]}>Search</Text>}
            </TouchableOpacity>
          </View>

          {results.map((r, i) => (
            <TouchableOpacity key={i} onPress={() => pick(r)} style={[styles.result, { borderColor }]}>
              <Text style={[styles.resultText, { color: textColor }]} numberOfLines={2}>{r.name}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={useCurrent} style={[styles.currentBtn, { borderColor }]} disabled={locating}>
            {locating
              ? <ActivityIndicator size="small" color={textColor} />
              : <Text style={[styles.link, { color: textColor }]}>◎  Use my current location</Text>}
          </TouchableOpacity>

          <Text style={[styles.radiusLabel, { color: textColor + '80' }]}>Trigger radius</Text>
          <View style={styles.radiusRow}>
            {RADIUS_OPTIONS.map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setRadius(r)}
                style={[
                  styles.radiusChip,
                  { borderColor },
                  radius === r && { backgroundColor: textColor + '20' },
                ]}
              >
                <Text style={[styles.radiusText, { color: textColor }]}>{r}m</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 16, borderWidth: 1, borderRadius: 8, padding: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { flex: 1, fontSize: 14, fontWeight: '500' },
  link: { fontSize: 14, fontWeight: '600' },
  addText: { fontSize: 14, fontWeight: '500' },
  editor: { marginTop: 12, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  searchBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  result: { borderWidth: 1, borderRadius: 8, padding: 10 },
  resultText: { fontSize: 13 },
  currentBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  radiusLabel: { fontSize: 12, marginTop: 4 },
  radiusRow: { flexDirection: 'row', gap: 8 },
  radiusChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  radiusText: { fontSize: 13 },
});
