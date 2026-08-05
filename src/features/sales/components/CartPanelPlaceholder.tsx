// src/features/sales/components/CartPanelPlaceholder.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { AppInput } from '../../../components/AppInput';
import { EmptyState } from '../../../components/EmptyState';
import { AppButton } from '../../../components/AppButton';

const ORDER_TYPE_BUTTONS = [
  { value: 'dine-in', label: 'Tại quầy', disabled: true },
  { value: 'takeaway', label: 'Mang đi', disabled: true },
  { value: 'delivery', label: 'Giao hàng', disabled: true },
];

export const CartPanelPlaceholder: React.FC = () => (
  <View style={styles.container}>
    <SegmentedButtons value="dine-in" onValueChange={() => {}} buttons={ORDER_TYPE_BUTTONS} />
    <AppInput
      label="Ghi chú đơn hàng"
      value=""
      onChangeText={() => {}}
      placeholder="Ghi chú đơn hàng"
      disabled
    />
    <View style={styles.cartItems}>
      <EmptyState message="Giỏ hàng trống" />
    </View>
    <AppButton label="Thanh toán" disabled onPress={() => {}} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cartItems: { flex: 1, justifyContent: 'center' },
});
