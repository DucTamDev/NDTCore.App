import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons, HelperText } from 'react-native-paper';
import { TransportType } from '@ndtcore/printer';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { DiscoveredDeviceList } from './DiscoveredDeviceList';
import {
  candidateKeyOf,
  type UseAddPrinterFlow,
} from '../hooks/useAddPrinterFlow';

/** Nhãn nút kết nối theo trạng thái. */
const CONNECT_LABELS: Record<
  UseAddPrinterFlow['session']['connectionState'],
  string
> = {
  idle: 'Kết nối',
  connecting: 'Đang kết nối...',
  connected: 'Kết nối lại',
  error: 'Kết nối',
};

/** Thuộc tính phần kết nối của form thêm máy. */
export interface ConnectionSectionProps {
  /** Luồng thêm máy. */
  flow: UseAddPrinterFlow;
}

/** Chọn cách kết nối, chọn máy hoặc nhập IP, rồi kết nối; đã kết nối thì khoá cho tới khi đổi kết nối. */
export const ConnectionSection: React.FC<ConnectionSectionProps> = ({
  flow,
}) => {
  const { session, lan, selectedCandidate } = flow;
  const locked = Boolean(session.draft);
  const isLan = session.transport === TransportType.Lan;
  const connectDisabled =
    session.connectionState === 'connecting' ||
    (!isLan && !selectedCandidate) ||
    locked;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={session.transport}
        onValueChange={value => session.setTransport(value as TransportType)}
        buttons={[
          { value: TransportType.Usb, label: 'USB', disabled: locked },
          {
            value: TransportType.BluetoothClassic,
            label: 'Bluetooth',
            disabled: locked,
          },
          { value: TransportType.Lan, label: 'LAN', disabled: locked },
        ]}
      />
      {isLan ? (
        <>
          <AppInput
            label="Địa chỉ IP"
            value={lan.host}
            onChangeText={lan.setHost}
            errorMessage={lan.hostError}
            disabled={locked}
          />
          <View style={styles.lanIpActions}>
            <AppButton
              label="Lấy IP mạng"
              mode="outlined"
              onPress={lan.fetchIpAsync}
              disabled={locked}
            />
            {lan.detectedIp ? (
              <AppButton
                label="Điền IP"
                mode="outlined"
                onPress={lan.fillDetectedIp}
                disabled={locked}
              />
            ) : null}
          </View>
          {lan.fetchError ? (
            <HelperText type="error">{lan.fetchError}</HelperText>
          ) : null}
          <AppInput
            label="Cổng"
            value={lan.port}
            onChangeText={lan.setPort}
            keyboardType="numeric"
            errorMessage={lan.portError}
            disabled={locked}
          />
        </>
      ) : (
        <DiscoveredDeviceList
          candidates={session.candidates}
          loading={session.listing}
          errorMessage={session.listError}
          selectedKey={
            selectedCandidate ? candidateKeyOf(selectedCandidate) : undefined
          }
          onSelect={flow.selectCandidate}
          onRefresh={session.refreshAsync}
          disabled={locked}
        />
      )}
      <AppButton
        label={CONNECT_LABELS[session.connectionState]}
        onPress={flow.connectAsync}
        disabled={connectDisabled}
      />
      {locked ? (
        <AppButton
          label="Đổi kết nối"
          mode="outlined"
          onPress={session.resetConnection}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  lanIpActions: { flexDirection: 'row', gap: 8 },
});
