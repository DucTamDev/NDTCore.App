// src/features/cart/components/OptionSelectionModal.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Checkbox, IconButton, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { OptionGroupViewModel, OptionViewModel, ProductViewModel } from '../../catalog/types/catalog.types';
import type { CartItemOption } from '../types/cart.types';

export interface OptionSelectionModalProps {
  product: ProductViewModel | null;
  onDismiss: () => void;
  onConfirm: (options: CartItemOption[], quantity: number) => void;
}

type SelectionState = Record<number, number[]>;

const defaultSelection = (group: OptionGroupViewModel): number[] =>
  group.options.filter((option) => option.isDefault).map((option) => option.id);

export const OptionSelectionModal: React.FC<OptionSelectionModalProps> = ({ product, onDismiss, onConfirm }) => {
  const [selection, setSelection] = useState<SelectionState>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    const nextSelection: SelectionState = {};
    product.optionGroups.forEach((group) => {
      nextSelection[group.groupId] = defaultSelection(group);
    });
    setSelection(nextSelection);
    setQuantity(1);
  }, [product]);

  const selectedOptions: CartItemOption[] = product
    ? product.optionGroups.flatMap((group) =>
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

  const canConfirm = product
    ? product.optionGroups.every(
        (group) => !group.isRequired || (selection[group.groupId]?.length ?? 0) >= group.minSelect,
      )
    : false;

  const unitPrice = product ? product.price + selectedOptions.reduce((sum, option) => sum + option.price, 0) : 0;

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

  return (
    <Portal>
      <Modal visible={product !== null} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {product ? (
          <>
            <Text variant="titleMedium" style={styles.title}>
              {product.name}
            </Text>
            <ScrollView style={styles.groups}>
              {product.optionGroups.map((group) => (
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
            <View style={styles.quantityRow}>
              <Text variant="titleSmall">Số lượng</Text>
              <View style={styles.stepper}>
                <IconButton
                  icon="minus"
                  disabled={quantity <= 1}
                  onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                />
                <Text variant="titleMedium">{quantity}</Text>
                <IconButton icon="plus" onPress={() => setQuantity((current) => current + 1)} />
              </View>
            </View>
            <AppButton
              label={`Thêm vào giỏ · ${formatCurrency(unitPrice * quantity)}`}
              disabled={!canConfirm}
              onPress={() => onConfirm(selectedOptions, quantity)}
            />
          </>
        ) : null}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 8, maxHeight: '85%' },
  title: { marginBottom: 8 },
  groups: { flexGrow: 0 },
  group: { marginBottom: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requiredBadge: { color: '#EF4444' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
});
