import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons, HelperText } from 'react-native-paper';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { DeviceScanList } from './DeviceScanList';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import type { PrinterDevice } from '../models/printer/PrinterDevice';

export interface ConnectionSectionProps {
  connectionType: PrinterConnectionType;
  onConnectionTypeChange: (value: PrinterConnectionType) => void;
  selectedDeviceId?: string;
  onSelectDevice: (device: PrinterDevice) => void;
  lanIp: string;
  lanPort: string;
  onLanIpChange: (value: string) => void;
  onLanPortChange: (value: string) => void;
  lanIpError?: string;
  lanPortError?: string;
  detectedLanIp?: string | null;
  lanIpFetchError?: string;
  onFetchLanIp: () => void;
  onAutoFillLanIp: () => void;
  connectLabel: string;
  connectDisabled: boolean;
  onConnectPress: () => void;
  /** Điểm kết nối vật lý cố định sau khi driver đầu tiên được xác nhận. */
  disabled: boolean;
}

export const ConnectionSection: React.FC<ConnectionSectionProps> = ({
  connectionType,
  onConnectionTypeChange,
  selectedDeviceId,
  onSelectDevice,
  lanIp,
  lanPort,
  onLanIpChange,
  onLanPortChange,
  lanIpError,
  lanPortError,
  detectedLanIp,
  lanIpFetchError,
  onFetchLanIp,
  onAutoFillLanIp,
  connectLabel,
  connectDisabled,
  onConnectPress,
  disabled,
}) => (
  <View style={styles.container}>
    <SegmentedButtons
      value={connectionType}
      onValueChange={(value) => onConnectionTypeChange(value as PrinterConnectionType)}
      buttons={[
        { value: PrinterConnectionType.Usb, label: 'USB' },
        { value: PrinterConnectionType.Bluetooth, label: 'Bluetooth' },
        { value: PrinterConnectionType.Lan, label: 'LAN' },
      ]}
    />
    {connectionType === PrinterConnectionType.Lan ? (
      <>
        <AppInput label="Địa chỉ IP" value={lanIp} onChangeText={onLanIpChange} errorMessage={lanIpError} disabled={disabled} />
        <View style={styles.lanIpActions}>
          <AppButton label="Lấy IP mạng" mode="outlined" onPress={onFetchLanIp} disabled={disabled} />
          {detectedLanIp ? <AppButton label="Điền IP" mode="outlined" onPress={onAutoFillLanIp} disabled={disabled} /> : null}
        </View>
        {lanIpFetchError ? <HelperText type="error">{lanIpFetchError}</HelperText> : null}
        <AppInput
          label="Cổng"
          value={lanPort}
          onChangeText={onLanPortChange}
          keyboardType="numeric"
          errorMessage={lanPortError}
          disabled={disabled}
        />
      </>
    ) : (
      <DeviceScanList connectionType={connectionType} selectedDeviceId={selectedDeviceId} onSelect={disabled ? () => undefined : onSelectDevice} />
    )}
    <AppButton label={connectLabel} onPress={onConnectPress} disabled={connectDisabled} />
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 12 },
  lanIpActions: { flexDirection: 'row', gap: 8 },
});
