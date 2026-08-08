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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
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
  <TouchableRipple style={[styles.tab, active ? styles.tabActive : null]} onPress={onPress}>
    <Text
      variant="labelLarge"
      numberOfLines={1}
      style={[styles.tabLabel, active ? { color: activeColor, fontWeight: '700' } : null]}
    >
      {label}
    </Text>
  </TouchableRipple>
);

const styles = StyleSheet.create({
  // height cố định trên cả ScrollView và tab — nếu chỉ dùng paddingVertical,
  // trên web hàng tab đổi chiều cao tuỳ tab nào đang bold (fontWeight khác nhau
  // ra line-height khác nhau), gây giật khi đổi tab. flexShrink: 0 để không bị
  // co nhỏ khi container cha thiếu chiều cao (vd xoay ngang màn hình trên web).
  scroll: { height: 48, flexGrow: 0, flexShrink: 0 },
  container: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab: { height: 36, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
  // Nền tint nhạt cho tab đang chọn — cùng convention với SettingsSidebar's
  // itemActive. fontWeight một mình không đủ tin cậy để phân biệt trạng thái
  // trên web (tuỳ font đã tải), nên cần thêm tín hiệu nền làm chính.
  tabActive: { backgroundColor: '#EFF6FF' },
  tabLabel: { color: '#6B7280', lineHeight: 18 },
});
