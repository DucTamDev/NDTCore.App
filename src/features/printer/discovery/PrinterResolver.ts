import { ConnectionType } from '../types/printer.types';
import type { PrinterDevice, PrinterLanConfig } from '../types/printer.types';

export interface ResolveIdentityKeyInput {
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

/**
 * Tính identityKey của 1 physical printer — CHỈ phụ thuộc connectionType +
 * device/lan, không phụ thuộc driver/protocol nào được gán (spec §6.1).
 * KHÔNG tự quyết định "có phải trùng lặp không" — so khớp với printer đã lưu
 * là việc của `printing/PrinterService.ts` (spec §6.2).
 *
 * USB không có cách đọc serial number đáng tin qua thư viện hiện tại — fallback
 * duy nhất là vendorId:productId, đã có sẵn trong `PrinterDevice.deviceId`
 * dạng "vendor_id:product_id", KHÔNG đảm bảo phân biệt được 2 máy cùng model
 * cắm cùng lúc — giới hạn đã biết, không cố tạo giải pháp giả.
 */
export const resolveIdentityKey = (input: ResolveIdentityKeyInput): string => {
  if (input.connectionType === ConnectionType.lan) {
    if (!input.lan) throw new Error('Thiếu cấu hình IP/Port để tính identityKey cho kết nối LAN');
    return `lan:${input.lan.ip}:${input.lan.port}`;
  }
  if (!input.device) {
    throw new Error(`Thiếu thiết bị để tính identityKey cho kết nối ${input.connectionType}`);
  }
  if (input.connectionType === ConnectionType.bluetooth) {
    return `bluetooth:mac:${input.device.deviceId}`;
  }
  return `usb:device:${input.device.deviceId}`;
};
