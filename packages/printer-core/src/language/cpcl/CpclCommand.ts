/**
 * Bảng hằng số các động từ lệnh CPCL mà `CpclCompiler` dùng khi biên dịch
 * (cùng cách tổ chức với `ZPL_COMMAND`/`EPL_COMMAND`) — mỗi động từ lệnh chỉ
 * viết một lần ở đây, thay vì rải chuỗi literal khắp `CpclCompiler.ts`.
 *
 * `TEXT` chỉ liệt kê động từ gốc — CPCL biến thể nó theo hậu tố xoay
 * (`TEXT`/`TEXT90`/`TEXT180`/`TEXT270`), nên `CpclCompiler` tự ghép động từ
 * đầy đủ tại nơi gọi, giống cách `ZplCompiler` xử lý `^A<letter>`.
 */
export const CPCL_COMMAND = {
  SESSION_START: '!',
  TONE: 'TONE',
  SPEED: 'SPEED',
  PAGE_WIDTH: 'PAGE-WIDTH',
  TEXT: 'TEXT',
  IMAGE: 'EG',
  BOX: 'BOX',
  LINE: 'LINE',
  PRINT: 'PRINT',
  /**
   * `BARCODE` — lệnh Bar Code 1D, theo CPCL Programmer's Manual. Đây là phần
   * mới hoàn toàn: portakal chưa từng biên dịch element barcode cho CPCL.
   */
  BARCODE: 'BARCODE',
  /**
   * `B QR` — mở khối QR Code 2D, theo CPCL Programmer's Manual. Cũng là phần
   * mới, cùng lý do như `BARCODE`.
   */
  QRCODE_START: 'B QR',
  /** `ENDQR` — kết thúc khối `B QR`. */
  QRCODE_END: 'ENDQR',
} as const;

export type CpclCommandName = (typeof CPCL_COMMAND)[keyof typeof CPCL_COMMAND];
