import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, PrintDocuments, PrintOptions, Unsubscribe } from '../IPrinterDriver';
import { ConnectionType } from '../../models/printer/PrinterDevice';
import { PrinterDriverType } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { mediaOf } from '../driverConfig';
import { DeviceScanEventType } from '../../models/printer/PrinterDevice';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { Printer } from '../../models/printer/Printer';
import type { PrinterDriver, TsplFontConfig } from '../../models/printer/PrinterDriver';
import { PrintType } from '../../models/printing/PrintType';
import { TsplFontManager } from './TsplFontManager';
import { resolveTsplStrategy } from './TsplStrategyRegistry';
import type { TsplStrategyContext } from './strategies/tsplStrategy.types';
import type { IPrinterAdapter } from '../../adapters/IPrinterAdapter';
import { toConnectTarget } from '../../adapters/IPrinterAdapter';
import { resolvePrinterAdapter } from '../../adapters/resolvePrinterAdapter';
import { PrinterErrorException, PrinterErrorCode, errorCodeOf } from '../../errors/PrinterError';
import { ensureBluetoothPermission } from '../../services/PrinterPermissionService';
import { PrinterLogger } from '../../services/PrinterLogger';

const IDENTIFY_TIMEOUT_MS = 1000;

/**
 * Chuẩn hoá số hàng die-cut: sàn về số nguyên ≥ 1, và chặn `NaN` (input rỗng
 * / hỏng từ ô nhập số hàng ở SP-C) — `Math.max(1, NaN)` trả `NaN`, kéo theo
 * `SET CUTTER NaN` / `PRINT NaN,1`.
 *
 * Sanitises the die-cut row count: integer ≥ 1, with a `NaN` guard.
 */
const resolveRows = (options?: PrintOptions): number => {
  const n = Math.floor(options?.rows ?? 1);
  return Number.isFinite(n) ? Math.max(1, n) : 1;
};

const encodeAsciiCommand = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional single-byte masking
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, IPrinterAdapter>();
  private contexts = new Map<string, { printer: Printer; driver: PrinterDriver }>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private fontManager = new TsplFontManager();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === ConnectionType.lan) {
      onEvent({ type: DeviceScanEventType.empty });
      return () => undefined;
    }
    if (connectionType === ConnectionType.usb) {
      onEvent({ type: DeviceScanEventType.error, error: { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'TsplDriver không tự quét USB' } });
      return () => undefined;
    }
    onEvent({ type: DeviceScanEventType.loading });
    let cancelled = false;
    const startedAt = Date.now();
    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: DeviceScanEventType.error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }
        RNBluetoothClassic.startDiscovery()
          .then((devices) => {
            if (cancelled) return;
            onEvent({
              type: devices.length > 0 ? DeviceScanEventType.found : DeviceScanEventType.empty,
              devices: devices.map((d) => ({ deviceId: d.address, displayName: d.name ?? d.address, rawDevice: d as unknown as Record<string, unknown> })),
            });
            PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            onEvent({ type: DeviceScanEventType.error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onEvent({ type: DeviceScanEventType.error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
      });
    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(printer: Printer, driver: PrinterDriver): Promise<void> {
    this.setStatus(printer.id, PrinterStatus.connecting);
    const startedAt = Date.now();
    try {
      if (printer.connection.type === ConnectionType.bluetooth) {
        const granted = await ensureBluetoothPermission();
        if (!granted) throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' });
      }
      const adapter = resolvePrinterAdapter(PrinterDriverType.tspl, printer.connection.type);
      await adapter.connect(toConnectTarget(printer));
      this.connections.set(printer.id, adapter);
      this.contexts.set(printer.id, { printer, driver });
      this.setStatus(printer.id, PrinterStatus.connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.tspl, connectionType: printer.connection.type, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.error);
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.tspl, connectionType: printer.connection.type, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, PrinterStatus.disconnecting);
    const adapter = this.connections.get(printerId);
    try {
      await adapter?.disconnect();
    } catch (error) {
      this.setStatus(printerId, PrinterStatus.error);
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.tspl, errorCode: errorCodeOf(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.connections.delete(printerId);
    }
    this.setStatus(printerId, PrinterStatus.disconnected);
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrinterDriverType.tspl });
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? PrinterStatus.idle;
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  /**
   * Nguồn render DUY NHẤT — chọn strategy theo `renderMode` qua
   * `resolveTsplStrategy` rồi validate/encode qua strategy đó. KHÔNG tự
   * switch renderMode ở đây, KHÔNG fallback khi `validate()` ném lỗi (RULE 05,
   * §27-30) — lỗi phải propagate thẳng ra ngoài.
   */
  private buildBytes(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, rows: number): Uint8Array {
    if (driver.config.type !== PrinterDriverType.tspl) {
      throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: 'Driver không phải TSPL.' });
    }
    const strategy = resolveTsplStrategy(driver.config.renderMode);
    const context: TsplStrategyContext = {
      printer,
      driver,
      documents,
      printType,
      media: mediaOf(driver),
      rows,
    };
    strategy.validate(context);
    return strategy.encode(context);
  }

  async testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void> {
    const startedAt = Date.now();
    try {
      if (!this.connections.has(printer.id)) {
        await this.connect(printer, driver);
      }
      const adapter = this.connections.get(printer.id);
      const rows = resolveRows(options);
      const bytes = this.buildBytes(printer, driver, documents, printType, rows);
      await adapter?.write(bytes);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async print(printerId: string, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void> {
    const context = this.contexts.get(printerId);
    const adapter = this.connections.get(printerId);
    if (!context || !adapter) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }
    // RULE 33 / Invariant 45: mọi print failure phải được log cùng event
    // chuẩn hoá như ESC/POS. `catch` chỉ log rồi ném lại — KHÔNG nuốt lỗi,
    // KHÔNG fallback (lỗi strategy.validate/encode vẫn propagate nguyên vẹn).
    const startedAt = Date.now();
    try {
      const rows = resolveRows(options);
      const bytes = this.buildBytes(context.printer, context.driver, documents, printType, rows);
      await adapter.write(bytes);
      PrinterLogger.printSucceeded({ printerId, protocol: PrinterDriverType.tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: PrinterDriverType.tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  /**
   * Chỉ dò `~!T` khi adapter đọc được phản hồi (`canRead`). Adapter native
   * (USB) chỉ bulk-OUT → trả `null` NGAY, KHÔNG ghi (ghi rồi chờ đọc = lệnh
   * rác vào máy in + lỗi "device not initialized" lúc discovery).
   */
  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const adapter = this.connections.get(printerId);
    if (!adapter || !adapter.canRead) return null;
    try {
      const query = encodeAsciiCommand('~!T\r\n');
      await adapter.write(query);
      const response = await adapter.read(IDENTIFY_TIMEOUT_MS);
      return response && response.length > 0 ? {} : null;
    } catch {
      return null;
    }
  }

  async installTsplFont(printerId: string, font: TsplFontConfig): Promise<void> {
    const adapter = this.connections.get(printerId);
    if (!adapter) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }
    await this.fontManager.downloadFont(adapter, font);
  }
}
