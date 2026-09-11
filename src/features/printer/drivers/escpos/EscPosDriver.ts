import { Platform } from 'react-native';
import type { IPrinterDriver, PrintDocuments, PrintOptions, Unsubscribe } from '../IPrinterDriver';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';
import { RenderMode, PrinterDriverType } from '../../models/printer/PrinterDriver';
import { PrinterStatus } from '../../models/printer/PrinterStatus';
import { CutterMode } from '../../models/paper/PrintPaperConfig';
import { DeviceScanEventType } from '../../models/printer/PrinterDevice';
import type { DeviceScanEvent, PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { Printer } from '../../models/printer/Printer';
import { PrinterErrorException, PrinterErrorCode, errorCodeOf } from '../../errors/PrinterError';
import { ensureBluetoothPermission } from '../../permissions/PrinterPermissionService';
import { PrinterLogger } from '../../logging/PrinterLogger';
import { LoggerService } from '../../../../services/LoggerService';
import { NativeAdapter } from '../../adapters/native/NativeAdapter';
import { toConnectTarget } from '../../adapters/IPrinterAdapter';
import { buildEscPosText } from './EscPosTextBuilder';
import { buildEscPosBitmapBytes } from './EscPosBitmapEncoder';
import { resolveEffectiveCutterMode } from '../../paper/cutter';
import { decodePngBase64ToMonochrome } from '../../utils/pngToMonochrome';
import { PAPER_SIZE_SPECS, DOTS_PER_MM, CONTINUOUS_HEIGHT_MM } from '../../paper/paperSpec';

const ESC_POS_BASE_OPTIONS = { keepConnection: true, tailingLine: true, encoding: 'UTF8' } as const;

/**
 * ESC/POS đi qua `NativeAdapter` (`IPrinterAdapter`) — native module RN*Printer
 * gộp connect+encode+write theo namespace/connectionType (spec §2.3, ngoại lệ
 * pragmatic: KHÔNG dùng `read`, `printText` encode ở JS `EPToolkit`). Native là
 * singleton per connectionType → `activeByType` giữ đúng 1 owner/loại.
 */
export class EscPosDriver implements IPrinterDriver {
  private adapters = new Map<string, NativeAdapter>();
  private connectedTypes = new Map<string, PrinterConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private contexts = new Map<string, Printer>();
  private activeByType = new Map<PrinterConnectionType, string>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: PrinterConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === PrinterConnectionType.Lan) {
      onEvent({ type: DeviceScanEventType.Empty });
      return () => undefined;
    }

    if (connectionType === PrinterConnectionType.Usb && Platform.OS !== 'android') {
      onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_UNSUPPORTED_CONNECTION, message: 'USB chỉ hỗ trợ trên Android' } });
      return () => undefined;
    }

    let cancelled = false;
    onEvent({ type: DeviceScanEventType.Loading });
    const startedAt = Date.now();

    const run = async (): Promise<void> => {
      try {
        if (connectionType === PrinterConnectionType.Bluetooth) {
          const granted = await ensureBluetoothPermission();

          if (cancelled) {
            return;
          }

          if (!granted) {
            onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: 'Chưa được cấp quyền Bluetooth' } });
            return;
          }
        }

        const devices = await new NativeAdapter().listDevices(connectionType);

        if (cancelled) {
          return;
        }

        LoggerService.debug('EscPosDriver.scan: devices', { connectionType, devices });
        onEvent({ type: devices.length > 0 ? DeviceScanEventType.Found : DeviceScanEventType.Empty, devices });
        PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);

        if (/no device found/i.test(message)) {
          onEvent({ type: DeviceScanEventType.Empty });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: 0, durationMs: Date.now() - startedAt });
          return;
        }

        onEvent({ type: DeviceScanEventType.Error, error: { code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message } });
        PrinterLogger.scanFailed({ connectionType, errorCode: PrinterErrorCode.PRINTER_CONNECTION_FAILED, durationMs: Date.now() - startedAt });
      }
    };

    run();
    return () => {
      cancelled = true;
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

      const adapter = new NativeAdapter();
      await adapter.connect(toConnectTarget(printer));

      this.adapters.set(printer.id, adapter);
      this.connectedTypes.set(printer.id, printer.connection.type);
      this.contexts.set(printer.id, printer);

      const previousOwner = this.activeByType.get(printer.connection.type);

      if (previousOwner && previousOwner !== printer.id) {
        this.setStatus(previousOwner, PrinterStatus.Disconnected);
      }

      this.activeByType.set(printer.connection.type, printer.id);
      this.setStatus(printer.id, PrinterStatus.Connected);
      PrinterLogger.connectSucceeded({ printerId: printer.id, protocol: PrinterDriverType.EscPos, connectionType: printer.connection.type, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.setStatus(printer.id, PrinterStatus.Error);
      PrinterLogger.connectFailed({ printerId: printer.id, protocol: PrinterDriverType.EscPos, connectionType: printer.connection.type, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, PrinterStatus.Disconnecting);
    const connectionType = this.connectedTypes.get(printerId);
    const isActiveOwner = Boolean(connectionType) && this.activeByType.get(connectionType!) === printerId;

    try {
      if (isActiveOwner) {
        await this.adapters.get(printerId)?.disconnect();
      }
    } catch (error) {
      this.setStatus(printerId, PrinterStatus.Error);
      PrinterLogger.disconnectFailed({ printerId, protocol: PrinterDriverType.EscPos, errorCode: errorCodeOf(error) });
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (isActiveOwner) {
        this.activeByType.delete(connectionType!);
      }

      this.adapters.delete(printerId);
      this.connectedTypes.delete(printerId);
      this.contexts.delete(printerId);
    }

    this.setStatus(printerId, PrinterStatus.Disconnected);
    PrinterLogger.disconnectSucceeded({ printerId, protocol: PrinterDriverType.EscPos });
  }

  private async sendDocuments(adapter: NativeAdapter, printer: Printer, documents: PrintDocuments): Promise<void> {
    if (printer.driver.config.renderMode === RenderMode.Bitmap) {
      await this.sendBitmap(adapter, printer, documents);
      return;
    }

    const cut = resolveEffectiveCutterMode(printer.paper) !== CutterMode.None;
    const text = buildEscPosText(printer.paper.paperSize, documents);
    await adapter.printText(text, { ...ESC_POS_BASE_OPTIONS, cut });
  }

  /**
   * ESC/POS paper luôn `Continuous` (schema cấm die-cut cho ESC/POS) — không
   * cần lặp theo cột như TSPL die-cut, đơn giản hơn hẳn theo đúng lý do vật lý.
   */
  private async sendBitmap(adapter: NativeAdapter, printer: Printer, documents: PrintDocuments): Promise<void> {
    if (!documents.image) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_REQUIRED, message: 'Chế độ Bitmap cần ảnh bill đã render — capture ảnh thất bại hoặc chưa chạy.' });
    }

    const targetWidthPx = PAPER_SIZE_SPECS[printer.paper.paperSize].imageWidthPx;

    let bitmap;

    try {
      bitmap = decodePngBase64ToMonochrome(documents.image, targetWidthPx);
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_INVALID, message: 'Ảnh bill không hợp lệ (không giải mã được PNG).', cause: error });
    }

    const maxHeightPx = CONTINUOUS_HEIGHT_MM * DOTS_PER_MM;

    if (bitmap.heightPx > maxHeightPx) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_TOO_LARGE, message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt ngưỡng an toàn ${CONTINUOUS_HEIGHT_MM}mm.` });
    }

    const bytes = buildEscPosBitmapBytes(bitmap, resolveEffectiveCutterMode(printer.paper));
    // KHÔNG dùng adapter.printText() — cần chunk qua UsbTransport như TSPL bitmap
    // (printText() trên USB gọi thẳng writeByBase64 không chunk, bill dài dễ vượt 1 lần transfer).
    await adapter.write(bytes);
  }

  /** `_options` không dùng ở ESC/POS (không phân biệt bill/label, không grid) — chỉ giữ tham số để khớp `IPrinterDriver`. */
  async print(printerId: string, documents: PrintDocuments, _options?: PrintOptions): Promise<void> {
    const printer = this.contexts.get(printerId);
    const connectionType = this.connectedTypes.get(printerId);
    const adapter = this.adapters.get(printerId);

    if (!printer || !connectionType || !adapter || this.activeByType.get(connectionType) !== printerId) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_NOT_CONNECTED, message: 'Máy in chưa kết nối' });
    }

    const startedAt = Date.now();

    try {
      await this.sendDocuments(adapter, printer, documents);
      PrinterLogger.printSucceeded({ printerId, protocol: PrinterDriverType.EscPos, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({ printerId, protocol: PrinterDriverType.EscPos, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
      throw error;
    }
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

  /** `_options` không dùng ở ESC/POS (không phân biệt bill/label, không grid) — chỉ giữ tham số để khớp `IPrinterDriver`. */
  async testPrint(printer: Printer, documents: PrintDocuments, _options?: PrintOptions): Promise<void> {
    const startedAt = Date.now();

    try {
      const isStaleOwner = this.activeByType.get(printer.connection.type) !== printer.id;

      if (!this.adapters.has(printer.id) || isStaleOwner) {
        await this.connect(printer);
      }

      const adapter = this.adapters.get(printer.id);

      if (!adapter) {
        return;
      }

      await this.sendDocuments(adapter, printer, documents);
      PrinterLogger.testPrintSucceeded({ printerId: printer.id, protocol: PrinterDriverType.EscPos, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({ printerId: printer.id, protocol: PrinterDriverType.EscPos, errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
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

    if (!connectionType || connectionType === PrinterConnectionType.Usb) {
      return null;
    }

    return this.adapters.has(printerId) ? {} : null;
  }
}
