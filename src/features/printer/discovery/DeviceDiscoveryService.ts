import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { DiscoveredDevice } from '../models/device/DiscoveredDevice';
import { DeviceDiscoveryEventType, type DeviceDiscoveryEvent } from '../models/device/DeviceDiscoveryEvent';
import { PrinterErrorCode, PrinterErrorException } from '../errors/PrinterError';
import { PrinterLogger } from '../logging/PrinterLogger';
import { ensureBluetoothPermission } from '../permissions/PrinterPermissionService';
import { createPrinterAdapter } from '../connection/PrinterAdapterFactory';
import { LoggerService } from '../../../services/LoggerService';

/** Phụ thuộc của service, tách ra để test thay được. */
export interface DeviceDiscoveryServiceDeps {
  createAdapter: () => IPrinterAdapter;

  /** `true` khi app đã có quyền Bluetooth. */
  ensureBluetoothPermission: () => Promise<boolean>;
}

/** Một số native báo "không có thiết bị" bằng lỗi thay vì danh sách rỗng. */
const NO_DEVICE_MESSAGE = /no device found/i;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Log `debug` đủ chi tiết thiết bị để soi khi danh sách hiển thị sai; không đi qua `PrinterLogger` vì có MAC. */
const logEvent = (connectionType: ConnectionType, event: DeviceDiscoveryEvent): void => {
  LoggerService.debug('printer.discovery.event', {
    connectionType,
    type: event.type,
    devices:
      event.type === DeviceDiscoveryEventType.Found
        ? event.devices.map(({ device, connection }) => ({ deviceId: device.deviceId, name: device.name, connection }))
        : undefined,
    error: event.type === DeviceDiscoveryEventType.Error ? event.error : undefined,
  });
};

/** Tìm máy in để người dùng chọn khi thêm máy; LAN không quét được nên người dùng tự nhập địa chỉ. */
export const createDeviceDiscoveryService = (
  deps: DeviceDiscoveryServiceDeps = { createAdapter: createPrinterAdapter, ensureBluetoothPermission },
) => {
  const findDevices = async (connectionType: ConnectionType): Promise<DiscoveredDevice[]> => {
    if (connectionType === ConnectionType.Bluetooth && !(await deps.ensureBluetoothPermission())) {
      throw new PrinterErrorException({
        code: PrinterErrorCode.PRINTER_CONNECTION_FAILED,
        message: 'Chưa được cấp quyền Bluetooth',
      });
    }

    return deps.createAdapter().listDevices(connectionType);
  };

  const discover = (connectionType: ConnectionType, onEvent: (event: DeviceDiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;
    const startedAt = Date.now();

    const emit = (event: DeviceDiscoveryEvent): void => {
      if (!cancelled) {
        logEvent(connectionType, event);
        onEvent(event);
      }
    };

    const complete = (devices: DiscoveredDevice[]): void => {
      const deviceCount = devices.length;
      const found: DeviceDiscoveryEvent = { type: DeviceDiscoveryEventType.Found, devices };
      emit(deviceCount > 0 ? found : { type: DeviceDiscoveryEventType.Empty });
      PrinterLogger.discoveryCompleted({ connectionType, deviceCount, durationMs: Date.now() - startedAt });
    };

    const fail = (error: unknown): void => {
      const message = messageOf(error);

      if (NO_DEVICE_MESSAGE.test(message)) {
        complete([]);
        return;
      }

      const errorCode = PrinterErrorCode.PRINTER_CONNECTION_FAILED;
      emit({ type: DeviceDiscoveryEventType.Error, error: { code: errorCode, message } });
      PrinterLogger.discoveryFailed({ connectionType, errorCode, durationMs: Date.now() - startedAt });
    };

    if (connectionType === ConnectionType.Lan) {
      emit({ type: DeviceDiscoveryEventType.Empty });
      return () => undefined;
    }

    PrinterLogger.discoveryStarted({ connectionType });
    emit({ type: DeviceDiscoveryEventType.Loading });
    findDevices(connectionType).then(complete, fail);

    return () => {
      cancelled = true;
    };
  };

  return { discover };
};

export const DeviceDiscoveryService = createDeviceDiscoveryService();
