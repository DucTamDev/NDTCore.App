/**
 * Các literal tên lệnh TSPL2 mà switch `compileElement()` của `TscCompiler`
 * phát ra, cộng với các lệnh thiết lập nhãn mà `compileToTSC()` ghi trước
 * mọi element. Gom thành một named-constant map duy nhất (theo cùng cách
 * object `ESC_POS` của `EscPosCommand`) để mỗi tên lệnh chỉ được viết ra một
 * nơi — port lại từ các chuỗi literal mà `languages/tsc.ts` của portakal
 * viết trực tiếp trong code.
 */
export const TSC_COMMAND = {
  SIZE: 'SIZE',
  GAP: 'GAP',
  SPEED: 'SPEED',
  DENSITY: 'DENSITY',
  DIRECTION: 'DIRECTION',
  CLS: 'CLS',
  PRINT: 'PRINT',
  TEXT: 'TEXT',
  BLOCK: 'BLOCK',
  BITMAP: 'BITMAP',
  BOX: 'BOX',
  BAR: 'BAR',
  DIAGONAL: 'DIAGONAL',
  CIRCLE: 'CIRCLE',
  ELLIPSE: 'ELLIPSE',
  REVERSE: 'REVERSE',
  ERASE: 'ERASE',
  BARCODE: 'BARCODE',
  QRCODE: 'QRCODE',
  /**
   * `SET CUTTER` — dạng tham số là `SET CUTTER OFF` hoặc `SET CUTTER <n>`
   * (không có từ khoá `BATCH`, đã kiểm chứng trên máy in TSPL thật) và giá
   * trị này được máy in giữ lại lâu dài — một khi job gửi `SET CUTTER n`,
   * máy in vẫn tiếp tục cắt ở các job in sau cho tới khi nhận `SET CUTTER OFF`
   * tường minh.
   */
  SET_CUTTER: 'SET CUTTER',
} as const;

export type TscCommandName = (typeof TSC_COMMAND)[keyof typeof TSC_COMMAND];
