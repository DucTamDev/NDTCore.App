import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, Unsubscribe } from '../IPrinterDriver';
import type { PrintDocuments } from '../../models/printing/PrintDocuments';
import type { PrintOptions } from '../../models/printing/PrintOptions';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { PrintLanguage } from '../../models/printer/PrinterLanguage';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { DeviceScanEventType } from '../../models/printer/PrinterDevice';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { Printer } from '../../models/printer/Printer';
import { TsplLanguage } from '../../languages/tspl/TsplLanguage';
import type { IPrinterAdapter } from '../../adapters/IPrinterAdapter';
import { toConnectTarget } from '../../adapters/IPrinterAdapter';
import { resolvePrinterAdapter } from '../../adapters/resolvePrinterAdapter';
import { subscribeDeviceDisconnected } from '../../adapters/native/DeviceModule';
import type { NativeAdapter } from '../../adapters/native/NativeAdapter';
import { PrinterErrorException, PrinterErrorCode, errorCodeOf } from '../../errors/PrinterError';
import { ensureBluetoothPermission } from '../../permissions/PrinterPermissionService';
import { PrinterLogger } from '../../logging/PrinterLogger';

const IDENTIFY_TIMEOUT_MS = 1000;

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, IPrinterAdapter>();
  private contexts = new Map<string, Printer>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private connectionIds = new Map<string, string>();

  constructor() {
    subscribeDeviceDisconnected((event) => {
      for (const [printerId, connectionId] of this.connectionIds) {
        if (connectionId === event.connectionId) {
          this.setStatus(printerId, PrinterStatus.Disconnected);
        }
      }
    });
  }

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === ConnectionType.Lan) {
      onEvent({ type: DeviceScanEventType.Empty });
      return () => undefined;
    }

    if (connectionType === ConnectionType.Usb) {
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

  /** Trả kết nối của adapter cũ cùng máy in; lỗi khi đóng không được làm hỏng lần kết nối mới nên chỉ ghi log. */
  private async releaseReplacedAdapter(printerId: string, adapter: IPrinterAdapter | undefined): Promise<void> {
    // Adapter thư viện (BLE/LAN) dùng chung socket theo địa chỉ nên ngắt adapter cũ sẽ ngắt cả kết nối mới.
    if (adapter?.source !== 'native') {
      return;
    }

    try {
      await adapter.disconnect();
    } catch (error) {
      PrinterLogger.disconnectFailed({ printerId, protocol: PrintLanguage.Tspl, errorCode: errorCodeOf(error) });
    }
  }

  async connect(printer: Printer): Promise<void> {
    this.setStatus(printer.id, PrinterStatus.Connecting);
    const startedAt = Date.now();

    try {
      if (printer.connection.type === ConnectionType.Bluetooth) {
        const granted = await ensureBluetoothPermission();

        if (!granted) {
          throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' });
        }
      }

      const adapter = resolvePrinterAdapter(PrintLanguage.Tspl, printer.connection.type);
      await adapter.connect(toConnectTarget(printer));

      const replacedAdapter = this.connections.get(printer.id);
      this.connections.set(printer.id, adapter);
      this.contexts.set(printer.id, printer);

      if (adapter.source === 'native') {
        const connectionId = (adapter as NativeAdapter).getConnectionId();

        if (connectionId) {
          this.connectionIds.set(printer.id, connectionId);
        }
      }

      await this.releaseReplacedAdapter(printer.id, replacedAdapter);

      this.setStatus(printer.id, PrinterStatus.Connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrintLanguage.Tspl, connectionType: printer.connection.type, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.Error);
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrintLanguage.Tspl, connectionType: printer.connection.type, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
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
      PrinterLogger.disconnectFailed({ printerId, protocol: PrintLanguage.Tspl, errorCode: errorCodeOf(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.connections.delete(printerId);
      this.connectionIds.delete(printerId);
    }

    this.setStatus(printerId, PrinterStatus.Disconnected);
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrintLanguage.Tspl });
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

  async testPrint(printer: Printer, documents: PrintDocuments, options?: PrintOptions): Promise<void> {
    const startedAt = Date.now();

    try {
      if (!this.connections.has(printer.id)) {
        await this.connect(printer);
      }

      const adapter = this.connections.get(printer.id);
      await adapter?.write(TsplLanguage.encode(printer, documents, options));
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrintLanguage.Tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrintLanguage.Tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
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
      await adapter.write(TsplLanguage.encode(printer, documents, options));
      PrinterLogger.printSucceeded({ printerId, protocol: PrintLanguage.Tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: PrintLanguage.Tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const adapter = this.connections.get(printerId);

    const probe = TsplLanguage.identifyProbe;

    if (!adapter || !adapter.canRead || !probe) {
      return null;
    }

    try {
      await adapter.write(probe.command);
      const response = await adapter.read(IDENTIFY_TIMEOUT_MS);
      return response && probe.matches(response) ? {} : null;
    } catch {
      return null;
    }
  }
}
