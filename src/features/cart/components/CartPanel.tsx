// src/features/cart/components/CartPanel.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, SegmentedButtons, Snackbar, Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { EmptyState } from '../../../components/EmptyState';
import { formatCurrency } from '../../../utils/formatCurrency';
import { CartItemRow } from './CartItemRow';
import { CartItemEditModal } from './CartItemEditModal';
import { useCheckout } from '../hooks/useCheckout';
import {
  itemEdited,
  itemQuantityChanged,
  itemRemoved,
  noteChanged,
  selectCartItems,
  selectCartNote,
  selectCartTotal,
  selectServiceType,
  serviceTypeChanged,
} from '../store/cartSlice';
import type { CartItem, ServiceType } from '../types/cart.types';

const SERVICE_TYPE_BUTTONS = [
  { value: 'DineIn', label: 'Tại quầy' },
  { value: 'TakeAway', label: 'Mang đi' },
];

export interface CartPanelProps {
  onOrderCreated?: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({ onOrderCreated }) => {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector((state: RootState) => selectCartItems(state));
  const serviceType = useSelector((state: RootState) => selectServiceType(state));
  const note = useSelector((state: RootState) => selectCartNote(state));
  const total = useSelector((state: RootState) => selectCartTotal(state));
  const { submit, isSubmitting, error, dismissError } = useCheckout();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  const handleCheckout = async (): Promise<void> => {
    const order = await submit();
    if (order) {
      setSuccessMessage(`Đã tạo đơn ${order.OrderNumber}`);
      onOrderCreated?.();
    }
  };

  const handleEditConfirm = (updated: CartItem): void => {
    if (!editingItem) return;
    dispatch(itemEdited({ previousKey: editingItem.key, item: updated }));
    setEditingItem(null);
  };

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={serviceType}
        onValueChange={(value) => dispatch(serviceTypeChanged(value as ServiceType))}
        buttons={SERVICE_TYPE_BUTTONS}
      />
      <AppInput label="Ghi chú đơn hàng" value={note} onChangeText={(text) => dispatch(noteChanged(text))} />
      <ScrollView style={styles.items}>
        {items.length === 0 ? (
          <EmptyState message="Giỏ hàng trống" />
        ) : (
          items.map((item) => (
            <CartItemRow
              key={item.key}
              item={item}
              onQuantityChange={(key, quantity) => dispatch(itemQuantityChanged({ key, quantity }))}
              onRemove={(key) => dispatch(itemRemoved({ key }))}
              onEdit={(key) => setEditingItem(items.find((i) => i.key === key) ?? null)}
            />
          ))
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Text variant="titleMedium">Tổng tiền: {formatCurrency(total)}</Text>
        <AppButton
          label="Thanh toán"
          onPress={handleCheckout}
          disabled={items.length === 0 || isSubmitting}
          loading={isSubmitting}
        />
      </View>
      <CartItemEditModal item={editingItem} onDismiss={() => setEditingItem(null)} onConfirm={handleEditConfirm} />
      <Portal>
        <Snackbar visible={error !== null} onDismiss={dismissError} duration={4000}>
          {error}
        </Snackbar>
        <Snackbar visible={successMessage !== null} onDismiss={() => setSuccessMessage(null)} duration={3000}>
          {successMessage}
        </Snackbar>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  items: { flex: 1 },
  footer: { gap: 8 },
});
