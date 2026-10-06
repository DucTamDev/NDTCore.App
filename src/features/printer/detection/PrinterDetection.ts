import type { PrinterCapabilities } from '../models/printer/PrinterCapabilities';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';

/** Định nghĩa model máy in được hệ thống hỗ trợ. */
export interface PrinterDetection {
  /** Hãng máy in. */
  vendor: string;

  /** Model máy in. */
  model: string;

  /** Thông tin dùng để nhận diện model máy in. */
  identifiers: PrinterIdentifiers;

  /** Ngôn ngữ lệnh của máy in. */
  language: PrinterLanguage;

  /** Các khả năng của máy in. */
  capabilities: PrinterCapabilities;
}

/** Thông tin dùng để nhận diện model máy in. */
export interface PrinterIdentifiers {
  /** USB Vendor ID. */
  vendorId?: number;

  /** USB Product ID. */
  productId?: number;

  /** Tên hãng do thiết bị cung cấp. */
  manufacturer?: string;

  /** Tên sản phẩm do thiết bị cung cấp. */
  product?: string;
}
