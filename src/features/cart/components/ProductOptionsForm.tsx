import React from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Checkbox, IconButton, RadioButton, Text } from 'react-native-paper';
import { AppInput } from '../../../components/AppInput';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { OptionGroupViewModel } from '../../catalog/types/catalog.types';
import type { OptionSelectionState } from '../hooks/useOptionSelection';

export interface ProductOptionsFormProps {
  imageUrl: string | null;
  title: string;
  priceLabel: string;
  optionGroups: OptionGroupViewModel[];
  selection: OptionSelectionState;
  onToggleSingle: (groupId: number, optionId: number) => void;
  onToggleMulti: (group: OptionGroupViewModel, optionId: number) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  note: string;
  onNoteChange: (note: string) => void;
  confirmButton: React.ReactNode;
}

/**
 * Phần nội dung dùng chung giữa CartItemEditModal và OptionSelectionModal —
 * header (ảnh/tên/giá) + danh sách option group + stepper số lượng + ghi
 * chú. Mỗi modal tự bọc component này trong Portal/Modal của riêng nó (điều
 * kiện `visible` khác nhau: `item !== null` so với `product !== null`) và
 * tự cung cấp nút xác nhận riêng (nhãn/hành động khác nhau).
 */
export const ProductOptionsForm: React.FC<ProductOptionsFormProps> = ({
  imageUrl,
  title,
  priceLabel,
  optionGroups,
  selection,
  onToggleSingle,
  onToggleMulti,
  quantity,
  onQuantityChange,
  note,
  onNoteChange,
  confirmButton,
}) => (
  <>
    <View style={styles.header}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.headerImage} resizeMode="cover" />
      ) : (
        <View style={styles.headerImagePlaceholder}>
          <Text variant="titleMedium">🧋</Text>
        </View>
      )}
      <View style={styles.headerInfo}>
        <Text variant="titleMedium" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={styles.headerPrice}>
          {priceLabel}
        </Text>
      </View>
    </View>
    <ScrollView style={styles.groups}>
      {optionGroups.map((group) => (
        <View key={group.groupId} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text variant="titleSmall">{group.groupName}</Text>
            {group.isRequired ? (
              <Text variant="labelSmall" style={styles.requiredBadge}>
                Bắt buộc
              </Text>
            ) : null}
          </View>
          {group.uiType === 'SingleSelect' ? (
            <RadioButton.Group
              value={String(selection[group.groupId]?.[0] ?? '')}
              onValueChange={(value) => onToggleSingle(group.groupId, Number(value))}
            >
              {group.options.map((option) => (
                <RadioButton.Item
                  key={option.id}
                  label={option.price ? `${option.name} (+${formatCurrency(option.price)})` : option.name}
                  value={String(option.id)}
                  disabled={!option.isAvailable}
                />
              ))}
            </RadioButton.Group>
          ) : (
            group.options.map((option) => {
              const checked = (selection[group.groupId] ?? []).includes(option.id);
              const reachedMax = (selection[group.groupId]?.length ?? 0) >= group.maxSelect;
              return (
                <Checkbox.Item
                  key={option.id}
                  label={option.price ? `${option.name} (+${formatCurrency(option.price)})` : option.name}
                  status={checked ? 'checked' : 'unchecked'}
                  disabled={!option.isAvailable || (!checked && reachedMax)}
                  onPress={() => onToggleMulti(group, option.id)}
                />
              );
            })
          )}
        </View>
      ))}
    </ScrollView>
    <View style={styles.footer}>
      <View style={styles.quantityRow}>
        <Text variant="titleSmall">Số lượng</Text>
        <View style={styles.stepper}>
          <IconButton
            icon="minus"
            mode="outlined"
            size={18}
            disabled={quantity <= 1}
            onPress={() => onQuantityChange(Math.max(1, quantity - 1))}
          />
          <Text variant="titleMedium">{quantity}</Text>
          <IconButton icon="plus" mode="outlined" size={18} onPress={() => onQuantityChange(quantity + 1)} />
        </View>
      </View>
      <AppInput label="Ghi chú" value={note} onChangeText={onNoteChange} multiline maxLength={500} />
      {confirmButton}
    </View>
  </>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerImage: { width: 40, height: 40, borderRadius: 6 },
  headerImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerPrice: { color: '#111827', marginTop: 2 },
  groups: { flexGrow: 0, paddingHorizontal: 16 },
  group: { marginBottom: 12, marginTop: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requiredBadge: { color: '#EF4444' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    padding: 16,
    gap: 8,
  },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
});
