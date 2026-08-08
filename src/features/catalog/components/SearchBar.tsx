// src/features/catalog/components/SearchBar.tsx
import React from 'react';
import { Searchbar } from 'react-native-paper';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText }) => (
  <Searchbar placeholder="Tìm món, mã món..." value={value} onChangeText={onChangeText} />
);
