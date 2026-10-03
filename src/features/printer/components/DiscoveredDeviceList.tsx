import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, IconButton, Text } from 'react-native-paper';
import { DeviceDiscoveryService } from '../discovery/DeviceDiscoveryService';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { DeviceDiscoveryEventType } from '../models/device/DeviceDiscoveryEvent';
import type { DiscoveredDevice } from '../models/device/DiscoveredDevice';
import type { ConnectionType } from '../models/printer/ConnectionType';

export interface DiscoveredDeviceListProps {
  connectionType: ConnectionType;

  /** `DeviceInfo.deviceId` của thiết bị đang chọn. */
  selectedDeviceId?: string;

  onSelect: (device: DiscoveredDevice) => void;
}

/** Quét lâu hơn mức này thì dừng chờ và hiển thị những gì đã có. */
const DISCOVERY_TIMEOUT_MS = 30000;

/** Danh sách thiết bị tìm thấy cho một loại kết nối; tự quét khi mở và khi bấm làm mới. */
export const DiscoveredDeviceList: React.FC<DiscoveredDeviceListProps> = ({
  connectionType,
  selectedDeviceId,
  onSelect,
}) => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discoveryTrigger, setDiscoveryTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    setDevices([]);
    let settled = false;

    const settle = (): void => {
      settled = true;
      setLoading(false);
    };

    const unsubscribe = DeviceDiscoveryService.discover(connectionType, (event) => {
      if (settled || event.type === DeviceDiscoveryEventType.Loading) {
        return;
      }

      settle();

      if (event.type === DeviceDiscoveryEventType.Found) {
        setDevices(event.devices);
      }

      if (event.type === DeviceDiscoveryEventType.Error) {
        setErrorMessage(event.error.message);
      }
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settle();
        unsubscribe();
      }
    }, DISCOVERY_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [connectionType, discoveryTrigger]);

  return (
    <View>
      <View style={styles.header}>
        <Text variant="labelMedium">Thiết bị tìm thấy</Text>
        <IconButton icon="refresh" size={16} onPress={() => setDiscoveryTrigger((count) => count + 1)} />
      </View>
      {loading && <LoadingOverlay />}
      {!loading && errorMessage && <EmptyState message={errorMessage} />}
      {!loading && !errorMessage && devices.length === 0 && <EmptyState message="Không tìm thấy thiết bị nào" />}
      {!loading &&
        !errorMessage &&
        devices.map((discovered) => (
          <List.Item
            key={discovered.device.deviceId}
            title={discovered.device.name}
            onPress={() => onSelect(discovered)}
            // eslint-disable-next-line react/no-unstable-nested-components -- render-prop của List.Item
            right={() => (selectedDeviceId === discovered.device.deviceId ? <List.Icon icon="check" /> : null)}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
