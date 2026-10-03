import type { Printer } from '../models/printer/Printer';
import type { PrintDocuments } from '../models/printing/PrintDocuments';
import type { PrintOptions } from '../models/printing/PrintOptions';

/** Lệnh dò để nhận ra máy in dùng một ngôn ngữ, và cách đọc phản hồi. */
export interface IdentifyProbe {
  /** Byte gửi tới máy in. */
  command: Uint8Array;

  /** Phản hồi đọc được có xác nhận ngôn ngữ này không. */
  matches(response: Uint8Array): boolean;
}

/** Một ngôn ngữ lệnh máy in: chỉ biến nội dung thành byte, không biết kết nối. */
export interface IPrintLanguage {
  /** Kiểm tra rồi encode; nội dung không in được (thiếu ảnh, ảnh quá cao…) ném `PrinterErrorException`. */
  encode(printer: Printer, documents: PrintDocuments, options?: PrintOptions): Uint8Array;

  /** Không có thì ngôn ngữ này không có lệnh dò. */
  identifyProbe?: IdentifyProbe;
}
