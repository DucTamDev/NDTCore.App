import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, PrintDocuments, PrintOptions, Unsubscribe } from '../IPrinterDriver';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { PrinterDriverType, RenderMode } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { DeviceScanEventType } from '../../models/printer/PrinterDevice';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { Printer } from '../../models/printer/Printer';
import { TsplBitmapStrategy } from './strategies/TsplBitmapStrategy';
import { TsplTextStrategy } from './strategies/TsplTextStrategy';
import type { TsplStrategyContext } from './strategies/tsplStrategy.types';
import type { IPrinterAdapter } from '../../adapters/IPrinterAdapter';
import { toConnectTarget } from '../../adapters/IPrinterAdapter';
import { resolvePrinterAdapter } from '../../adapters/resolvePrinterAdapter';
import { PrinterErrorException, PrinterErrorCode, errorCodeOf } from '../../errors/PrinterError';
import { ensureBluetoothPermission } from '../../permissions/PrinterPermissionService';
import { PrinterLogger } from '../../logging/PrinterLogger';

const IDENTIFY_TIMEOUT_MS = 1000;

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

const tsplBitmapStrategy = new TsplBitmapStrategy();
const tsplTextStrategy = new TsplTextStrategy();

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, IPrinterAdapter>();
  private contexts = new Map<string, Printer>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: PrinterConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === PrinterConnectionType.Lan) {
      onEvent({ type: DeviceScanEventType.Empty });
      return () => undefined;
    }

    if (connectionType === PrinterConnectionType.Usb) {
      onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'TsplDriver không tự quét USB' } });
      return () => undefined;
    }

    onEvent({ type: DeviceScanEventType.Loading });
    let cancelled = false;
    const startedAt = Date.now();

    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) {
          return;
        }

        if (!granted) {
          onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }

        RNBluetoothClassic.startDiscovery()
          .then((devices) => {
            if (cancelled) {
              return;
            }

            onEvent({
              type: devices.length > 0 ? DeviceScanEventType.Found : DeviceScanEventType.Empty,
              devices: devices.map((d) => ({ deviceId: d.address, displayName: d.name ?? d.address, rawDevice: d as unknown as Record<string, unknown> })),
            });
            PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
          })
          .catch((error: unknown) => {
            if (cancelled) {
              return;
            }

            onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
      });

    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(printer: Printer): Promise<void> {
    this.setStatus(printer.id, PrinterStatus.Connecting);
    const startedAt = Date.now();

    try {
      if (printer.connection.type === PrinterConnectionType.Bluetooth) {
        const granted = await ensureBluetoothPermission();

        if (!granted) {
          throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' });
        }
      }

      const adapter = resolvePrinterAdapter(PrinterDriverType.Tspl, printer.connection.type);
      await adapter.connect(toConnectTarget(printer));

      this.connections.set(printer.id, adapter);
      this.contexts.set(printer.id, printer);
      this.setStatus(printer.id, PrinterStatus.Connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.Tspl, connectionType: printer.connection.type, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.Error);
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.Tspl, connectionType: printer.connection.type, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, PrinterStatus.Disconnecting);
    const adapter = this.connections.get(printerId);

    try {
      await adapter?.disconnect();
    } catch (error) {
      this.setStatus(printerId, PrinterStatus.Error);
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.Tspl, errorCode: errorCodeOf(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.connections.delete(printerId);
    }

    this.setStatus(printerId, PrinterStatus.Disconnected);
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrinterDriverType.Tspl });
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? PrinterStatus.Idle;
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) {
      this.listeners.set(printerId, new Set());
    }

    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  /** Chọn strategy theo renderMode — y hệt cách EscPosDriver.sendDocuments() rẽ nhánh. */
  private buildBytes(printer: Printer, documents: PrintDocuments, rows: number): Uint8Array {
    const strategy = printer.driver.config.renderMode === RenderMode.Bitmap ? tsplBitmapStrategy : tsplTextStrategy;
    const context: TsplStrategyContext = {
      printer,
      documents,
      printType: printer.type,
      paper: printer.paper,
      rows,
    };

    strategy.validate(context);
    return strategy.encode(context);
  }

  async testPrint(printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void> {
    const startedAt = Date.now();

    try {
      if (!this.connections.has(printer.id)) {
        await this.connect(printer);
      }

      const adapter = this.connections.get(printer.id);
      const rows = resolveRows(options);
      const bytes = this.buildBytes(printer, documents, rows);
      await adapter?.write(bytes);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.Tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.Tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async print(printerId: string, documents: PrintDocuments, options?: PrintOptions): Promise<void> {
    const printer = this.contexts.get(printerId);
    const adapter = this.connections.get(printerId);

    if (!printer || !adapter) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }

    const startedAt = Date.now();

    try {
      const rows = resolveRows(options);
      const bytes = this.buildBytes(printer, documents, rows);
      await adapter.write(bytes);
      PrinterLogger.printSucceeded({ printerId, protocol: PrinterDriverType.Tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: PrinterDriverType.Tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const adapter = this.connections.get(printerId);

    if (!adapter || !adapter.canRead) {
      return null;
    }

    try {
      const query = encodeAsciiCommand('~!T\r\n');
      await adapter.write(query);
      const response = await adapter.read(IDENTIFY_TIMEOUT_MS);
      return response && response.length > 0 ? {} : null;
    } catch {
      return null;
    }
  }
}
