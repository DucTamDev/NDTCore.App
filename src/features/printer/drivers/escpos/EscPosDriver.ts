import { Platform } from 'react-native';
import type { IPrinterDriver, PrintDocuments, PrintOptions, Unsubscribe } from '../../types/driver.types';
import { ConnectionType, CutterMode, PrinterDriverType, PrinterStatus } from '../../types/printer.types';
import { mediaOf, paperSizeOf } from '../driverConfig';
import { DeviceScanEventType } from '../../types/printer.types';
import type { DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver } from '../../types/printer.types';
import type { PrintType } from '../../types/printConfiguration.types';
import { PrinterErrorException, PrinterErrorCode, errorCodeOf } from '../../types/PrinterError';
import { ensureBluetoothPermission } from '../../services/PrinterPermissionService';
import { PrinterLogger } from '../../services/PrinterLogger';
import { LoggerService } from '../../../../services/LoggerService';
import { NativeAdapter } from '../../adapters/native/NativeAdapter';
import { toConnectTarget } from '../../adapters/IPrinterAdapter';
import { buildEscPosText } from './EscPosTextBuilder';
import { resolveEffectiveCutterMode } from '../../media/cutter';

const ESC_POS_BASE_OPTIONS = { keepConnection: true, tailingLine: true, encoding: 'UTF8' } as const;

/**
 * ESC/POS đi qua `NativeAdapter` (`IPrinterAdapter`) — native module RN*Printer
 * gộp connect+encode+write theo namespace/connectionType (spec §2.3, ngoại lệ
 * pragmatic: KHÔNG dùng `read`, `printText` encode ở JS `EPToolkit`). Native là
 * singleton per connectionType → `activeByType` giữ đúng 1 owner/loại.
 */
export class EscPosDriver implements IPrinterDriver {
  private adapters = new Map<string, NativeAdapter>();
  private connectedTypes = new Map<string, ConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private contexts = new Map<string, { printer: Printer; driver: PrinterDriver }>();
  private activeByType = new Map<ConnectionType, string>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === ConnectionType.lan) {
      onEvent({ type: DeviceScanEventType.empty });
      return () => undefined;
    }
    if (connectionType === ConnectionType.usb && Platform.OS !== 'android') {
      onEvent({ type: DeviceScanEventType.error, error: { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'USB chỉ hỗ trợ trên Android' } });
      return () => undefined;
    }
    let cancelled = false;
    onEvent({ type: DeviceScanEventType.loading });
    const startedAt = Date.now();
    const run = async (): Promise<void> => {
      try {
        if (connectionType === ConnectionType.bluetooth) {
          const granted = await ensureBluetoothPermission();
          if (cancelled) return;
          if (!granted) {
            onEvent({ type: DeviceScanEventType.error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
            return;
          }
        }
        const devices = await new NativeAdapter().listDevices(connectionType);
        if (cancelled) return;
        LoggerService.debug('EscPosDriver.scan: devices', { connectionType, devices });
        onEvent({ type: devices.length > 0 ? DeviceScanEventType.found : DeviceScanEventType.empty, devices });
        PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        if (/no device found/i.test(message)) {
          onEvent({ type: DeviceScanEventType.empty });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: 0, durationMs: Date.now() - startedAt });
          return;
        }
        onEvent({ type: DeviceScanEventType.error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message } });
        PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
      }
    };
    run();
    return () => { cancelled = true; };
  }

  async connect(printer: Printer, driver: PrinterDriver): Promise<void> {
    this.setStatus(printer.id, PrinterStatus.connecting);
    const startedAt = Date.now();
    try {
      if (printer.connectionType === ConnectionType.bluetooth) {
        const granted = await ensureBluetoothPermission();
        if (!granted) throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' });
      }

      const adapter = new NativeAdapter();
      await adapter.connect(toConnectTarget(printer));

      this.adapters.set(printer.id, adapter);
      this.connectedTypes.set(printer.id, printer.connectionType);
      this.contexts.set(printer.id, { printer, driver });

      const previousOwner = this.activeByType.get(printer.connectionType);
      if (previousOwner && previousOwner !== printer.id) {
        this.setStatus(previousOwner, PrinterStatus.disconnected);
      }
      this.activeByType.set(printer.connectionType, printer.id);
      this.setStatus(printer.id, PrinterStatus.connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.escpos, connectionType: printer.connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.error);
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.escpos, connectionType: printer.connectionType, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, PrinterStatus.disconnecting);
    const connectionType = this.connectedTypes.get(printerId);
    const isActiveOwner = Boolean(connectionType) && this.activeByType.get(connectionType!) === printerId;
    try {
      if (isActiveOwner) await this.adapters.get(printerId)?.disconnect();
    } catch (error) {
      this.setStatus(printerId, PrinterStatus.error);
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.escpos, errorCode: errorCodeOf(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (isActiveOwner) this.activeByType.delete(connectionType!);
      this.adapters.delete(printerId);
      this.connectedTypes.delete(printerId);
      this.contexts.delete(printerId);
    }
    this.setStatus(printerId, PrinterStatus.disconnected);
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrinterDriverType.escpos });
  }

  private async sendDocuments(adapter: NativeAdapter, driver: PrinterDriver, documents: PrintDocuments): Promise<void> {
    const cut = resolveEffectiveCutterMode(mediaOf(driver)) !== CutterMode.none;
    const text = buildEscPosText(paperSizeOf(driver), documents);
    await adapter.printText(text, { ...ESC_POS_BASE_OPTIONS, cut });
  }

  /** `printType`/`_options` không dùng ở ESC/POS (không phân biệt bill/label, không grid) — chỉ giữ tham số để khớp `IPrinterDriver`. */
  async print(printerId: string, documents: PrintDocuments, _printType: PrintType, _options?: PrintOptions): Promise<void> {
    const context = this.contexts.get(printerId);
    const connectionType = this.connectedTypes.get(printerId);
    const adapter = this.adapters.get(printerId);
    if (!context || !connectionType || !adapter || this.activeByType.get(connectionType) !== printerId) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }
    const startedAt = Date.now();
    try {
      await this.sendDocuments(adapter, context.driver, documents);
      PrinterLogger.printSucceeded({ printerId, protocol: PrinterDriverType.escpos, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: PrinterDriverType.escpos, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? PrinterStatus.idle;
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  /** `printType`/`_options` không dùng ở ESC/POS (không phân biệt bill/label, không grid) — chỉ giữ tham số để khớp `IPrinterDriver`. */
  async testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, _printType: PrintType, _options?: PrintOptions): Promise<void> {
    const startedAt = Date.now();
    try {
      const isStaleOwner = this.activeByType.get(printer.connectionType) !== printer.id;
      if (!this.adapters.has(printer.id) || isStaleOwner) {
        await this.connect(printer, driver);
      }
      const adapter = this.adapters.get(printer.id);
      if (!adapter) return;
      await this.sendDocuments(adapter, driver, documents);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.escpos, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.escpos, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  /**
   * ESC/POS không có discriminator thật (native không `read`). Trả `{}` khi đã
   * kết nối (BLE/LAN — "weak confirm" cho auto-detect, xem `PrinterDiscoveryService`),
   * `null` cho USB (không bao giờ tự xác nhận protocol qua USB — xem CLAUDE.md).
   */
  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const connectionType = this.connectedTypes.get(printerId);
    if (!connectionType || connectionType === ConnectionType.usb) return null;
    return this.adapters.has(printerId) ? {} : null;
  }
}
