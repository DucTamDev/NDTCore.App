import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, PrintDocuments, Unsubscribe } from '../../types/driver.types';
import { ConnectionType, PrinterDriverType, PrinterStatus } from '../../types/printer.types';
import { DeviceScanEventType } from '../../types/printer.types';
import type { DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver, TsplFontConfig, UsbRawDevice } from '../../types/printer.types';
import { PrintType } from '../../types/printConfiguration.types';
import { DEFAULT_LABEL_HEIGHT_MM, CONTINUOUS_HEIGHT_MM } from './TsplEncoder';
import { TsplFontManager } from './TsplFontManager';
import { resolveTsplStrategy } from './TsplStrategyRegistry';
import type { TsplStrategyContext } from './strategies/tsplStrategy.types';
import { LanTransport } from '../../transports/LanTransport';
import { BluetoothTransport } from '../../transports/BluetoothTransport';
import { UsbTransport } from '../../transports/UsbTransport';
import { AppErrorException, AppErrorCode, errorCodeOf } from '../../types/AppError';
import { ensureBluetoothPermission } from '../../services/PrinterPermissionService';
import { PrinterLogger } from '../../services/PrinterLogger';

export type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;

const IDENTIFY_TIMEOUT_MS = 1000;

const encodeAsciiCommand = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional single-byte masking
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

const resolveHeightMm = (driver: PrinterDriver, printType: PrintType): number => {
  const labelHeightMm = driver.config.type === PrinterDriverType.tspl ? driver.config.labelHeightMm : undefined;
  return printType === PrintType.Label ? (labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM) : CONTINUOUS_HEIGHT_MM;
};

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, TsplTransport>();
  private contexts = new Map<string, { printer: Printer; driver: PrinterDriver }>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private fontManager = new TsplFontManager();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private createTransport(connectionType: ConnectionType): TsplTransport {
    if (connectionType === ConnectionType.lan) return new LanTransport();
    if (connectionType === ConnectionType.bluetooth) return new BluetoothTransport();
    return new UsbTransport();
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === ConnectionType.lan) {
      onEvent({ type: DeviceScanEventType.empty });
      return () => undefined;
    }
    if (connectionType === ConnectionType.usb) {
      onEvent({ type: DeviceScanEventType.error, error: { code: AppErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'TsplDriver không tự quét USB' } });
      return () => undefined;
    }
    onEvent({ type: DeviceScanEventType.loading });
    let cancelled = false;
    const startedAt = Date.now();
    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: DeviceScanEventType.error, error: { code: AppErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
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
            onEvent({ type: DeviceScanEventType.error, error: { code: AppErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: AppErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onEvent({ type: DeviceScanEventType.error, error: { code: AppErrorCode.PRINTER_CONNECTION_FAILED, message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: AppErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
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
      const transport = this.createTransport(printer.connectionType);
      if (printer.connectionType === ConnectionType.lan) {
        if (!printer.lan) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(printer.lan.ip, printer.lan.port);
      } else if (printer.connectionType === ConnectionType.bluetooth) {
        if (!printer.device) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
        const granted = await ensureBluetoothPermission();
        if (!granted) throw new AppErrorException({ code: AppErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' });
        await (transport as BluetoothTransport).connect(printer.device.deviceId);
      } else {
        if (!printer.device) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị USB' });
        const raw = printer.device.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
        await (transport as UsbTransport).connect(Number(raw.vendor_id), Number(raw.product_id));
      }
      this.connections.set(printer.id, transport);
      this.contexts.set(printer.id, { printer, driver });
      this.setStatus(printer.id, PrinterStatus.connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.tspl, connectionType: printer.connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.error);
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.tspl, connectionType: printer.connectionType, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, PrinterStatus.disconnecting);
    const transport = this.connections.get(printerId);
    try {
      await transport?.close();
    } catch (error) {
      this.setStatus(printerId, PrinterStatus.error);
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.tspl, errorCode: errorCodeOf(error) });
      throw new AppErrorException({ code: AppErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
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
  private buildBytes(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType): Uint8Array {
    if (driver.config.type !== PrinterDriverType.tspl) {
      throw new AppErrorException({ code: AppErrorCode.TSPL_RENDER_MODE_UNSUPPORTED, message: 'Driver không phải TSPL.' });
    }
    const strategy = resolveTsplStrategy(driver.config.renderMode);
    const context: TsplStrategyContext = {
      printer,
      driver,
      documents,
      printType,
      heightMm: resolveHeightMm(driver, printType),
    };
    strategy.validate(context);
    return strategy.encode(context);
  }

  private async writeBytes(printer: Printer, transport: TsplTransport | undefined, bytes: Uint8Array): Promise<void> {
    if (printer.connectionType === ConnectionType.lan) {
      (transport as LanTransport).write(bytes);
    } else if (printer.connectionType === ConnectionType.bluetooth) {
      await (transport as BluetoothTransport).write(bytes);
    } else {
      await (transport as UsbTransport).write(bytes);
    }
  }

  async testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType): Promise<void> {
    const startedAt = Date.now();
    try {
      if (!this.connections.has(printer.id)) {
        await this.connect(printer, driver);
      }
      const transport = this.connections.get(printer.id);
      const bytes = this.buildBytes(printer, driver, documents, printType);
      await this.writeBytes(printer, transport, bytes);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async print(printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void> {
    const context = this.contexts.get(printerId);
    const transport = this.connections.get(printerId);
    if (!context || !transport) {
      throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }
    const bytes = this.buildBytes(context.printer, context.driver, documents, printType);
    await this.writeBytes(context.printer, transport, bytes);
  }

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const transport = this.connections.get(printerId);
    if (!transport || !('readOnce' in transport)) return null;
    try {
      const query = encodeAsciiCommand('~!T\r\n');
      await transport.write(query);
      const response = await transport.readOnce(IDENTIFY_TIMEOUT_MS);
      return response && response.length > 0 ? {} : null;
    } catch {
      return null;
    }
  }

  async installTrueTypeFont(printerId: string, font: TsplFontConfig): Promise<void> {
    const transport = this.connections.get(printerId);
    if (!transport) {
      throw new AppErrorException({ code: AppErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }
    await this.fontManager.ensureFontInstalled(transport, font);
  }
}
