// src/features/catalog/components/CategoryTabs.tsx
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { ALL_CATEGORY_ID } from '../types/catalog.types';
import type { CategorySelection, CategoryViewModel } from '../types/catalog.types';

export interface CategoryTabsProps {
  categories: CategoryViewModel[];
  selectedCategoryId: CategorySelection;
  onSelect: (categoryId: CategorySelection) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ categories, selectedCategoryId, onSelect }) => {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      <Tab
        label="Tất cả"
        active={selectedCategoryId === ALL_CATEGORY_ID}
        activeColor={theme.colors.primary}
        onPress={() => onSelect(ALL_CATEGORY_ID)}
      />
      {categories.map((category) => (
        <Tab
          key={category.id}
          label={category.name}
          active={selectedCategoryId === category.id}
          activeColor={theme.colors.primary}
          onPress={() => onSelect(category.id)}
        />
      ))}
    </ScrollView>
  );
};

interface TabProps {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}

const Tab: React.FC<TabProps> = ({ label, active, activeColor, onPress }) => (
  <TouchableRipple style={styles.tab} onPress={onPress}>
    <Text variant="labelLarge" style={active ? { color: activeColor, fontWeight: '700' } : styles.tabLabel}>
      {label}
    </Text>
  </TouchableRipple>
);

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 4, gap: 8, alignItems: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  tabLabel: { color: '#6B7280' },
});
