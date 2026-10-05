import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { printerRepository } from '../../storage/PrinterRepository';
import { getCurrentWifiIp } from '../../discovery/NetworkInfoService';
import { deviceIdOf } from '../../models/printer/PrinterConnection';
import { createPrinterAdapter } from '../../connection/PrinterAdapterFactory';
import { lanConnectionSchema, type LanConnectionValues } from '../../forms/addPrinter/LanConnectionSchema';
import type { ConnectionState, LanguageState } from '../../components/StatusPanel';
import { ConnectionType } from '../../models/printer/ConnectionType';
import type { Printer } from '../../models/printer/Printer';
import type { DiscoveredDevice } from '../../models/device/DiscoveredDevice';
import type { PrintKind } from '../../models/printer/PrintKind';

/**
 * Input cho {@link useConnectionSetup}. `getConnectionState`/`getLanguageState`
 * đọc state của {@link useLanguageDetection} tại thời điểm handler chạy (không
 * phải render) — coordinator cung cấp qua ref bridge để phá vòng phụ thuộc.
 */
export interface UseConnectionSetupInput {
  initialValues?: Printer;
  printerId: string;
  /** Loại nội dung CỐ ĐỊNH của printer này — dùng để check trùng đúng cặp `(deviceId, type)`. */
  kind: PrintKind;
  /** true khi đã xác nhận ngôn ngữ — khoá input kết nối, không cho đổi giữa chừng. */
  hasLanguage: boolean;
  getConnectionState: () => ConnectionState;
  getLanguageState: () => LanguageState;
  resetConnectionResult: () => void;
}

/** Máy đang sửa chưa quét lại: dựng từ kết nối đã lưu để Lưu giữ nguyên kết nối. */
const savedDeviceOf = (printer: Printer): DiscoveredDevice | undefined => {
  if (printer.connection.type === ConnectionType.Lan) {
    return undefined;
  }

  return {
    device: {
      deviceId: printer.deviceId,
      name: '',
      manufacturer: printer.vendor,
      model: printer.model,
      hasPermission: true,
    },
    connection: printer.connection,
  };
};

/**
 * State + hàm cho phần "cách kết nối" (USB/BLE/LAN) của luồng Thêm/Sửa máy in:
 * chọn thiết bị, nhập IP/port LAN, tự lấy IP WiFi, tính deviceId và cảnh báo
 * trùng máy in đã lưu.
 */
export const useConnectionSetup = ({
  initialValues,
  printerId,
  kind,
  hasLanguage,
  getConnectionState,
  getLanguageState,
  resetConnectionResult,
}: UseConnectionSetupInput) => {
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialValues?.connection.type ?? ConnectionType.Usb);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | undefined>(
    initialValues ? savedDeviceOf(initialValues) : undefined,
  );
  const [identityErrorMessage, setIdentityErrorMessage] = useState<string | undefined>(undefined);
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

  /** `null` khi chưa đủ thông tin kết nối (chưa chọn thiết bị, địa chỉ LAN chưa hợp lệ). */
  const currentIdentityKey = (): string | null => {
    if (connectionType !== ConnectionType.Lan) {
      return selectedDevice ? deviceIdOf(selectedDevice.connection) : null;
    }

    const values = lanForm.getValues();

    if (!lanConnectionSchema.safeParse(values).success) {
      return null;
    }

    const { ip, port } = buildLan(values);
    return deviceIdOf({ type: ConnectionType.Lan, host: ip, port });
  };

  useEffect(() => {
    const key = currentIdentityKey();

    if (!key) {
      setIdentityErrorMessage(undefined);
      return;
    }

    const collision = printerRepository.getPrinters().find((p) => p.id !== printerId && p.deviceId === key && p.kind === kind);
    setIdentityErrorMessage(collision ? `Máy in này đã được thêm cho loại nội dung này với tên "${collision.name}".` : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy lại khi connectionType/selectedDevice/lan form thay đổi, đọc qua currentIdentityKey() ở trên
  }, [connectionType, selectedDevice, lanForm.watch('lanIp'), lanForm.watch('lanPort')]);

  /**
   * Serial USB chỉ đọc được sau khi người dùng cấp quyền (bấm "Kết nối") — lúc quét chưa có. Quét lại sau khi kết
   * nối và khớp đúng máy theo mã quét của native để deviceId có serial; khớp theo vendorId/productId sẽ lấy nhầm khi
   * có 2 máy cùng model.
   */
  const refreshUsbSerial = async (): Promise<void> => {
    const selected = selectedDevice;

    if (selected?.connection.type !== ConnectionType.Usb || selected.connection.serialNumber) {
      return;
    }

    const devices = await createPrinterAdapter().listDevices(ConnectionType.Usb).catch(() => []);
    const match = devices.find((candidate) => candidate.device.deviceId === selected.device.deviceId);

    if (match?.connection.type === ConnectionType.Usb && match.connection.serialNumber) {
      setSelectedDevice(match);
    }
  };

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

  const onSelectDevice = (device: DiscoveredDevice): void => {
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
    currentIdentityKey,
    identityErrorMessage,
    onConnectionTypeChange,
    onSelectDevice,
    onLanIpChange,
    onLanPortChange,
    refreshUsbSerial,
  };
};
