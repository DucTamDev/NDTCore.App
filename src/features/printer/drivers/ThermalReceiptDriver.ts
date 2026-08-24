// src/features/printer/drivers/ThermalReceiptDriver.ts
import { Platform } from 'react-native';
import { USBPrinter, BLEPrinter, NetPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import { AppErrorException, type AppErrorCode } from '../types/AppError';
import type { PrintDocument } from '../types/printDocument.types';
import { ensureBluetoothPermission } from '../services/PrinterPermissionService';
import { PrinterLogger } from '../services/PrinterLogger';
import { ensureUsbInitialized } from '../services/UsbPrinterNative';
import { PAPER_WIDTH_CHARS, formatRow } from '../utils/paperWidth';

const errorCodeOf = (error: unknown): AppErrorCode =>
  error instanceof AppErrorException ? error.code : 'UNKNOWN_ERROR';

interface UsbRawDevice {
  vendor_id: number;
  product_id: number;
}

const namespaceByConnectionType = {
  usb: USBPrinter,
  bluetooth: BLEPrinter,
  lan: NetPrinter,
} as const;

/**
 * Driver ESC/POS cho máy in hoá đơn, dùng `@poriyaalar/react-native-thermal-receipt-printer`.
 * Khác với Epson SDK (1 class `Printer` dùng chung mọi connectionType), thư
 * viện này export 3 namespace độc lập (USBPrinter/BLEPrinter/NetPrinter) mỗi
 * cái có API riêng — driver này chọn namespace theo `connectionType`, giống
 * cách `TsplDriver` chọn transport.
 *
 * Lưu ý khác biệt so với README của thư viện (đã kiểm tra `dist/index.d.ts`
 * thật sau khi cài đặt): `connectPrinter()` nhận tham số vị trí riêng cho
 * từng namespace (không phải object `{host, port}`/`{inner_mac_address}`/
 * `{vendorID, productId}`), và `printText()` là API kiểu callback
 * (`cbSuccess`/`cbErr`), không trả về `Promise` — driver bọc nó lại thành
 * `Promise` qua `printTextAsync()`.
 */
export class ThermalReceiptDriver implements IPrinterDriver {
  private connectedTypes = new Map<string, ConnectionType>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();
  private initialized = new Set<ConnectionType>();
  /** `PrinterDeviceInfo` thật lấy từ resolved value của `connectPrinter()` — dùng cho `identify()`. */
  private deviceInfos = new Map<string, PrinterDeviceInfo>();
  /** `PrinterConfig` lúc connect — dùng để đọc `paperSize` khi format layout 2 cột trong `print()`. */
  private configs = new Map<string, PrinterConfig>();
  /**
   * Thư viện giữ ĐÚNG 1 kết nối native / namespace (USBPrinter/BLEPrinter/
   * NetPrinter là singleton) — connect printer thứ 2 cùng `connectionType` sẽ
   * âm thầm ngắt printer đầu ở tầng native. Map này track printer nào đang
   * thật sự sở hữu kết nối native của từng `connectionType`, để `testPrint()`/
   * `disconnect()`/`print()` không thao tác nhầm lên 1 printer đã bị ngắt
   * ngầm — đây là giới hạn của thư viện, driver chỉ có thể làm cho
   * status/behaviour phản ánh đúng thực tế chứ không giải quyết được tận
   * gốc (không thể giữ 2 kết nối cùng namespace cùng lúc).
   */
  private activeByType = new Map<ConnectionType, string>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  /**
   * Nhánh `usb` uỷ quyền qua `ensureUsbInitialized()` thay vì gọi thẳng
   * `USBPrinter.init()` — native module `RNUSBPrinter` là singleton dùng
   * chung với `TsplDriver` (qua `UsbTransport`), gọi `init()` độc lập từ 2
   * driver sẽ đăng ký trùng `BroadcastReceiver` ở tầng native.
   */
  private async ensureInitialized(connectionType: ConnectionType): Promise<void> {
    if (this.initialized.has(connectionType)) return;
    if (connectionType === 'usb') {
      await ensureUsbInitialized();
    } else {
      await namespaceByConnectionType[connectionType].init();
    }
    this.initialized.add(connectionType);
  }

  /**
   * `printText()` của thư viện là API kiểu callback (`cbSuccess`/`cbErr`),
   * không trả `Promise` — bọc lại thành `Promise` để `testPrint()`/`print()`
   * có thể `await` như các driver khác.
   *
   * Bắt buộc phải truyền object `opts` thật (không phải `undefined`): JS
   * layer của thư viện default `opts` thành `{}` khi thiếu, khiến
   * `keepConnection` là `undefined` — giá trị này băng qua bridge thành
   * `Boolean keepConnection` null, và các adapter Android (LAN/BLE) unbox nó
   * mà không kiểm tra null (`Boolean.toString(keepConnection)` /
   * `if (!keepConnection)`), NPE ngay trên native print thread *sau khi* đã
   * flush byte in nhưng *trước khi* gọi success callback — Promise treo mãi
   * mãi, không `resolve`/`reject`. `cut`/`tailingLine: true` còn đảm bảo máy
   * in feed + cắt giấy sau khi in (mặc định của thư viện là `false`).
   *
   * `encoding: 'UTF8'` truyền tường minh (không dựa vào default ngầm của thư
   * viện) — đây là điều kiện bắt buộc để in đúng tiếng Việt có dấu: thư viện
   * mã hoá text bằng `iconv-lite` theo giá trị `encoding` này, đồng thời gửi
   * lệnh chuyển máy in ESC/POS sang chế độ nhận byte UTF-8 (`FS & FS C 0xFF`)
   * — chế độ mở rộng của nhà sản xuất, hầu hết máy in ESC/POS đời mới bán ở
   * thị trường Việt Nam (Xprinter, Gprinter...) hỗ trợ, nhưng không phải máy
   * ESC/POS gốc nào cũng có.
   */
  private printTextAsync(connectionType: ConnectionType, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      namespaceByConnectionType[connectionType].printText(
        text,
        { keepConnection: true, cut: true, tailingLine: true, encoding: 'UTF8' },
        () => resolve(),
        (error: Error) => reject(error),
      );
    });
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb' && Platform.OS !== 'android') {
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chỉ hỗ trợ trên Android' },
      });
      return () => undefined;
    }

    let cancelled = false;
    onEvent({ type: 'loading' });
    const startedAt = Date.now();

    const run = async (): Promise<void> => {
      try {
        if (connectionType === 'bluetooth') {
          const granted = await ensureBluetoothPermission();
          if (cancelled) return;
          if (!granted) {
            onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' } });
            return;
          }
        }
        await this.ensureInitialized(connectionType);
        if (cancelled) return;

        if (connectionType === 'bluetooth') {
          const devices = await BLEPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({
            type: devices.length > 0 ? 'found' : 'empty',
            devices: devices.map((device) => ({
              deviceId: device.inner_mac_address,
              displayName: device.device_name,
              rawDevice: device as unknown as Record<string, unknown>,
            })),
          });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
        } else {
          const devices = await USBPrinter.getDeviceList();
          if (cancelled) return;
          onEvent({
            type: devices.length > 0 ? 'found' : 'empty',
            devices: devices.map((device) => ({
              deviceId: `${device.vendor_id}:${device.product_id}`,
              displayName: device.device_name,
              rawDevice: device as unknown as Record<string, unknown>,
            })),
          });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: devices.length, durationMs: Date.now() - startedAt });
        }
      } catch (error) {
        if (cancelled) return;
        // Trên Android, khi không tìm thấy thiết bị nào, native module gọi
        // error callback với message "No Device Found" thay vì success
        // callback với mảng rỗng (RNBLEPrinterModule.java /
        // RNUSBPrinterModule.java) — Promise từ getDeviceList() reject, nên
        // phải phân biệt trường hợp này với lỗi kết nối thật để báo `empty`
        // thay vì `CONNECTION_ERROR`.
        const message = error instanceof Error ? error.message : String(error);
        if (/no device found/i.test(message)) {
          onEvent({ type: 'empty' });
          PrinterLogger.scanCompleted({ connectionType, deviceCount: 0, durationMs: Date.now() - startedAt });
          return;
        }
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message } });
        PrinterLogger.scanFailed({ connectionType, errorCode: 'CONNECTION_ERROR', durationMs: Date.now() - startedAt });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    const startedAt = Date.now();
    try {
      if (config.connectionType === 'bluetooth') {
        const granted = await ensureBluetoothPermission();
        if (!granted) {
          throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' });
        }
      }
      await this.ensureInitialized(config.connectionType);

      let deviceName: string | undefined;
      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        const result = await NetPrinter.connectPrinter(config.lan.ip, config.lan.port);
        deviceName = result?.device_name;
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        const result = await BLEPrinter.connectPrinter(config.device.deviceId);
        deviceName = result?.device_name;
      } else {
        const raw = config.device?.rawDevice as unknown as UsbRawDevice | undefined;
        if (!raw) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu thông tin thiết bị USB' });
        // `.d.ts` của thư viện khai `connectPrinter(vendorId: string, productId: string)`
        // nhưng native Android (`RNUSBPrinterModule.connectPrinter`) nhận
        // `Integer vendorId, Integer productId` — JS layer truyền thẳng
        // không convert. Dưới New Architecture bridge, truyền string vào
        // tham số native Integer throw `JavaTurboModuleArgumentConversionException`
        // ngay lập tức. Cast `as unknown as string` chỉ để thoả mãn type sai
        // của `.d.ts`; giá trị runtime thật sự đi qua bridge vẫn là number.
        const result = await USBPrinter.connectPrinter(
          Number(raw.vendor_id) as unknown as string,
          Number(raw.product_id) as unknown as string,
        );
        deviceName = result?.device_name;
      }

      if (deviceName) this.deviceInfos.set(config.id, { deviceName });
      this.connectedTypes.set(config.id, config.connectionType);
      this.configs.set(config.id, config);

      // Namespace này chỉ giữ được 1 kết nối native — printer đang connect vừa
      // thay thế printer cũ (nếu có) của cùng connectionType. Chỉ ngắt
      // JS-side status của printer cũ SAU KHI kết nối mới đã thật sự thành
      // công (validate + gọi native connectPrinter() xong ở trên) — nếu ngắt
      // sớm hơn và attempt này fail giữa chừng, printer cũ sẽ bị báo sai là
      // đã ngắt kết nối trong khi nó vẫn đang sống bình thường ở tầng native.
      const previousOwner = this.activeByType.get(config.connectionType);
      if (previousOwner && previousOwner !== config.id) {
        this.setStatus(previousOwner, 'disconnected');
      }
      this.activeByType.set(config.connectionType, config.id);
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
   * `closeConn()` native có thể reject (thiết bị đã rút/mất kết nối trước khi
   * kịp đóng chủ động) — bookkeeping nội bộ (`connectedTypes`/`activeByType`/
   * `deviceInfos`) vẫn PHẢI được dọn dù native close thất bại, nằm trong
   * `finally`, nếu không driver sẽ kẹt mãi ở status `disconnecting` và tiếp
   * tục tưởng mình đang sở hữu kết nối của `connectionType` đó — chặn luôn
   * printer khác kết nối cùng connectionType sau này (`activeByType` không
   * bao giờ được giải phóng).
   */
  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const connectionType = this.connectedTypes.get(printerId);
    try {
      if (connectionType) {
        // Chỉ gọi closeConn() native nếu printer này thật sự đang sở hữu kết
        // nối của connectionType đó — nếu không, kết nối native đã thuộc về 1
        // printer khác (bị "cướp" theo cách được mô tả ở `activeByType`), gọi
        // closeConn() lúc này sẽ ngắt nhầm printer đang sống, không phải
        // printer này.
        if (this.activeByType.get(connectionType) === printerId) {
          await namespaceByConnectionType[connectionType].closeConn();
        }
      }
    } catch (error) {
      this.setStatus(printerId, 'error');
      // Driver này chỉ bao giờ xử lý protocol 'escpos' (DriverRegistry map cố
      // định 'escpos' -> ThermalReceiptDriver) nên không cần lưu thêm map
      // printerId -> protocol.
      PrinterLogger.disconnectFailed({ printerId, protocol: 'escpos', errorCode: errorCodeOf(error) });
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: error instanceof Error ? error.message : String(error) });
    } finally {
      if (connectionType && this.activeByType.get(connectionType) === printerId) {
        this.activeByType.delete(connectionType);
      }
      this.connectedTypes.delete(printerId);
      this.deviceInfos.delete(printerId);
      this.configs.delete(printerId);
    }
    this.setStatus(printerId, 'disconnected');
    PrinterLogger.disconnectSucceeded({ printerId, protocol: 'escpos' });
  }

  /**
   * Dịch `PrintDocument` sang chuỗi cho `printText()` — thư viện không có
   * API mã vạch/QR/ảnh dùng được (chỉ `printImageBase64` cần base64 thật,
   * trong khi `PrintImageElement.data` hiện là URI) nên `image`/`barcode`/
   * `qrCode` ném `ENCODING_FAILED` cho loại phần tử không hỗ trợ. Validate
   * toàn bộ elements TRƯỚC khi gọi
   * `printTextAsync` — không có buffer nội bộ như SDK Epson (chỉ flush 1 lần
   * lúc `sendData()`), nên phải tự đảm bảo không gửi in dở dang. Dùng chung
   * cho cả `print()` (đơn thật) và `testPrint()` (bill/tem mẫu) — cùng 1 cách
   * dịch layout để "In thử" phản ánh đúng nội dung sẽ in thật.
   */
  private encodeDocument(document: PrintDocument, paperWidth: number): string {
    const lines: string[] = [];
    for (const element of document.elements) {
      if (element.type === 'text') {
        lines.push(element.content);
      } else if (element.type === 'line') {
        lines.push('-'.repeat(paperWidth));
      } else if (element.type === 'table') {
        for (const row of element.rows) lines.push(row.join('  '));
      } else if (element.type === 'row') {
        lines.push(formatRow(element.left, element.right, paperWidth));
      } else {
        throw new AppErrorException({
          code: 'ENCODING_FAILED',
          message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}`,
        });
      }
    }
    return `${lines.join('\n')}\n`;
  }

  /**
   * `line`/`row` được canh theo `PAPER_WIDTH_CHARS[paperSize]` (đọc từ
   * `configs` lưu lúc `connect()`) — mặc định `80mm` nếu vì lý do gì đó chưa
   * có config (không nên xảy ra vì `print()` đã throw sớm nếu chưa connect).
   */
  async print(printerId: string, document: PrintDocument): Promise<void> {
    const connectionType = this.connectedTypes.get(printerId);
    if (!connectionType || this.activeByType.get(connectionType) !== printerId) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
    }

    const paperWidth = PAPER_WIDTH_CHARS[this.configs.get(printerId)?.paperSize ?? '80mm'];
    const text = this.encodeDocument(document, paperWidth);

    const startedAt = Date.now();
    try {
      await this.printTextAsync(connectionType, text);
      PrinterLogger.printSucceeded({ printerId, protocol: 'escpos', durationMs: Date.now() - startedAt });
    } catch (error) {
      PrinterLogger.printFailed({
        printerId,
        protocol: 'escpos',
        errorCode: errorCodeOf(error),
        durationMs: Date.now() - startedAt,
      });
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

  async testPrint(config: PrinterConfig, document: PrintDocument): Promise<void> {
    const startedAt = Date.now();
    try {
      // Reconnect không chỉ khi chưa từng connect, mà cả khi printer này đã
      // từng connect nhưng không còn là chủ sở hữu hiện tại của kết nối native
      // cùng connectionType (đã bị 1 printer khác "cướp" kết nối ngầm) — nếu
      // không, sẽ in nhầm lên printer đang thực sự chiếm kết nối. Nằm trong
      // try/catch để lỗi reconnect cũng được ghi testPrintFailed, không phải
      // chỉ mỗi connectFailed nội bộ của connect().
      const isStaleOwner = this.activeByType.get(config.connectionType) !== config.id;
      if (!this.connectedTypes.has(config.id) || isStaleOwner) {
        await this.connect(config);
      }
      const connectionType = this.connectedTypes.get(config.id);
      if (!connectionType) return;
      await this.printTextAsync(connectionType, this.encodeDocument(document, PAPER_WIDTH_CHARS[config.paperSize]));
      PrinterLogger.testPrintSucceeded({
        printerId: config.id,
        protocol: config.protocol,
        durationMs: Date.now() - startedAt,
      });
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
   * Qua USB, native module (`USBPrinterAdapter`) chỉ tìm bulk-OUT endpoint —
   * KHÔNG có khả năng đọc phản hồi. `device_name` mà `connectPrinter()` trả về
   * chỉ là chuỗi mô tả từ USB descriptor (mọi thiết bị USB đều có), không
   * phải bằng chứng thiết bị nói được ESC/POS — 1 máy in tem TSPL cắm USB
   * cũng có `device_name` y hệt. Vì vậy qua USB luôn trả `null`, đối xứng với
   * `TsplDriver.identify()` (cũng luôn `null` qua USB, cùng lý do) — không
   * driver nào được phép tự xác nhận qua USB bằng thư viện này, để
   * `discoverProtocol()` trung thực rơi vào `unknown_protocol` thay vì đoán
   * theo thứ tự candidate. Qua LAN/Bluetooth, `device_name` vẫn được coi là
   * xác nhận hợp lệ (yếu hơn nhưng là tín hiệu tốt nhất có được).
   *
   * Trả `null` (không phải `{}`) khi không có `device_name` thật — `{}` là
   * object TRUTHY trong JS, nếu trả về đây `discoverProtocol()` sẽ coi "đã
   * connect được" là "đã xác nhận protocol" dù không có bằng chứng gì.
   */
  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const connectionType = this.connectedTypes.get(printerId);
    if (!connectionType) return null;
    if (connectionType === 'usb') return null;
    return this.deviceInfos.get(printerId) ?? null;
  }
}
