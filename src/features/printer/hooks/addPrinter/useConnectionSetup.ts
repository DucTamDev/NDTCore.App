import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterRepository } from '../../storage/PrinterRepository';
import { getCurrentWifiIp } from '../../discovery/NetworkInfoService';
import { buildBluetoothConnection, buildLanConnection, buildUsbConnection, deviceFromConnection, resolveIdentityKey } from '../../discovery/PrinterResolver';
import { ThermalPrinterModule } from '../../adapters/native/PrinterNativeModule';
import { lanConnectionSchema, type LanConnectionValues } from '../../forms/addPrinter/LanConnectionSchema';
import type { ConnectionState, ProtocolState } from '../../components/StatusPanel';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import type { Printer } from '../../models/printer/Printer';
import type { PrinterDevice, UsbRawDevice } from '../../models/printer/PrinterDevice';
import type { PrintType } from '../../models/printing/PrintType';

/**
 * Input cho {@link useConnectionSetup}. `getConnectionState`/`getProtocolState`
 * đọc state của {@link useProtocolDiscovery} tại thời điểm handler chạy (không
 * phải render) — coordinator cung cấp qua ref bridge để phá vòng phụ thuộc.
 */
export interface UseConnectionSetupInput {
  initialValues?: Printer;
  printerId: string;
  /** Loại nội dung CỐ ĐỊNH của printer này — dùng để check trùng đúng cặp `(identityKey, type)`. */
  printType: PrintType;
  /** true khi đã xác nhận driver — khoá input kết nối, không cho đổi giữa chừng. */
  hasDriver: boolean;
  getConnectionState: () => ConnectionState;
  getProtocolState: () => ProtocolState;
  resetConnectionResult: () => void;
}

/**
 * State + hàm cho phần "cách kết nối" (USB/BLE/LAN) của luồng Thêm/Sửa máy in:
 * chọn thiết bị, nhập IP/port LAN, tự lấy IP WiFi, tính identityKey và cảnh báo
 * trùng máy in đã lưu.
 */
export const useConnectionSetup = ({
  initialValues,
  printerId,
  printType,
  hasDriver,
  getConnectionState,
  getProtocolState,
  resetConnectionResult,
}: UseConnectionSetupInput) => {
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>(initialValues?.connection.type ?? PrinterConnectionType.Usb);
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(
    initialValues ? deviceFromConnection(initialValues.connection) : undefined,
  );
  const [identityErrorMessage, setIdentityErrorMessage] = useState<string | undefined>(undefined);
  const [detectedLanIp, setDetectedLanIp] = useState<string | null>(null);
  const [lanIpFetchError, setLanIpFetchError] = useState<string | undefined>(undefined);

  const lanForm = useForm<LanConnectionValues>({
    resolver: zodResolver(lanConnectionSchema),
    defaultValues: {
      lanIp: initialValues?.connection.type === PrinterConnectionType.Lan ? initialValues.connection.host : '',
      lanPort: initialValues?.connection.type === PrinterConnectionType.Lan ? String(initialValues.connection.port) : '',
    },
  });

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });

  /** Không cần biết protocol — xem `resolveIdentityKey`. */
  const currentIdentityKey = (): string | null => {
    try {
      if (connectionType === PrinterConnectionType.Lan) {
        const values = lanForm.getValues();

        if (!lanConnectionSchema.safeParse(values).success) {
          return null;
        }

        const { ip, port } = buildLan(values);
        return resolveIdentityKey(buildLanConnection(ip, port));
      }

      if (!selectedDevice) {
        return null;
      }

      const connection = connectionType === PrinterConnectionType.Usb ? buildUsbConnection(selectedDevice) : buildBluetoothConnection(selectedDevice);
      return resolveIdentityKey(connection);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const key = currentIdentityKey();

    if (!key) {
      setIdentityErrorMessage(undefined);
      return;
    }

    const collision = PrinterRepository.getPrinters().find((p) => p.id !== printerId && p.identityKey === key && p.type === printType);
    setIdentityErrorMessage(collision ? `Máy in này đã được thêm cho loại nội dung này với tên "${collision.name}".` : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy lại khi connectionType/selectedDevice/lan form thay đổi, đọc qua currentIdentityKey() ở trên
  }, [connectionType, selectedDevice, lanForm.watch('lanIp'), lanForm.watch('lanPort')]);

  /**
   * `UsbDevice.serialNumber` chỉ đọc được sau khi user cấp quyền USB (bấm "Kết
   * nối") — lúc scan trả `null`. Gọi lại enumerate sau khi connect thành công
   * để identityKey pin thêm serial (`usb:<vid>:<pid>:<serial>`) thay vì chỉ `vid:pid`.
   */
  const refreshUsbSerial = async (): Promise<void> => {
    if (connectionType !== PrinterConnectionType.Usb || !selectedDevice) {
      return;
    }

    const raw = selectedDevice.rawDevice as unknown as UsbRawDevice;

    if (raw.serialNumber) {
      return;
    }

    const devices = await ThermalPrinterModule.discoverPrinters(PrinterConnectionType.Usb).catch(() => []);
    const rich = devices.find((d) => d.vendorId === Number(raw.vendorId) && d.productId === Number(raw.productId));

    if (!rich?.serialNumber) {
      return;
    }

    setSelectedDevice((prev) => (prev ? { ...prev, rawDevice: { ...prev.rawDevice, serialNumber: rich.serialNumber } } : prev));
  };

  const resetIfDirty = (): void => {
    if (getConnectionState() !== 'idle' || getProtocolState() !== 'idle') {
      resetConnectionResult();
    }
  };

  const onConnectionTypeChange = (value: PrinterConnectionType): void => {
    if (hasDriver) {
      return;
    }

    setConnectionType(value);
    setSelectedDevice(undefined);
    resetIfDirty();
  };

  const onSelectDevice = (device: PrinterDevice): void => {
    if (hasDriver) {
      return;
    }

    setSelectedDevice(device);
    resetIfDirty();
  };

  const onLanIpChange = (text: string): void => {
    if (hasDriver) {
      return;
    }

    lanForm.setValue('lanIp', text);
    resetIfDirty();
  };

  const onLanPortChange = (text: string): void => {
    if (hasDriver) {
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
