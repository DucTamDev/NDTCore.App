import React from 'react';
import { View, StyleSheet } from 'react-native';
import { List, IconButton, Text } from 'react-native-paper';
import type { DeviceCandidate } from '@ndtcore/printer';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { candidateKeyOf } from '../hooks/useAddPrinterFlow';

/** Thuộc tính danh sách máy tìm được. */
export interface DiscoveredDeviceListProps {
  /** Máy USB, Bluetooth package liệt kê. */
  candidates: DeviceCandidate[];

  /** Đang liệt kê. */
  loading: boolean;

  /** Không liệt kê được. */
  errorMessage?: string;

  /** Khoá của máy đang chọn. */
  selectedKey?: string;

  /** Chọn máy. */
  onSelect: (candidate: DeviceCandidate) => void;

  /** Liệt kê lại. */
  onRefresh: () => void;

  /** Khoá chọn sau khi đã kết nối. */
  disabled: boolean;
}

/** Danh sách máy tìm được; máy đã thêm cho loại nội dung này ghi tên máy in đang dùng nó. */
export const DiscoveredDeviceList: React.FC<
  DiscoveredDeviceListProps
> = props => {
  const {
    candidates,
    loading,
    errorMessage,
    selectedKey,
    onSelect,
    onRefresh,
    disabled,
  } = props;

  return (
    <View>
      <View style={styles.header}>
        <Text variant="labelMedium">Thiết bị tìm thấy</Text>
        <IconButton
          icon="refresh"
          size={16}
          onPress={onRefresh}
          disabled={disabled}
        />
      </View>
      {loading ? <LoadingOverlay /> : null}
      {!loading && errorMessage ? <EmptyState message={errorMessage} /> : null}
      {!loading && !errorMessage && candidates.length === 0 ? (
        <EmptyState message="Không tìm thấy thiết bị nào" />
      ) : null}
      {!loading &&
        !errorMessage &&
        candidates.map(candidate => {
          const key = candidateKeyOf(candidate);
          const isSelected = key === selectedKey;

          return (
            <List.Item
              key={key}
              title={candidate.displayName}
              description={
                candidate.duplicate
                  ? `Đã thêm: ${candidate.duplicate.name}`
                  : undefined
              }
              onPress={disabled ? undefined : () => onSelect(candidate)}
              // eslint-disable-next-line react/no-unstable-nested-components -- render-prop của List.Item
              right={() => (isSelected ? <List.Icon icon="check" /> : null)}
            />
          );
        })}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
