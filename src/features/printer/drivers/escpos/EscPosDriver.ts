// src/features/printer/drivers/escpos/EscPosDriver.ts
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import { USBPrinter, BLEPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { IPrinterDriver, PrintDocumentVariants, Unsubscribe } from '../../types/driver.types';
import { ConnectionType, PrinterDriverType } from '../../types/printer.types';
import type { DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver, PrinterStatus, UsbRawDevice } from '../../types/printer.types';
import { AppErrorException, AppErrorCode, errorCodeOf } from '../../types/AppError';
import { ensureBluetoothPermission } from '../../services/PrinterPermissionService';
import { PrinterLogger } from '../../services/PrinterLogger';
import { ensureUsbInitialized } from '../../adapters/UsbPrinterNativeAdapter';
import { ThermalPrinterLibraryAdapter } from '../../adapters/ThermalPrinterLibraryAdapter';
import { PAPER_WIDTH_CHARS, formatRow } from '../../utils/paperWidth';

/**
 * Ngoại lệ pragmatic của ESC/POS (spec §2.3): thư viện vendor gộp
 * connect+encode+write theo namespace riêng cho từng connectionType, không
 * đi qua `Transport` chung với TSPL. Driver này vẫn tự chọn namespace theo
 * connectionType nội bộ — giữ nguyên hành vi đã verify trên phần cứng thật
 * (UTF-8 mode-switch, `keepConnection` NPE workaround...).
 */
export class EscPosDriver implements IPrinterDriver {
  private connectedTypes = new Map<string, ConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private initialized = new Set<ConnectionType>();
  private deviceInfos = new Map<string, PrinterDeviceInfo>();
  private contexts = new Map<string, { printer: Printer; driver: PrinterDriver }>();
  private activeByType = new Map<ConnectionType, string>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private async ensureInitialized(connectionType: ConnectionType): Promise<void> {
    if (this.initialized.has(connectionType)) return;
    if (connectionType === ConnectionType.usb) {
      await ensureUsbInitialized();
    } else {
      await ThermalPrinterLibraryAdapter.namespaceFor(connectionType).init();
    }
    this.initialized.add(connectionType);
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === ConnectionType.lan) {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === ConnectionType.usb && Platform.OS !== 'android') {
      onEvent({ type: 'error', error: { code: AppErrorCode.UNSUPPORTED_CONNECTION, message: 'USB chỉ hỗ trợ trên Android' } });
      return () => undefined;
    }
    let cancelled = false;
    onEvent({ type: 'loading' });
    const startedAt = Date.now();
    const run = async (): Promise<void> => {
      try {
        if (connectionType === ConnectionType.bluetooth) {
          const granted = await ensureBluetoothPermission();
          if (cancelled) return;
          if (!granted) {
            onEvent({ type: 'error', error: { code: AppErrorCode.CONNECTION_ERROR, message: 'Chưa được cấp quyền Bluetooth' } });
            return;
          }
        }
        await this.ensureInitialized(connectionType);
        if (cancelled) return;
        if (connectionType === ConnectionType.bluetooth) {
          const devices = await BLEPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({ type: devices.length > 0 ? 'found' : 'empty', devices: devices.map((d) => ({ deviceId: d.inner_mac_address, displayName: d.device_name, rawDevice: d as unknown as Record<string, unknown> })) });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
        } else {
          const devices = await USBPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({ type: devices.length > 0 ? 'found' : 'empty', devices: devices.map((d) => ({ deviceId: `${d.vendor_id}:${d.product_id}`, displayName: d.device_name, rawDevice: d as unknown as Record<string, unknown> })) });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        if (/no device found/i.test(message)) {
          onEvent({ type: 'empty' });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: 0, durationMs: Date.now() - startedAt });
          return;
        }
        onEvent({ type: 'error', error: { code: AppErrorCode.CONNECTION_ERROR, message } });
        PrinterLogger.scanFailed({ connectionType, errorCode: AppErrorCode.CONNECTION_ERROR, durationMs: Date.now() - startedAt });
      }
    };
    run();
    return () => { cancelled = true; };
  }

  async connect(printer: Printer, driver: PrinterDriver): Promise<void> {
    this.setStatus(printer.id, 'connecting');
    const startedAt = Date.now();
    try {
      if (printer.connectionType === ConnectionType.bluetooth) {
        const granted = await ensureBluetoothPermission();
        if (!granted) throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: 'Chưa được cấp quyền Bluetooth' });
      }
      await this.ensureInitialized(printer.connectionType);

      let deviceName: string | undefined;
      if (printer.connectionType === ConnectionType.lan) {
        if (!printer.lan) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
        const result = await ThermalPrinterLibraryAdapter.namespaceFor(ConnectionType.lan).connectPrinter(printer.lan.ip, printer.lan.port);
        deviceName = result?.device_name;
      } else if (printer.connectionType === ConnectionType.bluetooth) {
        if (!printer.device) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
        const result = await ThermalPrinterLibraryAdapter.namespaceFor(ConnectionType.bluetooth).connectPrinter(printer.device.deviceId);
        deviceName = result?.device_name;
      } else {
        const raw = printer.device?.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
        const result = await ThermalPrinterLibraryAdapter.namespaceFor(ConnectionType.usb).connectPrinter(
          Number(raw.vendor_id) as unknown as string,
          Number(raw.product_id) as unknown as string,
        );
        deviceName = result?.device_name;
      }

      if (deviceName) this.deviceInfos.set(printer.id, { deviceName });
      this.connectedTypes.set(printer.id, printer.connectionType);
      this.contexts.set(printer.id, { printer, driver });

      const previousOwner = this.activeByType.get(printer.connectionType);
      if (previousOwner && previousOwner !== printer.id) {
        this.setStatus(previousOwner, 'disconnected');
      }
      this.activeByType.set(printer.connectionType, printer.id);
      this.setStatus(printer.id, 'connected');
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.escpos, connectionType: printer.connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, 'error');
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.escpos, connectionType: printer.connectionType, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const connectionType = this.connectedTypes.get(printerId);
    try {
      if (connectionType && this.activeByType.get(connectionType) === printerId) {
        await ThermalPrinterLibraryAdapter.namespaceFor(connectionType).closeConn();
      }
    } catch (error) {
      this.setStatus(printerId, 'error');
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.escpos, errorCode: errorCodeOf(error) });
      throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (connectionType && this.activeByType.get(connectionType) === printerId) this.activeByType.delete(connectionType);
      this.connectedTypes.delete(printerId);
      this.deviceInfos.delete(printerId);
      this.contexts.delete(printerId);
    }
    this.setStatus(printerId, 'disconnected');
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrinterDriverType.escpos });
  }

  /** Chỉ dùng cho test/snapshot (spec §7.2) — production `print()`/`testPrint()` KHÔNG gọi hàm này. */
  private encodeDocumentText(printer: Printer, documents: PrintDocumentVariants): string {
    const paperWidth = PAPER_WIDTH_CHARS[printer.paperSize];
    const lines: string[] = [];
    for (const element of documents.text.elements) {
      if (element.type === 'text') {
        lines.push(element.content);
      } else if (element.type === 'line') {
        lines.push('-'.repeat(paperWidth));
      } else if (element.type === 'table') {
        for (const row of element.rows) lines.push(row.join('  '));
      } else if (element.type === 'row') {
        lines.push(formatRow(element.left, element.right, paperWidth));
      } else {
        throw new AppErrorException({ code: AppErrorCode.ENCODING_FAILED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
      }
    }
    return `${lines.join('\n')}\n`;
  }

  encode(printer: Printer, _driver: PrinterDriver, documents: PrintDocumentVariants): Uint8Array {
    return new Uint8Array(Buffer.from(this.encodeDocumentText(printer, documents), 'utf8'));
  }

  private async printText(connectionType: ConnectionType, printer: Printer, documents: PrintDocumentVariants): Promise<void> {
    const text = this.encodeDocumentText(printer, documents);
    await ThermalPrinterLibraryAdapter.printTextAsync(connectionType, text, { keepConnection: true, cut: true, tailingLine: true, encoding: 'UTF8' });
  }

  async print(printerId: string, documents: PrintDocumentVariants): Promise<void> {
    const context = this.contexts.get(printerId);
    const connectionType = this.connectedTypes.get(printerId);
    if (!context || !connectionType || this.activeByType.get(connectionType) !== printerId) {
      throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: 'Máy in chưa kết nối' });
    }
    const startedAt = Date.now();
    try {
      await this.printText(connectionType, context.printer, documents);
      PrinterLogger.printSucceeded({ printerId, protocol: PrinterDriverType.escpos, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: PrinterDriverType.escpos, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants): Promise<void> {
    const startedAt = Date.now();
    try {
      const isStaleOwner = this.activeByType.get(printer.connectionType) !== printer.id;
      if (!this.connectedTypes.has(printer.id) || isStaleOwner) {
        await this.connect(printer, driver);
      }
      const connectionType = this.connectedTypes.get(printer.id);
      if (!connectionType) return;
      await this.printText(connectionType, printer, documents);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.escpos, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.escpos, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const connectionType = this.connectedTypes.get(printerId);
    if (!connectionType) return null;
    if (connectionType === ConnectionType.usb) return null;
    return this.deviceInfos.get(printerId) ?? null;
  }
}
