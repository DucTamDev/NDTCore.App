// src/features/printer/drivers/EscPosDriver.ts
import { Printer, PrintersDiscovery, DiscoveryPortType, BarcodeType, SymbolType } from 'react-native-esc-pos-printer';
import type { DeviceInfo } from 'react-native-esc-pos-printer';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import type { PrintDocument } from '../types/printDocument.types';
import { AppErrorException } from '../../../types/AppError';

/**
 * Chiều rộng ảnh mặc định (đơn vị: dot) khi in phần tử `image` — `PrintImageElement`
 * (Task 2) không mang theo `width`, và SDK Epson yêu cầu tham số này là bắt buộc.
 * 384 dot tương ứng khổ giấy nhiệt 58mm/80mm phổ biến; đây là giá trị cố định
 * tạm thời, CHƯA phải kích thước "đúng" theo khổ giấy thực tế của từng máy in
 * (xem `PrinterConfig.paperSize`) — cần điều chỉnh ở task sau nếu cần chính xác hơn.
 * (Default image width (in dots) for the `image` element — `PrintImageElement`
 * (Task 2) carries no `width`, and the Epson SDK requires this param. 384 dots
 * matches common 58mm/80mm thermal paper; this is a fixed placeholder, NOT a
 * value derived from the printer's actual `paperSize` — revisit in a later task
 * if per-paper-size accuracy is needed.)
 */
const DEFAULT_IMAGE_WIDTH_DOTS = 384;

/**
 * Kích cỡ QR code mặc định khi in phần tử `qrCode` — `PrintQrCodeElement`
 * (Task 2) không mang theo `size`, và SDK Epson yêu cầu tham số này là bắt buộc.
 * (Default QR code size for the `qrCode` element — `PrintQrCodeElement`
 * (Task 2) carries no `size`, and the Epson SDK requires this param.)
 */
const DEFAULT_QR_SYMBOL_SIZE = 4;

/**
 * Cổng phát hiện thiết bị của `react-native-esc-pos-printer` (Epson ePOS2 SDK)
 * tương ứng với từng loại kết nối trong `ConnectionType`.
 * (Discovery port for `react-native-esc-pos-printer` (Epson ePOS2 SDK) mapped
 * from each `ConnectionType`.)
 */
const portTypeByConnectionType: Record<ConnectionType, number> = {
  lan: DiscoveryPortType.PORTTYPE_TCP,
  bluetooth: DiscoveryPortType.PORTTYPE_BLUETOOTH,
  usb: DiscoveryPortType.PORTTYPE_USB,
};

const targetPrefixByConnectionType: Record<ConnectionType, string> = {
  lan: 'TCP',
  bluetooth: 'BT',
  usb: 'USB',
};

const buildTarget = (config: PrinterConfig): string => {
  if (config.connectionType === 'lan' && config.lan) return `TCP:${config.lan.ip}`;
  if (config.device) return `${targetPrefixByConnectionType[config.connectionType]}:${config.device.deviceId}`;
  throw new AppErrorException({
    code: 'VALIDATION_ERROR',
    message: 'Thiếu thông tin thiết bị/địa chỉ để kết nối máy in ESC/POS',
  });
};

/**
 * Driver ESC/POS cho máy in hoá đơn, dùng thư viện `react-native-esc-pos-printer`
 * (bọc SDK Epson ePOS2 gốc). Khác với TSPL, thư viện này không dùng transport
 * tự viết mà cung cấp sẵn class `Printer` (kết nối/in theo target string dạng
 * `TCP:`/`BT:`/`USB:`) và singleton `PrintersDiscovery` (phát hiện thiết bị
 * qua event `onDiscovery`/`onError`).
 * (ESC/POS driver for receipt printers, backed by `react-native-esc-pos-printer`
 * (a wrapper around the native Epson ePOS2 SDK). Unlike TSPL, this library does
 * not use hand-written transports — it exposes a `Printer` class (connect/print
 * via a `TCP:`/`BT:`/`USB:` target string) and a `PrintersDiscovery` singleton
 * (device discovery via `onDiscovery`/`onError` events).)
 */
export class EscPosDriver implements IPrinterDriver {
  private printers = new Map<string, Printer>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    onEvent({ type: 'loading' });

    const removeDiscoveryListener = PrintersDiscovery.onDiscovery((devices: DeviceInfo[]) => {
      onEvent({
        type: devices.length > 0 ? 'found' : 'empty',
        devices: devices.map((device) => ({
          deviceId: device.target,
          displayName: device.deviceName,
          rawDevice: device as unknown as Record<string, unknown>,
        })),
      });
    });
    const removeErrorListener = PrintersDiscovery.onError((error: unknown) => {
      onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
    });

    PrintersDiscovery.start({ filterOption: { portType: portTypeByConnectionType[connectionType] } }).catch(
      (error: unknown) => {
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      }
    );

    return () => {
      removeDiscoveryListener();
      removeErrorListener();
      PrintersDiscovery.stop().catch(() => undefined);
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      const target = buildTarget(config);
      const printer = new Printer({ target, deviceName: config.printerName });
      await printer.connect();
      this.printers.set(config.id, printer);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const printer = this.printers.get(printerId);
    if (printer) await printer.disconnect();
    this.printers.delete(printerId);
    this.setStatus(printerId, 'disconnected');
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  /**
   * Gọi `printer.getStatus()` — nếu SDK trả về (không throw), máy in đã phản
   * hồi đúng lệnh ESC/POS status, coi là xác nhận protocol. SDK không có API
   * đọc vendor/model (chỉ có paper/density/speed settings), nên chỉ trả về
   * `deviceName` — xem spec §8 (rủi ro đã ghi nhận).
   */
  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const printer = this.printers.get(printerId);
    if (!printer) return null;
    try {
      await printer.getStatus();
      return { deviceName: printer.deviceName };
    } catch {
      return null;
    }
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig): Promise<void> {
    await this.connect(config);
    const printer = this.printers.get(config.id);
    if (!printer) return;
    await printer.addText('NDTCore POS - In thu\n');
    await printer.addFeedLine();
    await printer.addCut();
    await printer.sendData();
  }

  /**
   * Mã hoá `PrintDocument` bằng cách gọi trực tiếp các hàm dựng lệnh của SDK
   * Epson (`addText`/`addImage`/`addBarcode`/`addSymbol`) trên `Printer` đang
   * kết nối, rồi feed/cut/gửi dữ liệu 1 lần. Khác với `TsplDriver` (tự mã hoá
   * byte thô), driver này không có bước "encode" riêng — SDK tự quản lý buffer
   * lệnh nội bộ của `Printer` instance.
   * Ném `CONNECTION_ERROR` nếu máy in chưa kết nối, `ENCODING_FAILED` cho loại
   * phần tử không được hỗ trợ.
   */
  async print(printerId: string, document: PrintDocument): Promise<void> {
    const printer = this.printers.get(printerId);
    if (!printer) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
    }
    for (const element of document.elements) {
      if (element.type === 'text') {
        await printer.addText(`${element.content}\n`);
      } else if (element.type === 'line') {
        await printer.addText('--------------------------------\n');
      } else if (element.type === 'table') {
        for (const row of element.rows) await printer.addText(`${row.join('  ')}\n`);
      } else if (element.type === 'image') {
        await printer.addImage({ source: { uri: element.data }, width: DEFAULT_IMAGE_WIDTH_DOTS });
      } else if (element.type === 'barcode') {
        await printer.addBarcode({ data: element.content, type: BarcodeType.BARCODE_CODE128 });
      } else if (element.type === 'qrCode') {
        await printer.addSymbol({
          data: element.content,
          type: SymbolType.SYMBOL_QRCODE_MODEL_2,
          size: DEFAULT_QR_SYMBOL_SIZE,
        });
      } else {
        throw new AppErrorException({
          code: 'ENCODING_FAILED',
          message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}`,
        });
      }
    }
    await printer.addFeedLine();
    await printer.addCut();
    await printer.sendData();
  }
}
