// src/features/printer/drivers/tspl/TsplDriver.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, PrintDocumentVariants, Unsubscribe } from '../../types/driver.types';
import { ConnectionType, isTsplTrueTypeActive, PrinterDriverType } from '../../types/printer.types';
import type { DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver, PrinterStatus, TsplFontConfig, UsbRawDevice } from '../../types/printer.types';
import type { PrintDocument } from '../../types/printDocument.types';
import { PrintType } from '../../types/printConfiguration.types';
import { TsplEncoder, DEFAULT_LABEL_HEIGHT_MM, CONTINUOUS_HEIGHT_MM, DOTS_PER_MM } from './TsplEncoder';
import { TsplFontManager } from './TsplFontManager';
import { LanTransport } from '../../transports/LanTransport';
import { BluetoothTransport } from '../../transports/BluetoothTransport';
import { UsbTransport } from '../../transports/UsbTransport';
import { AppErrorException, AppErrorCode, errorCodeOf } from '../../types/AppError';
import { ensureBluetoothPermission } from '../../services/PrinterPermissionService';
import { PrinterLogger } from '../../services/PrinterLogger';
import { PAPER_WIDTH_CHARS, PAPER_IMAGE_WIDTH_PX, formatRow } from '../../utils/paperWidth';
import { decodePngBase64ToMonochrome } from '../../utils/pngToMonochrome';

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

const resolveHeightMm = (driver: PrinterDriver, printType?: PrintType): number => {
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
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === ConnectionType.usb) {
      onEvent({ type: 'error', error: { code: AppErrorCode.UNSUPPORTED_CONNECTION, message: 'TsplDriver không tự quét USB' } });
      return () => undefined;
    }
    onEvent({ type: 'loading' });
    let cancelled = false;
    const startedAt = Date.now();
    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: 'error', error: { code: AppErrorCode.CONNECTION_ERROR, message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }
        RNBluetoothClassic.startDiscovery()
          .then((devices) => {
            if (cancelled) return;
            onEvent({
              type: devices.length > 0 ? 'found' : 'empty',
              devices: devices.map((d) => ({ deviceId: d.address, displayName: d.name ?? d.address, rawDevice: d as unknown as Record<string, unknown> })),
            });
            PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            onEvent({ type: 'error', error: { code: AppErrorCode.CONNECTION_ERROR, message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: AppErrorCode.CONNECTION_ERROR, durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onEvent({ type: 'error', error: { code: AppErrorCode.CONNECTION_ERROR, message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: AppErrorCode.CONNECTION_ERROR, durationMs: Date.now() - startedAt });
      });
    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(printer: Printer, driver: PrinterDriver): Promise<void> {
    this.setStatus(printer.id, 'connecting');
    const startedAt = Date.now();
    try {
      const transport = this.createTransport(printer.connectionType);
      if (printer.connectionType === ConnectionType.lan) {
        if (!printer.lan) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(printer.lan.ip, printer.lan.port);
      } else if (printer.connectionType === ConnectionType.bluetooth) {
        if (!printer.device) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
        const granted = await ensureBluetoothPermission();
        if (!granted) throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: 'Chưa được cấp quyền Bluetooth' });
        await (transport as BluetoothTransport).connect(printer.device.deviceId);
      } else {
        if (!printer.device) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị USB' });
        const raw = printer.device.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: AppErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
        await (transport as UsbTransport).connect(Number(raw.vendor_id), Number(raw.product_id));
      }
      this.connections.set(printer.id, transport);
      this.contexts.set(printer.id, { printer, driver });
      this.setStatus(printer.id, 'connected');
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.tspl, connectionType: printer.connectionType, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, 'error');
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.tspl, connectionType: printer.connectionType, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const transport = this.connections.get(printerId);
    try {
      await transport?.close();
    } catch (error) {
      this.setStatus(printerId, 'error');
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.tspl, errorCode: errorCodeOf(error) });
      throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.connections.delete(printerId);
    }
    this.setStatus(printerId, 'disconnected');
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrinterDriverType.tspl });
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  /**
   * `truetype` chỉ có hiệu lực khi `renderMode === 'truetype'` VÀ
   * `font.fontInstalled === true` — mọi trường hợp khác (chưa cài, cài
   * thất bại, không có config font) đều fallback `'bitmap'`. Fallback CỨNG,
   * không có nhánh nào khác — xem spec 2026-08-27 §7.
   */
  private resolveDocumentAndFont(driver: PrinterDriver, documents: PrintDocumentVariants): { document: PrintDocument; fontName: string } {
    if (isTsplTrueTypeActive(driver) && driver.config.type === PrinterDriverType.tspl && driver.config.font) {
      return { document: documents.text, fontName: driver.config.font.name };
    }
    return { document: documents.image ?? documents.text, fontName: '3' };
  }

  private encodeElements(
    encoder: TsplEncoder,
    document: PrintDocument,
    paperSize: Printer['paperSize'],
    heightMm: number,
    fontName: string,
  ): void {
    const paperWidth = PAPER_WIDTH_CHARS[paperSize];
    for (const element of document.elements) {
      if (element.type === 'text') {
        encoder.text(element.x, element.y, element.content, fontName);
      } else if (element.type === 'line') {
        encoder.text(element.x, element.y, '-'.repeat(paperWidth), fontName);
      } else if (element.type === 'table') {
        element.rows.forEach((row, i) => encoder.text(element.x, element.y + i * 20, row.join('  '), fontName));
      } else if (element.type === 'row') {
        encoder.text(element.x, element.y, formatRow(element.left, element.right, paperWidth), fontName);
      } else if (element.type === 'image') {
        const bitmap = decodePngBase64ToMonochrome(element.data, PAPER_IMAGE_WIDTH_PX[paperSize]);
        const maxHeightPx = heightMm * DOTS_PER_MM;
        if (bitmap.heightPx > maxHeightPx) {
          throw new AppErrorException({
            code: AppErrorCode.ENCODING_FAILED,
            message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — dùng giấy dài hơn hoặc rút gọn nội dung.`,
          });
        }
        encoder.image(element.x, element.y, bitmap);
      } else if (element.type === 'barcode') {
        encoder.barcode(element.x, element.y, element.content);
      } else if (element.type === 'qrCode') {
        encoder.qrcode(element.x, element.y, element.content);
      } else {
        throw new AppErrorException({ code: AppErrorCode.ENCODING_FAILED, message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
      }
    }
  }

  encode(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Uint8Array {
    const heightMm = resolveHeightMm(driver, printType);
    const { document, fontName } = this.resolveDocumentAndFont(driver, documents);
    const encoder = new TsplEncoder().initialize(printer.paperSize, printType, heightMm);
    this.encodeElements(encoder, document, printer.paperSize, heightMm, fontName);
    return encoder.cut().encode();
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

  async testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Promise<void> {
    const startedAt = Date.now();
    try {
      if (!this.connections.has(printer.id)) {
        await this.connect(printer, driver);
      }
      const transport = this.connections.get(printer.id);
      const bytes = this.encode(printer, driver, documents, printType);
      await this.writeBytes(printer, transport, bytes);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.tspl, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.tspl, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async print(printerId: string, documents: PrintDocumentVariants, printType?: PrintType): Promise<void> {
    const context = this.contexts.get(printerId);
    const transport = this.connections.get(printerId);
    if (!context || !transport) {
      throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: 'Máy in chưa kết nối' });
    }
    const bytes = this.encode(context.printer, context.driver, documents, printType);
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
      throw new AppErrorException({ code: AppErrorCode.CONNECTION_ERROR, message: 'Máy in chưa kết nối' });
    }
    await this.fontManager.ensureFontInstalled(transport, font);
  }
}
