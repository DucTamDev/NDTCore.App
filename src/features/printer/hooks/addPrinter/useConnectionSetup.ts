import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getCurrentWifiIp } from '../../discovery/NetworkDiscoveryService';
import { lanConnectionSchema, type LanConnectionValues } from '../../forms/addPrinter/LanConnectionSchema';
import type { ConnectionState, LanguageState } from '../../components/StatusPanel';
import { ConnectionType } from '../../models/connections/ConnectionType';
import type { Printer } from '../../models/printer/Printer';
import type { DeviceInfo } from '../../models/device/DeviceInfo';

/**
 * Input cho {@link useConnectionSetup}. `getConnectionState`/`getLanguageState`
 * đọc state của {@link usePrinterDetection} tại thời điểm handler chạy (không
 * phải render) — coordinator cung cấp qua ref bridge để phá vòng phụ thuộc.
 */
export interface UseConnectionSetupInput {
  initialValues?: Printer;
  /** true khi đã xác nhận ngôn ngữ — khoá input kết nối, không cho đổi giữa chừng. */
  hasLanguage: boolean;
  getConnectionState: () => ConnectionState;
  getLanguageState: () => LanguageState;
  resetConnectionResult: () => void;
}

/** Máy đang sửa chưa quét lại: dựng từ kết nối đã lưu để Lưu giữ nguyên kết nối. */
const savedDeviceOf = (printer: Printer): DeviceInfo | undefined => {
  if (printer.connection.type === ConnectionType.Lan) {
    return undefined;
  }

  return {
    deviceId: printer.deviceId,
    name: '',
    manufacturer: printer.vendor,
    model: printer.model,
    hasPermission: true,
    address: printer.connection,
  };
};

/**
 * State + hàm cho phần "cách kết nối" (USB/BLE/LAN) của luồng Thêm/Sửa máy in:
 * chọn thiết bị, nhập IP/port LAN, tự lấy IP WiFi. Định danh máy và kiểm tra trùng có sau khi kết nối.
 */
export const useConnectionSetup = ({
  initialValues,
  hasLanguage,
  getConnectionState,
  getLanguageState,
  resetConnectionResult,
}: UseConnectionSetupInput) => {
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialValues?.connection.type ?? ConnectionType.Usb);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | undefined>(
    initialValues ? savedDeviceOf(initialValues) : undefined,
  );
  const [detectedLanIp, setDetectedLanIp] = useState<string | null>(null);
  const [lanIpFetchError, setLanIpFetchError] = useState<string | undefined>(undefined);

  const lanForm = useForm<LanConnectionValues>({
    resolver: zodResolver(lanConnectionSchema),
    defaultValues: {
      lanIp: initialValues?.connection.type === ConnectionType.Lan ? initialValues.connection.host : '',
      lanPort: initialValues?.connection.type === ConnectionType.Lan ? String(initialValues.connection.port) : '',
    },
  });

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });


  const resetIfDirty = (): void => {
    if (getConnectionState() !== 'idle' || getLanguageState() !== 'idle') {
      resetConnectionResult();
    }
  };

  const onConnectionTypeChange = (value: ConnectionType): void => {
    if (hasLanguage) {
      return;
    }

    setConnectionType(value);
    setSelectedDevice(undefined);
    resetIfDirty();
  };

  const onSelectDevice = (device: DeviceInfo): void => {
    if (hasLanguage) {
      return;
    }

    setSelectedDevice(device);
    resetIfDirty();
  };

  const onLanIpChange = (text: string): void => {
    if (hasLanguage) {
      return;
    }

    lanForm.setValue('lanIp', text);
    resetIfDirty();
  };

  const onLanPortChange = (text: string): void => {
    if (hasLanguage) {
      return;
    }

    lanForm.setValue('lanPort', text);
    resetIfDirty();
  };

  const onFetchLanIp = async (): Promise<void> => {
    setLanIpFetchError(undefined);
    const ip = await getCurrentWifiIp();

    if (!ip) {
      setDetectedLanIp(null);
      setLanIpFetchError('Không lấy được IP — kiểm tra đã kết nối WiFi chưa');
      return;
    }

    setDetectedLanIp(ip);
  };

  const onAutoFillLanIp = (): void => {
    if (!detectedLanIp) {
      return;
    }

    onLanIpChange(detectedLanIp);
  };

  return {
    connectionType,
    selectedDevice,
    lanForm,
    detectedLanIp,
    lanIpFetchError,
    onFetchLanIp,
    onAutoFillLanIp,
    buildLan,
    onConnectionTypeChange,
    onSelectDevice,
    onLanIpChange,
    onLanPortChange,
  };
};
