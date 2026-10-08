import type { Printer } from '../models/printer/Printer';
import type { PrintOptions } from '../models/printing/PrintOptions';

/** Một ngôn ngữ lệnh máy in: chỉ biến ảnh thành byte, không biết kết nối. */
export interface IPrintLanguage {
  /** `image` là PNG base64 không tiền tố `data:`; ảnh hỏng hay quá cao ném `PrinterErrorException`. */
  encode(printer: Printer, image: string, options?: PrintOptions): Uint8Array;
}
