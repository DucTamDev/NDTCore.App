// src/features/printer/components/DeviceScanList.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, IconButton, Text } from 'react-native-paper';
import { PrinterService } from '../printing/PrinterService';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import type { ConnectionType, PrinterDevice } from '../types/printer.types';

export interface DeviceScanListProps {
  connectionType: ConnectionType;
  selectedDeviceId?: string;
  onSelect: (device: PrinterDevice) => void;
}

const SCAN_TIMEOUT_MS = 30000;

export const DeviceScanList: React.FC<DeviceScanListProps> = ({
  connectionType,
  selectedDeviceId,
  onSelect,
}) => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanTrigger, setScanTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    setDevices([]);
    let settled = false;
    const unsubscribe = PrinterService.scanForConnectionType(connectionType, (event) => {
      if (settled) return;
      if (event.type === 'loading') setLoading(true);
      if (event.type === 'found' || event.type === 'empty') {
        settled = true;
        setLoading(false);
        setDevices(event.devices ?? []);
      }
      if (event.type === 'error') {
        settled = true;
        setLoading(false);
        setErrorMessage(event.error?.message ?? 'Không thể quét thiết bị');
      }
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      setLoading(false);
    }, SCAN_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [connectionType, scanTrigger]);

  return (
    <View>
      <View style={styles.header}>
        <Text variant="labelMedium">Thiết bị tìm thấy</Text>
        <IconButton icon="refresh" size={16} onPress={() => setScanTrigger((n) => n + 1)} />
      </View>
      {loading && <LoadingOverlay />}
      {!loading && errorMessage && <EmptyState message={errorMessage} />}
      {!loading && !errorMessage && devices.length === 0 && <EmptyState message="Không tìm thấy thiết bị nào" />}
      {!loading &&
        !errorMessage &&
        devices.map((device) => (
          <List.Item
            key={device.deviceId}
            title={device.displayName}
            onPress={() => onSelect(device)}
            // eslint-disable-next-line react/no-unstable-nested-components -- render-prop for List.Item's `right` slot, not a real component definition
            right={() => (selectedDeviceId === device.deviceId ? <List.Icon icon="check" /> : null)}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
