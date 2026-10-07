import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons, HelperText } from 'react-native-paper';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { DiscoveredDeviceList } from './DiscoveredDeviceList';
import { ConnectionType } from '../models/connections/ConnectionType';
import type { DeviceInfo } from '../models/device/DeviceInfo';

export interface ConnectionSectionProps {
  connectionType: ConnectionType;
  onConnectionTypeChange: (value: ConnectionType) => void;
  /** `deviceIdOf` của kết nối đang chọn (cũng dùng để đánh dấu máy đang sửa). */
  selectedConnectionKey?: string;

  /** Mã quét native của thiết bị đang chọn; còn đúng sau khi kết nối đổi serial. */
  selectedScanId?: string;

  onSelectDevice: (device: DeviceInfo) => void;
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

  /** Bỏ ngôn ngữ đã xác định để mở khoá phần kết nối; nút chỉ hiện khi phần kết nối đang bị khoá. */
  onChangeConnection: () => void;

  /** Điểm kết nối vật lý cố định sau khi đã xác nhận ngôn ngữ. */
  disabled: boolean;
}

export const ConnectionSection: React.FC<ConnectionSectionProps> = ({
  connectionType,
  onConnectionTypeChange,
  selectedConnectionKey,
  selectedScanId,
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
  onChangeConnection,
  disabled,
}) => (
  <View style={styles.container}>
    <SegmentedButtons
      value={connectionType}
      onValueChange={(value) => onConnectionTypeChange(value as ConnectionType)}
      buttons={[
        { value: ConnectionType.Usb, label: 'USB' },
        { value: ConnectionType.Bluetooth, label: 'Bluetooth' },
        { value: ConnectionType.Lan, label: 'LAN' },
      ]}
    />
    {connectionType === ConnectionType.Lan ? (
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
      <DiscoveredDeviceList
        connectionType={connectionType}
        selectedConnectionKey={selectedConnectionKey}
        selectedScanId={selectedScanId}
        onSelect={disabled ? () => undefined : onSelectDevice}
      />
    )}
    <AppButton label={connectLabel} onPress={onConnectPress} disabled={connectDisabled} />
    {disabled ? <AppButton label="Đổi kết nối" mode="outlined" onPress={onChangeConnection} /> : null}
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 12 },
  lanIpActions: { flexDirection: 'row', gap: 8 },
});
