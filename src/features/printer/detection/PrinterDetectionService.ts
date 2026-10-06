import { ConnectionType } from '../models/printer/ConnectionType';
import type { DeviceInfo } from '../models/device/DeviceInfo';
import { printerLogger } from '../logging/PrinterLogger';
import type { PrinterDetection, PrinterIdentifiers } from './PrinterDetection';
import { PRINTER_DETECTION_TABLE } from './PrinterDetectionTable';

/** Tên hãng/sản phẩm do thiết bị báo có thể khác hoa thường và thừa khoảng trắng giữa các lô máy. */
const sameText = (expected: string, actual?: string): boolean =>
  actual !== undefined && expected.trim().toLowerCase() === actual.trim().toLowerCase();

/**
 * Mọi trường định nghĩa có khai báo đều phải khớp, và phải khai báo ít nhất một trường. Thiết bị không có tên sản
 * phẩm riêng (Bluetooth) thì so bằng tên thiết bị.
 */
const matches = (identifiers: PrinterIdentifiers, device: DeviceInfo): boolean => {
  const usb = device.address.type === ConnectionType.Usb ? device.address : undefined;
  const checks = [
    identifiers.vendorId === undefined || identifiers.vendorId === usb?.vendorId,
    identifiers.productId === undefined || identifiers.productId === usb?.productId,
    identifiers.manufacturer === undefined || sameText(identifiers.manufacturer, device.manufacturer),
    identifiers.product === undefined || sameText(identifiers.product, device.model ?? device.name),
  ];
  const declared = Object.values(identifiers).some((value) => value !== undefined);

  return declared && checks.every(Boolean);
};

/**
 * Nhận thiết bị tìm thấy khi quét và tra `PRINTER_DETECTION_TABLE` để biết model, ngôn ngữ và khả năng của máy in.
 * Không kết nối, không gửi lệnh tới máy in.
 */
export class PrinterDetectionService {
  constructor(private readonly table: readonly PrinterDetection[] = PRINTER_DETECTION_TABLE) {}

  /** Định nghĩa đầu tiên khớp thiết bị; `undefined` khi thiết bị không có trong bảng. */
  detect(device: DeviceInfo): PrinterDetection | undefined {
    const detection = this.table.find((candidate) => matches(candidate.identifiers, device));
    const connectionType = device.address.type;

    if (detection) {
      printerLogger.printerDetected({ connectionType, language: detection.language.type });
    } else {
      printerLogger.printerNotDetected({ connectionType });
    }

    return detection;
  }
}

export const printerDetectionService = new PrinterDetectionService();
