import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterRepository } from '../../services/PrinterRepository';
import { getCurrentWifiIp } from '../../services/NetworkInfoService';
import { resolveIdentityKey } from '../../services/discovery/PrinterResolver';
import { USBPrinter } from '../../adapters/native/PrinterNativeModule';
import { lanConnectionSchema, type LanConnectionValues } from '../../schemas/printerFormSchema';
import type { ConnectionState, ProtocolState } from '../../components/StatusPanel';
import { ConnectionType } from '../../types/printer.types';
import type { Printer, PrinterDevice, PrinterDriver, UsbRawDevice } from '../../types/printer.types';

/**
 * Input cho {@link useConnectionSetup}. `getConnectionState`/`getProtocolState`
 * đọc state của {@link useProtocolDiscovery} tại thời điểm handler chạy (không
 * phải render) — coordinator cung cấp qua ref bridge để phá vòng phụ thuộc.
 */
export interface UseConnectionSetupInput {
  initialValues?: Printer;
  printerId: string;
  drivers: PrinterDriver[];
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
  drivers,
  getConnectionState,
  getProtocolState,
  resetConnectionResult,
}: UseConnectionSetupInput) => {
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialValues?.connectionType ?? ConnectionType.usb);
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(initialValues?.device);
  const [identityErrorMessage, setIdentityErrorMessage] = useState<string | undefined>(undefined);
  const [detectedLanIp, setDetectedLanIp] = useState<string | null>(null);
  const [lanIpFetchError, setLanIpFetchError] = useState<string | undefined>(undefined);

  const lanForm = useForm<LanConnectionValues>({
    resolver: zodResolver(lanConnectionSchema),
    defaultValues: {
      lanIp: initialValues?.lan?.ip ?? '',
      lanPort: initialValues?.lan?.port ? String(initialValues.lan.port) : '',
    },
  });

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });

  /** Không cần biết protocol — xem `resolveIdentityKey`. */
  const currentIdentityKey = (): string | null => {
    try {
      if (connectionType === ConnectionType.lan) {
        const values = lanForm.getValues();
        if (!lanConnectionSchema.safeParse(values).success) return null;
        return resolveIdentityKey({ connectionType, lan: buildLan(values) });
      }
      if (!selectedDevice) return null;
      return resolveIdentityKey({ connectionType, device: selectedDevice });
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
    const collision = PrinterRepository.getPrinters().find((p) => p.id !== printerId && p.identityKey === key);
    setIdentityErrorMessage(
      collision ? `Máy in này đã được thêm với tên "${collision.name}" — dùng "+ Thêm driver" trên máy in đó thay vì thêm mới.` : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy lại khi connectionType/selectedDevice/lan form thay đổi, đọc qua currentIdentityKey() ở trên
  }, [connectionType, selectedDevice, lanForm.watch('lanIp'), lanForm.watch('lanPort')]);

  /**
   * `UsbDevice.serialNumber` chỉ đọc được sau khi user cấp quyền USB (bấm "Kết
   * nối") — lúc scan trả `null`. Gọi lại enumerate sau khi connect thành công
   * để identityKey pin thêm serial (`usb:<vid>:<pid>:<serial>`) thay vì chỉ `vid:pid`.
   */
  const refreshUsbSerial = async (): Promise<void> => {
    if (connectionType !== ConnectionType.usb || !selectedDevice) return;
    const raw = selectedDevice.rawDevice as unknown as UsbRawDevice;
    if (raw.serialNumber) return;
    const devices = await USBPrinter.getDeviceList().catch(() => []);
    const rich = devices.find((d) => Number(d.vendor_id) === Number(raw.vendor_id) && Number(d.product_id) === Number(raw.product_id));
    if (!rich?.serialNumber) return;
    setSelectedDevice((prev) => (prev ? { ...prev, rawDevice: { ...prev.rawDevice, serialNumber: rich.serialNumber } } : prev));
  };

  const onConnectionTypeChange = (value: ConnectionType): void => {
    if (drivers.length > 0) return;
    setConnectionType(value);
    setSelectedDevice(undefined);
    if (getConnectionState() !== 'idle' || getProtocolState() !== 'idle') resetConnectionResult();
  };

  const onSelectDevice = (device: PrinterDevice): void => {
    if (drivers.length > 0) return;
    setSelectedDevice(device);
    if (getConnectionState() !== 'idle' || getProtocolState() !== 'idle') resetConnectionResult();
  };

  const onLanIpChange = (text: string): void => {
    if (drivers.length > 0) return;
    lanForm.setValue('lanIp', text);
    if (getConnectionState() !== 'idle' || getProtocolState() !== 'idle') resetConnectionResult();
  };

  const onLanPortChange = (text: string): void => {
    if (drivers.length > 0) return;
    lanForm.setValue('lanPort', text);
    if (getConnectionState() !== 'idle' || getProtocolState() !== 'idle') resetConnectionResult();
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
    if (!detectedLanIp) return;
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
