// src/features/cart/components/CartPanel.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SegmentedButtons, Snackbar, Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { EmptyState } from '../../../components/EmptyState';
import { formatCurrency } from '../../../utils/formatCurrency';
import { CartItemRow } from './CartItemRow';
import { useCheckout } from '../hooks/useCheckout';
import {
  itemQuantityChanged,
  itemRemoved,
  noteChanged,
  selectCartItems,
  selectCartNote,
  selectCartTotal,
  selectServiceType,
  serviceTypeChanged,
} from '../store/cartSlice';
import type { ServiceType } from '../types/cart.types';

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

  const handleCheckout = async (): Promise<void> => {
    const order = await submit();
    if (order) {
      setSuccessMessage(`Đã tạo đơn ${order.OrderNumber}`);
      onOrderCreated?.();
    }
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
      <Snackbar visible={error !== null} onDismiss={dismissError} duration={4000}>
        {error}
      </Snackbar>
      <Snackbar visible={successMessage !== null} onDismiss={() => setSuccessMessage(null)} duration={3000}>
        {successMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  items: { flex: 1 },
  footer: { gap: 8 },
});
