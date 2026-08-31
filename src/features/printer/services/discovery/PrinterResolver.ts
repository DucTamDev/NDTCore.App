import { ConnectionType } from '../../models/printer/PrinterDevice';
import type { PrinterDevice, PrinterLanConfig, UsbRawDevice } from '../../models/printer/PrinterDevice';

export interface ResolveIdentityKeyInput {
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

/**
 * Tính identityKey của 1 physical printer — CHỈ phụ thuộc connectionType +
 * device/lan, không phụ thuộc driver/protocol nào được gán (spec §6.1).
 * KHÔNG tự quyết định "có phải trùng lặp không" — so khớp với printer đã lưu
 * là việc của `storage/PrinterRepository.ts` (spec §6.2).
 *
 * USB: `usb:<vid>:<pid>[:<serial>]`. `deviceId` của `PrinterDevice` USB đã là
 * `"<vendor_id>:<product_id>"`. Serial (từ `USBPrinter.getDeviceList()`, cần quyền
 * USB — có sau khi user "Kết nối") pin thêm vào để rút/cắm lại đổi bus path
 * (`/dev/bus/usb/001/010` → `.../011`) vẫn nhận ra cùng máy. Không có serial thì
 * chỉ `vid:pid` — KHÔNG phân biệt được 2 máy cùng model cắm cùng lúc.
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
  const serial = (input.device.rawDevice as unknown as UsbRawDevice | undefined)?.serialNumber;
  return serial ? `usb:${input.device.deviceId}:${serial}` : `usb:${input.device.deviceId}`;
};
