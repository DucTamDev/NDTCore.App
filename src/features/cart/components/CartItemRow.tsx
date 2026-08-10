// src/features/cart/components/CartItemRow.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text, TouchableRipple } from 'react-native-paper';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { CartItem } from '../types/cart.types';

export interface CartItemRowProps {
  item: CartItem;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  onEdit: (key: string) => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({ item, onQuantityChange, onRemove, onEdit }) => {
  const optionsSummary = item.options.map((option) => option.optionName).join(', ');

  return (
    <View style={styles.row}>
      <TouchableRipple style={styles.info} onPress={() => onEdit(item.key)}>
        <View>
          <Text variant="bodyMedium">{item.productName}</Text>
          {optionsSummary ? (
            <Text variant="bodySmall" style={styles.optionsText}>
              {optionsSummary}
            </Text>
          ) : null}
          {item.note ? (
            <Text variant="bodySmall" style={styles.noteText}>
              {item.note}
            </Text>
          ) : null}
          <Text variant="labelMedium" style={styles.unitPrice}>
            {formatCurrency(item.unitPrice)} × {item.quantity}
          </Text>
        </View>
      </TouchableRipple>
      <View style={styles.actions}>
        <View style={styles.stepper}>
          <IconButton
            icon="minus"
            mode="outlined"
            size={18}
            onPress={() => onQuantityChange(item.key, item.quantity - 1)}
          />
          <Text variant="bodyMedium">{item.quantity}</Text>
          <IconButton
            icon="plus"
            mode="outlined"
            size={18}
            onPress={() => onQuantityChange(item.key, item.quantity + 1)}
          />
        </View>
        <IconButton icon="delete-outline" mode="outlined" size={18} onPress={() => onRemove(item.key)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  info: { flex: 1 },
  optionsText: { color: '#6B7280', marginTop: 2 },
  noteText: { color: '#6B7280', marginTop: 2, fontStyle: 'italic' },
  unitPrice: { color: '#111827', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
});
