// src/features/printer/drivers/TsplDriver.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import { TsplEncoder } from '../protocols/TsplEncoder';
import { LanTransport } from '../transports/LanTransport';
import { BluetoothTransport } from '../transports/BluetoothTransport';
import { UsbTransport } from '../transports/UsbTransport';
import { AppErrorException } from '../../../types/AppError';

type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;

const IDENTIFY_TIMEOUT_MS = 1000;

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
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chưa được hỗ trợ cho máy in tem' },
      });
      return () => undefined;
    }
    onEvent({ type: 'loading' });
    RNBluetoothClassic.startDiscovery()
      .then((devices) => {
        onEvent({
          type: devices.length > 0 ? 'found' : 'empty',
          devices: devices.map((d) => ({
            deviceId: d.address,
            displayName: d.name ?? d.address,
            rawDevice: d as unknown as Record<string, unknown>,
          })),
        });
      })
      .catch((error: unknown) => {
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      });
    return () => {
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      const transport = this.createTransport(config.connectionType);
      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(config.lan.ip, config.lan.port);
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        await (transport as BluetoothTransport).connect(config.device.deviceId);
      } else {
        await (transport as UsbTransport).connect();
      }
      this.connections.set(config.id, transport);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const transport = this.connections.get(printerId);
    await transport?.close();
    this.connections.delete(printerId);
    this.setStatus(printerId, 'disconnected');
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
    if (!this.connections.has(config.id)) {
      await this.connect(config);
    }
    const transport = this.connections.get(config.id);
    const bytes = new TsplEncoder()
      .initialize(config.paperSize)
      .text(10, 10, 'NDTCore POS - In thu')
      .cut()
      .encode();
    if (config.connectionType === 'lan') {
      (transport as LanTransport).write(bytes);
    } else if (config.connectionType === 'bluetooth') {
      await (transport as BluetoothTransport).write(bytes);
    }
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
