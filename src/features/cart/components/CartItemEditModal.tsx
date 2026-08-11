// src/features/cart/components/CartItemEditModal.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Checkbox, IconButton, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { formatCurrency } from '../../../utils/formatCurrency';
import { CartService } from '../services/CartService';
import type { OptionGroupViewModel, OptionViewModel } from '../../catalog/types/catalog.types';
import type { CartItem, CartItemOption } from '../types/cart.types';

export interface CartItemEditModalProps {
  item: CartItem | null;
  onDismiss: () => void;
  onConfirm: (updated: CartItem) => void;
}

type SelectionState = Record<number, number[]>;

const selectionFromItem = (item: CartItem): SelectionState => {
  const state: SelectionState = {};
  item.optionGroups.forEach((group) => {
    state[group.groupId] = group.options
      .filter((option) => item.options.some((selected) => selected.optionId === option.id))
      .map((option) => option.id);
  });
  return state;
};

export const CartItemEditModal: React.FC<CartItemEditModalProps> = ({ item, onDismiss, onConfirm }) => {
  const [selection, setSelection] = useState<SelectionState>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!item) return;
    setSelection(selectionFromItem(item));
    setQuantity(item.quantity);
    setNote(item.note);
  }, [item]);

  const selectedOptions: CartItemOption[] = item
    ? item.optionGroups.flatMap((group) =>
        (selection[group.groupId] ?? [])
          .map((optionId) => group.options.find((option) => option.id === optionId))
          .filter((option): option is OptionViewModel => option !== undefined)
          .map((option) => ({
            optionId: option.id,
            groupName: group.groupName,
            optionName: option.name,
            price: option.price,
          })),
      )
    : [];

  const canConfirm = item
    ? item.optionGroups.every(
        (group) => !group.isRequired || (selection[group.groupId]?.length ?? 0) >= group.minSelect,
      )
    : false;

  const toggleSingle = (groupId: number, optionId: number): void => {
    setSelection((prev) => ({ ...prev, [groupId]: [optionId] }));
  };

  const toggleMulti = (group: OptionGroupViewModel, optionId: number): void => {
    setSelection((prev) => {
      const current = prev[group.groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.maxSelect) return prev;
      return { ...prev, [group.groupId]: [...current, optionId] };
    });
  };

  const handleConfirm = (): void => {
    if (!item) return;
    const updated = CartService.buildCartItem(
      CartService.cartItemToSourceProduct(item),
      selectedOptions,
      quantity,
      note,
    );
    onConfirm(updated);
  };

  return (
    <Portal>
      <Modal visible={item !== null} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {item ? (
          <>
            <View style={styles.header}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.headerImage} resizeMode="cover" />
              ) : (
                <View style={styles.headerImagePlaceholder}>
                  <Text variant="titleMedium">🧋</Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                <Text variant="titleMedium" numberOfLines={1}>
                  {item.productName}
                </Text>
                <Text variant="bodyMedium" style={styles.headerPrice}>
                  {formatCurrency(item.regularPrice)}
                </Text>
              </View>
            </View>
            <ScrollView style={styles.groups}>
              {item.optionGroups.map((group) => (
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
                      onValueChange={(value) => toggleSingle(group.groupId, Number(value))}
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
                          onPress={() => toggleMulti(group, option.id)}
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
                    onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                  />
                  <Text variant="titleMedium">{quantity}</Text>
                  <IconButton
                    icon="plus"
                    mode="outlined"
                    size={18}
                    onPress={() => setQuantity((current) => current + 1)}
                  />
                </View>
              </View>
              <AppInput label="Ghi chú" value={note} onChangeText={setNote} multiline maxLength={500} />
              <AppButton label="Cập nhật" disabled={!canConfirm} onPress={handleConfirm} />
            </View>
          </>
        ) : null}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 16, borderRadius: 8, maxHeight: '85%' },
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
