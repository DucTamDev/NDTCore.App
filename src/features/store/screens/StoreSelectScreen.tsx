// src/features/store/screens/StoreSelectScreen.tsx
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TouchableRipple, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { useStoreSelection } from '../hooks/useStoreSelection';
import type { StoreViewModel } from '../types/store.types';

export const StoreSelectScreen: React.FC = () => {
  const { stores, isLoading, error, selectStore } = useStoreSelection();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Text variant="headlineSmall" style={styles.title}>
        Chọn cửa hàng
      </Text>
      {isLoading ? <LoadingOverlay /> : null}
      {!isLoading && error ? <EmptyState message={error} /> : null}
      {!isLoading && !error && stores.length === 0 ? (
        <EmptyState message="Tài khoản chưa được gán cửa hàng nào — liên hệ quản trị viên" />
      ) : null}
      {!isLoading && !error && stores.length > 0 ? (
        <ScrollView contentContainerStyle={styles.grid}>
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} onPress={() => selectStore(store.id)} />
          ))}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

interface StoreCardProps {
  store: StoreViewModel;
  onPress: () => void;
}

const StoreCard: React.FC<StoreCardProps> = ({ store, onPress }) => {
  const addressLine = [store.address, store.district, store.province].filter(Boolean).join(', ');

  return (
    <TouchableRipple style={styles.card} onPress={onPress} disabled={!store.isActive}>
      <View>
        <Text variant="titleMedium">{store.name}</Text>
        <Text variant="bodySmall" style={styles.code}>
          {store.code}
        </Text>
        {addressLine ? (
          <Text variant="bodySmall" style={styles.address}>
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
  safeArea: { flex: 1, backgroundColor: 'white' },
  title: { padding: 24, paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 24, paddingTop: 12 },
  card: {
    width: 260,
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  code: { color: '#6B7280', marginTop: 2 },
  address: { color: '#6B7280', marginTop: 8 },
  chip: { marginTop: 8, alignSelf: 'flex-start' },
});
