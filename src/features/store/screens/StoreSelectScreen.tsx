// src/features/store/screens/StoreSelectScreen.tsx
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { useStoreSelection } from '../hooks/useStoreSelection';
import { useAuth } from '../../auth/hooks/useAuth';
import { StoreCard } from '../components/StoreCard';

export const StoreSelectScreen: React.FC = () => {
  const { stores, isLoading, error, selectStore, retry } = useStoreSelection();
  const { logout } = useAuth();

  const showEmptyOrError = !isLoading && (error !== null || stores.length === 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Text variant="headlineSmall" style={styles.title}>
        Chọn cửa hàng
      </Text>
      {isLoading ? <LoadingOverlay /> : null}
      {showEmptyOrError ? (
        <View style={styles.emptyWrap}>
          <EmptyState message={error ?? 'Tài khoản chưa được gán cửa hàng nào — liên hệ quản trị viên'} />
          <View style={styles.actionsRow}>
            <Button mode="outlined" onPress={retry}>
              Thử lại
            </Button>
            <Button mode="text" onPress={logout}>
              Đăng xuất
            </Button>
          </View>
        </View>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  title: { padding: 24, paddingBottom: 12 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 24, paddingTop: 12 },
});
