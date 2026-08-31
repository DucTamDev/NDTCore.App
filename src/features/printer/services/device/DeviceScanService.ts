import type { IPrinterDriver, Unsubscribe } from '../../drivers/IPrinterDriver';
import { ConnectionType } from '../../models/printer/PrinterDevice';
import { PrinterDriverType } from '../../models/printer/PrinterDriver';
import type { DeviceScanEvent } from '../../models/printer/PrinterDevice';
import { LoggerService } from '../../../../services/LoggerService';
import { createDiscoverDriver, type DiscoveryEvent, type DiscoverPrinterInput } from '../discovery/PrinterDiscoveryService';
import { DriverRegistry } from '../../drivers/DriverRegistry';

/**
 * Quét thiết bị + dò driver — chỉ cần `registry`, không đụng storage/lock.
 *
 * Device scan + driver discovery — needs only `registry`, no storage/lock.
 */
export const createDeviceScanService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];
  const discoverDriverFn = createDiscoverDriver(registry);

  /**
   * Chèn log `debug` (chỉ chạy trong `__DEV__`) cho MỌI `DeviceScanEvent` —
   * gồm cả `rawDevice` gốc từ native (vendor_id/product_id cho USB, mac cho BT)
   * để soi lúc UI hiển thị sai thiết bị. Không đi qua `PrinterLogger` vì tầng đó
   * cố ý không nhận `rawDevice`/MAC; đây là log dev thuần.
   */
  const withScanLogging =
    (connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void) =>
    (event: DeviceScanEvent): void => {
      LoggerService.debug('printer.scan.event', {
        connectionType,
        type: event.type,
        deviceCount: event.devices?.length ?? 0,
        devices: event.devices?.map((d) => ({ deviceId: d.deviceId, displayName: d.displayName, rawDevice: d.rawDevice })),
        error: event.error ? { code: event.error.code, message: event.error.message } : undefined,
      });
      onEvent(event);
    };

  const scanDevices = (type: PrinterDriverType, connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe =>
    getDriver(type).scan(connectionType, withScanLogging(connectionType, onEvent));

  const scanForConnectionType = (connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe => {
    const tapped = withScanLogging(connectionType, onEvent);
    if (connectionType === ConnectionType.usb) return getDriver(PrinterDriverType.escpos).scan(ConnectionType.usb, tapped);
    if (connectionType === ConnectionType.bluetooth) return getDriver(PrinterDriverType.tspl).scan(ConnectionType.bluetooth, tapped);
    return getDriver(PrinterDriverType.tspl).scan(ConnectionType.lan, tapped);
  };

  const discoverDriver = (input: DiscoverPrinterInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => discoverDriverFn(input, onEvent);

  return { scanDevices, scanForConnectionType, discoverDriver };
};

export const DeviceScanService = createDeviceScanService(DriverRegistry);
