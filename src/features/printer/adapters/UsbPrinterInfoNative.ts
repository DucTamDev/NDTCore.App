import { NativeModules } from 'react-native';
import { LoggerService } from '../../../services/LoggerService';

/** 1:1 với `UsbDeviceInfoModule.describe()` (Kotlin) — toàn bộ USB descriptor. */
export interface UsbDeviceDescriptor {
  deviceName: string;
  deviceId: number;
  vendorId: number;
  productId: number;
  manufacturerName: string | null;
  productName: string | null;
  version: string | null;
  /** `null` khi app chưa được cấp quyền USB cho thiết bị (Android 10+) — có sau khi "Kết nối". */
  serialNumber: string | null;
  deviceClass: number;
  deviceSubclass: number;
  deviceProtocol: number;
  interfaceCount: number;
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  /** Có bulk-IN endpoint → về mặt vật lý đọc được phản hồi máy in (identify qua USB khả thi). */
  hasBulkInEndpoint: boolean;
  hasBulkOutEndpoint: boolean;
}

/**
 * Enumerate USB device kèm full descriptor. Trả `[]` nếu native module chưa
 * build vào (bundle JS mới chạy trên app cũ) hoặc không đọc được — caller phải
 * chịu được việc thiếu enrichment, không được vỡ. Đọc `NativeModules` mỗi lần
 * gọi (không cache) để không phụ thuộc thứ tự khởi tạo module.
 */
export const listUsbDevices = async (): Promise<UsbDeviceDescriptor[]> => {
  const mod = NativeModules.UsbDeviceInfo as { listDevices?: () => Promise<UsbDeviceDescriptor[]> } | undefined;
  if (!mod?.listDevices) {
    LoggerService.debug('UsbDeviceInfo.listDevices — native module CHƯA link (cần build lại)');
    return [];
  }
  try {
    const devices = await mod.listDevices();
    LoggerService.debug('UsbDeviceInfo.listDevices', { count: devices.length, devices });
    return devices;
  } catch (error) {
    LoggerService.warning('UsbDeviceInfo.listDevices thất bại', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
};

export const findUsbDescriptor = (
  devices: UsbDeviceDescriptor[],
  vendorId: number,
  productId: number,
): UsbDeviceDescriptor | undefined => devices.find((d) => d.vendorId === vendorId && d.productId === productId);
