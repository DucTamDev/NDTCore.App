// src/features/printer/drivers/ThermalReceiptDriver.ts
import { Platform } from 'react-native';
import { USBPrinter, BLEPrinter, NetPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import { AppErrorException } from '../../../types/AppError';
import { ensureBluetoothPermission } from '../services/PrinterPermissionService';

interface UsbRawDevice {
  vendor_id: string | number;
  product_id: string | number;
}

const namespaceByConnectionType = {
  usb: USBPrinter,
  bluetooth: BLEPrinter,
  lan: NetPrinter,
} as const;

/**
 * Driver ESC/POS cho máy in hoá đơn, dùng `@poriyaalar/react-native-thermal-receipt-printer`.
 * Khác với Epson SDK (1 class `Printer` dùng chung mọi connectionType), thư
 * viện này export 3 namespace độc lập (USBPrinter/BLEPrinter/NetPrinter) mỗi
 * cái có API riêng — driver này chọn namespace theo `connectionType`, giống
 * cách `TsplDriver` chọn transport.
 *
 * Lưu ý khác biệt so với README của thư viện (đã kiểm tra `dist/index.d.ts`
 * thật sau khi cài đặt): `connectPrinter()` nhận tham số vị trí riêng cho
 * từng namespace (không phải object `{host, port}`/`{inner_mac_address}`/
 * `{vendorID, productId}`), và `printText()` là API kiểu callback
 * (`cbSuccess`/`cbErr`), không trả về `Promise` — driver bọc nó lại thành
 * `Promise` qua `printTextAsync()`.
 */
export class ThermalReceiptDriver implements IPrinterDriver {
  private connectedTypes = new Map<string, ConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private initialized = new Set<ConnectionType>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private async ensureInitialized(connectionType: ConnectionType): Promise<void> {
    if (this.initialized.has(connectionType)) return;
    await namespaceByConnectionType[connectionType].init();
    this.initialized.add(connectionType);
  }

  /**
   * `printText()` của thư viện là API kiểu callback (`cbSuccess`/`cbErr`),
   * không trả `Promise` như plan ban đầu giả định — bọc lại thành `Promise`
   * để `testPrint()` có thể `await` như các driver khác.
   */
  private printTextAsync(connectionType: ConnectionType, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      namespaceByConnectionType[connectionType].printText(
        text,
        undefined,
        () => resolve(),
        (error: Error) => reject(error),
      );
    });
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb' && Platform.OS !== 'android') {
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chỉ hỗ trợ trên Android' },
      });
      return () => undefined;
    }

    let cancelled = false;
    onEvent({ type: 'loading' });

    const run = async (): Promise<void> => {
      if (connectionType === 'bluetooth') {
        const granted = await ensureBluetoothPermission();
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }
      }
      try {
        await this.ensureInitialized(connectionType);
        if (cancelled) return;

        if (connectionType === 'bluetooth') {
          const devices = await BLEPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({
            type: devices.length > 0 ? 'found' : 'empty',
            devices: devices.map((device) => ({
              deviceId: device.inner_mac_address,
              displayName: device.device_name,
              rawDevice: device as unknown as Record<string, unknown>,
            })),
          });
        } else {
          const devices = await USBPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({
            type: devices.length > 0 ? 'found' : 'empty',
            devices: devices.map((device) => ({
              deviceId: `${device.vendor_id}:${device.product_id}`,
              displayName: device.device_name,
              rawDevice: device as unknown as Record<string, unknown>,
            })),
          });
        }
      } catch (error) {
        if (!cancelled) onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      if (config.connectionType === 'bluetooth') {
        const granted = await ensureBluetoothPermission();
        if (!granted) {
          throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' });
        }
      }
      await this.ensureInitialized(config.connectionType);

      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await NetPrinter.connectPrinter(config.lan.ip, config.lan.port);
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        await BLEPrinter.connectPrinter(config.device.deviceId);
      } else {
        const raw = config.device?.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu thông tin thiết bị USB' });
        await USBPrinter.connectPrinter(String(raw.vendor_id), String(raw.product_id));
      }

      this.connectedTypes.set(config.id, config.connectionType);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const connectionType = this.connectedTypes.get(printerId);
    if (connectionType) {
      await namespaceByConnectionType[connectionType].closeConn();
    }
    this.connectedTypes.delete(printerId);
    this.setStatus(printerId, 'disconnected');
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig): Promise<void> {
    if (!this.connectedTypes.has(config.id)) {
      await this.connect(config);
    }
    const connectionType = this.connectedTypes.get(config.id);
    if (!connectionType) return;
    await this.printTextAsync(connectionType, '<C>NDTCore POS - In thu\n</C>');
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    return this.connectedTypes.has(printerId) ? {} : null;
  }
}
