import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Keyboard,
} from 'react-native';

// Common grocery/household items bundled in the app so suggestions work
// even before the user has added anything.
const COMMON_ITEMS = [
  'Apples', 'Bananas', 'Oranges', 'Grapes', 'Strawberries', 'Blueberries',
  'Tomatoes', 'Onions', 'Garlic', 'Potatoes', 'Carrots', 'Celery',
  'Bell peppers', 'Broccoli', 'Spinach', 'Lettuce', 'Cucumber', 'Avocados',
  'Mushrooms', 'Zucchini', 'Milk', 'Eggs', 'Butter', 'Cheese', 'Yogurt',
  'Sour cream', 'Heavy cream', 'Chicken breast', 'Ground beef', 'Salmon',
  'Shrimp', 'Bacon', 'Bread', 'Rice', 'Pasta', 'Flour', 'Sugar', 'Salt',
  'Black pepper', 'Olive oil', 'Baking soda', 'Baking powder', 'Honey',
  'Peanut butter', 'Canned tomatoes', 'Chicken broth', 'Canned beans',
  'Tuna', 'Cereal', 'Coffee', 'Tea', 'Juice', 'Toilet paper', 'Paper towels',
  'Dish soap', 'Laundry detergent', 'Shampoo', 'Toothpaste',
];

function getMatchScore(item: string, query: string): number {
  const i = item.toLowerCase();
  const q = query.toLowerCase();
  if (i === q) return 1000;
  if (i.startsWith(q)) return 500;
  if (i.includes(q)) return 100;
  return 0;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSelect: (text: string) => void;
  placeholder?: string;
  userSuggestions?: string[];
  textColor: string;
  borderColor: string;
  backgroundColor: string;
}

export const ChecklistItemAutocomplete: React.FC<Props> = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Add item…',
  userSuggestions = [],
  textColor,
  borderColor,
  backgroundColor,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase().trim();

    const userMatches = userSuggestions
      .filter(s => s.toLowerCase().includes(q))
      .map(s => ({ text: s, score: getMatchScore(s, q) + 100 }));

    const commonMatches = COMMON_ITEMS
      .filter(s => s.toLowerCase().includes(q))
      .map(s => ({ text: s, score: getMatchScore(s, q) }));

    const seen = new Set<string>();
    return [...userMatches, ...commonMatches]
      .filter(({ text }) => {
        const key = text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(i => i.text);
  }, [value, userSuggestions]);

  const handleSelect = (text: string) => {
    onSelect(text);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onSelect(value.trim());
      setShowSuggestions(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={text => {
          onChange(text);
          setShowSuggestions(text.length > 0);
        }}
        onFocus={() => setShowSuggestions(value.length > 0)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onSubmitEditing={handleSubmit}
        placeholder={placeholder}
        placeholderTextColor={textColor + '50'}
        style={[styles.input, { color: textColor }]}
        returnKeyType="done"
        blurOnSubmit={false}
      />

      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor, borderColor }]}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="always"
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestion, { borderBottomColor: borderColor }]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[styles.suggestionText, { color: textColor }]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 10,
  },
  input: {
    fontSize: 16,
    padding: 0,
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: -36, // extend left to align with the checkbox
    right: -40, // extend right to match row width
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 20,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 15,
  },
});
