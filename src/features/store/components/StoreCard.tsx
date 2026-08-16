import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Chip, useTheme } from 'react-native-paper';
import type { StoreViewModel } from '../types/store.types';

interface StoreCardProps {
  store: StoreViewModel;
  onPress: () => void;
}

export const StoreCard: React.FC<StoreCardProps> = ({ store, onPress }) => {
  const theme = useTheme();
  const addressLine = [store.address, store.district, store.province].filter(Boolean).join(', ');

  return (
    <TouchableRipple
      style={[styles.card, { borderColor: theme.colors.outlineVariant }]}
      onPress={onPress}
      disabled={!store.isActive}
    >
      <View>
        <Text variant="titleMedium">{store.name}</Text>
        <Text variant="bodySmall" style={[styles.code, { color: theme.colors.onSurfaceVariant }]}>
          {store.code}
        </Text>
        {addressLine ? (
          <Text variant="bodySmall" style={[styles.address, { color: theme.colors.onSurfaceVariant }]}>
            {addressLine}
          </Text>
        ) : null}
        {store.isAcceptingOrders ? (
          <Chip compact style={styles.chip}>
            Đang nhận đơn
          </Chip>
        ) : null}
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 260,
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  code: { marginTop: 2 },
  address: { marginTop: 8 },
  chip: { marginTop: 8, alignSelf: 'flex-start' },
});
