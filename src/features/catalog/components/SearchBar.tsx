// src/features/catalog/components/SearchBar.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Searchbar } from 'react-native-paper';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText }) => (
  <Searchbar
    placeholder="Tìm món, mã món..."
    placeholderTextColor="#6B7280"
    value={value}
    onChangeText={onChangeText}
    style={styles.searchbar}
    inputStyle={styles.input}
  />
);

const styles = StyleSheet.create({
  searchbar: { height: 40, marginHorizontal: 16 },
  // Paper's Searchbar hard-codes minHeight: 56 on its internal input (bar mode) —
  // without overriding it here, the input stays 56dp tall even though the outer
  // bar was forced down to 40dp, so the input overflows/looks taller than the bar.
  input: { minHeight: 40, paddingVertical: 0 },
});
