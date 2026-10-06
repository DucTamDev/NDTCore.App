import type { IPrinterAdapter, Unsubscribe } from '../adapters/IPrinterAdapter';
import { ConnectionType } from '../models/printer/ConnectionType';
import type { DiscoverResult } from '../models/discovery/DiscoverResult';
import { DiscoveryStatus } from '../models/discovery/DiscoveryStatus';
import type { DiscoveryEvent } from '../models/discovery/DiscoveryEvent';
import { DeviceErrorCode } from '../errors';
import { DeviceErrorException, toPrinterFeatureException } from '../exceptions';
import { printerLogger } from '../logging/PrinterLogger';
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
const logEvent = (connectionType: ConnectionType, event: DiscoveryEvent): void => {
  LoggerService.debug('printer.discovery.event', {
    connectionType,
    status: event.status,
    devices:
      event.status === DiscoveryStatus.Found
        ? event.devices.map(({ device, connection }) => ({ deviceId: device.deviceId, name: device.name, connection }))
        : undefined,
    error:
      event.status === DiscoveryStatus.Error
        ? { code: event.error.code, message: event.error.message }
        : undefined,
  });
};

/** Tìm máy in để người dùng chọn khi thêm máy; LAN không quét được nên người dùng tự nhập địa chỉ. */
export class DeviceDiscoveryService {
  constructor(
    private readonly deps: DeviceDiscoveryServiceDeps = {
      createAdapter: createPrinterAdapter,
      ensureBluetoothPermission,
    },
  ) {}

  discover(connectionType: ConnectionType, onEvent: (event: DiscoveryEvent) => void): Unsubscribe {
    let cancelled = false;
    const startedAt = Date.now();

    const emit = (event: DiscoveryEvent): void => {
      if (!cancelled) {
        logEvent(connectionType, event);
        onEvent(event);
      }
    };

    const complete = (devices: DiscoverResult[]): void => {
      const deviceCount = devices.length;
      const found: DiscoveryEvent = { status: DiscoveryStatus.Found, devices };
      emit(deviceCount > 0 ? found : { status: DiscoveryStatus.Empty });
      printerLogger.discoveryCompleted({ connectionType, deviceCount, durationMs: Date.now() - startedAt });
    };

    const fail = (error: unknown): void => {
      const message = messageOf(error);

      if (NO_DEVICE_MESSAGE.test(message)) {
        complete([]);
        return;
      }

      const failure = toPrinterFeatureException(error);
      emit({ status: DiscoveryStatus.Error, error: failure });
      printerLogger.discoveryFailed({ connectionType, errorCode: failure.code, durationMs: Date.now() - startedAt });
    };

    if (connectionType === ConnectionType.Lan) {
      emit({ status: DiscoveryStatus.Empty });
      return () => undefined;
    }

    printerLogger.discoveryStarted({ connectionType });
    emit({ status: DiscoveryStatus.Loading });
    this.findDevices(connectionType).then(complete, fail);

    return () => {
      cancelled = true;
    };
  }

  private async findDevices(connectionType: ConnectionType): Promise<DiscoverResult[]> {
    if (connectionType === ConnectionType.Bluetooth && !(await this.deps.ensureBluetoothPermission())) {
      throw new DeviceErrorException({
        code: DeviceErrorCode.PERMISSION_DENIED,
        message: 'Chưa được cấp quyền Bluetooth',
      });
    }

    return this.deps.createAdapter().listDevices(connectionType);
  }
}

export const deviceDiscoveryService = new DeviceDiscoveryService();
