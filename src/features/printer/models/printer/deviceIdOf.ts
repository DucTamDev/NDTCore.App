import { ConnectionType } from './ConnectionType';
import type { PrinterConnection } from './PrinterConnection';

/**
 * Định danh máy in vật lý, chỉ phụ thuộc cách kết nối. USB gắn thêm serial (có sau khi được cấp quyền) để rút ra
 * cắm lại vẫn nhận đúng máy; không có serial thì không phân biệt được hai máy cùng model.
 */
export const deviceIdOf = (connection: PrinterConnection): string => {
  if (connection.type === ConnectionType.Lan) {
    return `lan:${connection.host}:${connection.port}`;
  }

  if (connection.type === ConnectionType.Bluetooth) {
    return `bluetooth:mac:${connection.mac.toUpperCase()}`;
  }

  const usbId = `usb:${connection.vendorId}:${connection.productId}`;
  return connection.serialNumber ? `${usbId}:${connection.serialNumber}` : usbId;
};
