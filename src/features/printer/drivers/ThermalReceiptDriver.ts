// src/features/printer/drivers/ThermalReceiptDriver.ts
import { Platform } from 'react-native';
import { USBPrinter, BLEPrinter, NetPrinter } from '@poriyaalar/react-native-thermal-receipt-printer';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import { AppErrorException, type AppErrorCode } from '../../../types/AppError';
import { ensureBluetoothPermission } from '../services/PrinterPermissionService';
import { PrinterLogger } from '../services/PrinterLogger';

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

  private async ensureInitialized(connectionType: ConnectionType): Promise<void> {
    if (this.initialized.has(connectionType)) return;
    await namespaceByConnectionType[connectionType].init();
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
   */
  private printTextAsync(connectionType: ConnectionType, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      namespaceByConnectionType[connectionType].printText(
        text,
        { keepConnection: true, cut: true, tailingLine: true },
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
      if (connectionType === 'bluetooth') {
        const granted = await ensureBluetoothPermission();
        if (cancelled) return;
        if (!granted) {
          onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: 'Chưa được cấp quyền Bluetooth' } });
          return;
        }
      }
      try {
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

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const connectionType = this.connectedTypes.get(printerId);
    if (connectionType) {
      // Chỉ gọi closeConn() native nếu printer này thật sự đang sở hữu kết nối
      // của connectionType đó — nếu không, kết nối native đã thuộc về 1
      // printer khác (bị "cướp" theo cách được mô tả ở `activeByType`), gọi
      // closeConn() lúc này sẽ ngắt nhầm printer đang sống, không phải printer
      // này.
      if (this.activeByType.get(connectionType) === printerId) {
        await namespaceByConnectionType[connectionType].closeConn();
        this.activeByType.delete(connectionType);
      }
    }
    this.connectedTypes.delete(printerId);
    this.deviceInfos.delete(printerId);
    this.setStatus(printerId, 'disconnected');
    // Driver này chỉ bao giờ xử lý protocol 'escpos' (DriverRegistry map cố
    // định 'escpos' -> ThermalReceiptDriver) nên không cần lưu thêm map
    // printerId -> protocol.
    PrinterLogger.disconnectSucceeded({ printerId, protocol: 'escpos' });
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig): Promise<void> {
    // Reconnect không chỉ khi chưa từng connect, mà cả khi printer này đã
    // từng connect nhưng không còn là chủ sở hữu hiện tại của kết nối native
    // cùng connectionType (đã bị 1 printer khác "cướp" kết nối ngầm) — nếu
    // không, sẽ in nhầm lên printer đang thực sự chiếm kết nối.
    const isStaleOwner = this.activeByType.get(config.connectionType) !== config.id;
    if (!this.connectedTypes.has(config.id) || isStaleOwner) {
      await this.connect(config);
    }
    const startedAt = Date.now();
    try {
      const connectionType = this.connectedTypes.get(config.id);
      if (!connectionType) return;
      await this.printTextAsync(connectionType, '<C>NDTCore POS - In thu\n</C>');
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

  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    if (!this.connectedTypes.has(printerId)) return null;
    return this.deviceInfos.get(printerId) ?? {};
  }
}
