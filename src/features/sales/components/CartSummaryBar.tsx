import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { formatCurrency } from '../../../utils/formatCurrency';
import { selectCartItemCount, selectCartTotal } from '../../cart/store/cartSlice';

interface CartSummaryBarProps {
  onPress: () => void;
}

/**
 * Tách riêng khỏi SalesScreen để chỉ thanh này re-render mỗi khi giỏ hàng
 * đổi (thêm/bớt sản phẩm) — SalesScreen không còn subscribe cart state nên
 * cây catalog bên dưới (FlatList sản phẩm) không bị kéo theo re-render ở
 * thao tác diễn ra thường xuyên nhất màn hình.
 */
export const CartSummaryBar: React.FC<CartSummaryBarProps> = ({ onPress }) => {
  const theme = useTheme();
  const itemCount = useSelector((state: RootState) => selectCartItemCount(state));
  const cartTotal = useSelector((state: RootState) => selectCartTotal(state));

  return (
    <TouchableOpacity style={[styles.bar, { backgroundColor: theme.colors.primary }]} onPress={onPress}>
      <Text variant="titleSmall" style={styles.text}>
        {itemCount} sản phẩm · {formatCurrency(cartTotal)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bar: { padding: 16, alignItems: 'center' },
  text: { color: 'white' },
});
