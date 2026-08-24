// src/features/printer/drivers/TsplDriver.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import type { PrintDocument } from '../types/printDocument.types';
import type { PrintType } from '../types/printConfiguration.types';
import { TsplEncoder, DEFAULT_LABEL_HEIGHT_MM, CONTINUOUS_HEIGHT_MM, DOTS_PER_MM } from '../protocols/TsplEncoder';
import { LanTransport } from '../transports/LanTransport';
import { BluetoothTransport } from '../transports/BluetoothTransport';
import { UsbTransport } from '../transports/UsbTransport';
import { AppErrorException, type AppErrorCode } from '../types/AppError';
import { ensureBluetoothPermission } from '../services/PrinterPermissionService';
import { PrinterLogger } from '../services/PrinterLogger';
import { PAPER_WIDTH_CHARS, PAPER_IMAGE_WIDTH_PX, formatRow } from '../utils/paperWidth';
import { decodePngBase64ToMonochrome } from '../utils/pngToMonochrome';

type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;

const IDENTIFY_TIMEOUT_MS = 1000;

/** Shape thật của `PrinterDevice.rawDevice` cho thiết bị USB — giống hệt cách `ThermalReceiptDriver` đọc. */
interface UsbRawDevice {
  vendor_id: number;
  product_id: number;
}

const errorCodeOf = (error: unknown): AppErrorCode =>
  error instanceof AppErrorException ? error.code : 'UNKNOWN_ERROR';

/**
 * Mã hoá 1 lệnh TSPL ASCII đơn giản thành byte thô — dùng riêng cho lệnh dò
 * trạng thái trong `identify()`, không qua `TsplEncoder` (vốn dành cho nội
 * dung in thật, không có API gửi lệnh raw).
 */
const encodeAsciiCommand = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional single-byte masking, same as TsplEncoder.encode()
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, TsplTransport>();
  private configs = new Map<string, PrinterConfig>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private createTransport(connectionType: ConnectionType): TsplTransport {
    if (connectionType === 'lan') return new LanTransport();
    if (connectionType === 'bluetooth') return new BluetoothTransport();
    return new UsbTransport();
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb') {
      // TsplDriver không tự quét USB — PrinterService.scanForConnectionType()
      // luôn uỷ quyền quét USB cho ThermalReceiptDriver (thiết bị USB là chung,
      // không phân biệt được escpos/tspl ở bước quét), rồi mới xác nhận
      // protocol thật qua discoverProtocol()/identify(). Nhánh này chỉ tồn tại
      // để scan() không treo nếu có nơi khác gọi trực tiếp.
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'TsplDriver không tự quét USB' },
      });
      return () => undefined;
    }
    onEvent({ type: 'loading' });
    let cancelled = false;
    const startedAt = Date.now();
    ensureBluetoothPermission()
      .then((granted) => {
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }
        RNBluetoothClassic.startDiscovery()
          .then((devices) => {
            if (cancelled) return;
            onEvent({
              type: devices.length > 0 ? 'found' : 'empty',
              devices: devices.map((d) => ({
                deviceId: d.address,
                displayName: d.name ?? d.address,
                rawDevice: d as unknown as Record<string, unknown>,
              })),
            });
            PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
            PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
          });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
        PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
      });
    return () => {
      cancelled = true;
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    const startedAt = Date.now();
    try {
      const transport = this.createTransport(config.connectionType);
      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(config.lan.ip, config.lan.port);
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        const granted = await ensureBluetoothPermission();
        if (!granted) {
          throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' });
        }
        await (transport as BluetoothTransport).connect(config.device.deviceId);
      } else {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị USB' });
        }
        const raw = config.device.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu thông tin thiết bị USB' });
        await (transport as UsbTransport).connect(Number(raw.vendor_id), Number(raw.product_id));
      }
      this.connections.set(config.id, transport);
      this.configs.set(config.id, config);
      this.setStatus(config.id, 'connected');
      PrinterLogger.connectSucceeded({
        printerId: config.id,
        protocol: config.protocol,
        connectionType: config.connectionType,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      this.setStatus(config.id, 'error');
      PrinterLogger.connectFailed({
        printerId: config.id,
        protocol: config.protocol,
        connectionType: config.connectionType,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  /**
   * `transport.close()` có thể reject (thiết bị đã mất kết nối trước khi kịp
   * đóng chủ động) — `this.connections.delete()` vẫn PHẢI chạy dù close thất
   * bại, nằm trong `finally`, nếu không driver kẹt mãi ở status
   * `disconnecting` và `print()`/`identify()` sau đó vẫn tưởng còn transport
   * để dùng (dù nó đã hỏng).
   */
  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const transport = this.connections.get(printerId);
    try {
      await transport?.close();
    } catch (error) {
      this.setStatus(printerId, 'error');
      PrinterLogger.disconnectFailed({ printerId, protocol: 'tspl', errorCode: errorCodeOf(error) });
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: error instanceof Error ? error.message : String(error) });
    } finally {
      this.connections.delete(printerId);
    }
    this.setStatus(printerId, 'disconnected');
    PrinterLogger.disconnectSucceeded({ printerId, protocol: 'tspl' });
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig, document: PrintDocument, printType?: PrintType): Promise<void> {
    const startedAt = Date.now();
    try {
      // Nằm trong try/catch để lỗi reconnect cũng được ghi testPrintFailed,
      // không phải chỉ mỗi connectFailed nội bộ của connect().
      if (!this.connections.has(config.id)) {
        await this.connect(config);
      }
      const transport = this.connections.get(config.id);
      const heightMm = this.resolveHeightMm(config, printType);
      const encoder = new TsplEncoder().initialize(config.paperSize, printType, heightMm);
      this.encodeElements(encoder, document, config.paperSize, heightMm);
      const bytes = encoder.cut().encode();
      await this.writeBytes(config, transport, bytes);
      PrinterLogger.testPrintSucceeded({ printerId: config.id, protocol: config.protocol, durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.testPrintFailed({
        printerId: config.id,
        protocol: config.protocol,
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  /**
   * `printType === 'Label'` → khổ giấy tem vật lý thật (`config.labelHeightMm`
   * hoặc mặc định). Ngược lại (Receipt/không truyền) → `CONTINUOUS_HEIGHT_MM`
   * (giấy cuộn liên tục, không có khổ vật lý thật cần khớp) — xem
   * `TsplEncoder.initialize()`.
   */
  private resolveHeightMm(config: PrinterConfig, printType?: PrintType): number {
    return printType === 'Label' ? (config.labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM) : CONTINUOUS_HEIGHT_MM;
  }

  /**
   * Mã hoá từng `PrintElement` thành lệnh TSPL trên `encoder` đã có sẵn.
   * Ném `ENCODING_FAILED` cho loại phần tử không được hỗ trợ. Dùng chung cho
   * cả `print()` (đơn thật) và `testPrint()` (bill/tem mẫu) — cùng 1 cách
   * dịch layout để "In thử" phản ánh đúng nội dung sẽ in thật. Nhận
   * `paperSize` (không phải số đo sẵn) vì cần suy ra 2 đơn vị khác nhau:
   * `PAPER_WIDTH_CHARS` cho `line`/`row` (text), `PAPER_IMAGE_WIDTH_PX` cho
   * `image` (chuẩn hoá kích thước ảnh chụp — xem `decodePngBase64ToMonochrome`).
   * `heightMm` là ngưỡng chiều cao đã được `testPrint()`/`print()` chọn qua
   * `resolveHeightMm()` (khổ tem vật lý thật cho Label, hoặc ngưỡng an toàn
   * rộng cho Receipt) — dùng để chặn ảnh cao hơn ngưỡng đó.
   */
  private encodeElements(
    encoder: TsplEncoder,
    document: PrintDocument,
    paperSize: PrinterConfig['paperSize'],
    heightMm: number,
  ): void {
    const paperWidth = PAPER_WIDTH_CHARS[paperSize];
    for (const element of document.elements) {
      if (element.type === 'text') {
        encoder.text(element.x, element.y, element.content);
      } else if (element.type === 'line') {
        encoder.text(element.x, element.y, '-'.repeat(paperWidth));
      } else if (element.type === 'table') {
        element.rows.forEach((row, i) => encoder.text(element.x, element.y + i * 20, row.join('  ')));
      } else if (element.type === 'row') {
        encoder.text(element.x, element.y, formatRow(element.left, element.right, paperWidth));
      } else if (element.type === 'image') {
        // `element.data` là 1 ảnh PNG base64 (không tiền tố `data:...`) — vd
        // ảnh bill được `react-native-view-shot` chụp lại từ 1 View RN, dùng
        // để in đúng nội dung có dấu tiếng Việt bất kể font máy in TSPL có
        // hỗ trợ Unicode hay không (xem ghi chú ở `TsplEncoder.text()`).
        const bitmap = decodePngBase64ToMonochrome(element.data, PAPER_IMAGE_WIDTH_PX[paperSize]);
        // Với Tem (giấy rời có khe thật), `heightMm` phải khớp chiều dài tem
        // VẬT LÝ để cảm biến dò khe hoạt động đúng, không thể nới theo nội
        // dung — nội dung cao hơn sẽ tràn qua khe kế tiếp và in lệch/hỏng ở
        // phần dư (đã gặp thực tế). Với Hoá đơn, đây chỉ là ngưỡng an toàn
        // rộng (`CONTINUOUS_HEIGHT_MM`), không phải khổ giấy thật.
        const maxHeightPx = heightMm * DOTS_PER_MM;
        if (bitmap.heightPx > maxHeightPx) {
          throw new AppErrorException({
            code: 'ENCODING_FAILED',
            message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — dùng giấy dài hơn hoặc rút gọn nội dung.`,
          });
        }
        encoder.image(element.x, element.y, bitmap);
      } else if (element.type === 'barcode') {
        encoder.barcode(element.x, element.y, element.content);
      } else if (element.type === 'qrCode') {
        encoder.qrcode(element.x, element.y, element.content);
      } else {
        throw new AppErrorException({
          code: 'ENCODING_FAILED',
          message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}`,
        });
      }
    }
  }

  /** Gửi byte đã mã hoá qua transport đang kết nối, theo đúng API của từng `connectionType`. */
  private async writeBytes(config: PrinterConfig, transport: TsplTransport | undefined, bytes: Uint8Array): Promise<void> {
    if (config.connectionType === 'lan') {
      (transport as LanTransport).write(bytes);
    } else if (config.connectionType === 'bluetooth') {
      await (transport as BluetoothTransport).write(bytes);
    } else {
      await (transport as UsbTransport).write(bytes);
    }
  }

  /**
   * Mã hoá `PrintDocument` thành lệnh TSPL theo từng loại phần tử rồi gửi
   * qua transport đang kết nối. Ném `ENCODING_FAILED` cho loại phần tử không
   * được hỗ trợ, `CONNECTION_ERROR` nếu máy in chưa kết nối.
   */
  async print(printerId: string, document: PrintDocument, printType?: PrintType): Promise<void> {
    const config = this.configs.get(printerId);
    const transport = this.connections.get(printerId);
    if (!config || !transport) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
    }
    const heightMm = this.resolveHeightMm(config, printType);
    const encoder = new TsplEncoder().initialize(config.paperSize, printType, heightMm);
    this.encodeElements(encoder, document, config.paperSize, heightMm);
    const bytes = encoder.cut().encode();
    await this.writeBytes(config, transport, bytes);
  }

  /**
   * Gửi lệnh trạng thái TSPL ("~!T") và chờ phản hồi trong `IDENTIFY_TIMEOUT_MS`.
   * Nhiều máy in tem giá rẻ không phản hồi lệnh này — trả `null` là kết quả
   * hợp lệ, không phải lỗi (spec §4.1, §8).
   *
   * Dùng `'readOnce' in transport` để thu hẹp kiểu thay vì `instanceof`:
   * `identify()` chỉ nhận `printerId` (không có `config.connectionType` như
   * `connect()`/`testPrint()`), và `instanceof` không đáng tin cậy với các
   * lớp bị jest mock qua `mockImplementation(() => ({...}))` (object literal
   * trả về không có `LanTransport.prototype` trong chuỗi prototype). USB
   * không có `readOnce` (chỉ Lan/Bluetooth có, thêm ở Task 4–5) nên bị loại
   * ngay mà không cần gọi `write()` (vốn luôn throw trên USB).
   */
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
}
