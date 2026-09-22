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
   * `SET CUTTER OFF` hoặc `SET CUTTER <n>` (không có từ khoá `BATCH`). Máy in
   * giữ giá trị này qua các job in sau cho tới khi nhận `OFF` tường minh.
   */
  SET_CUTTER: 'SET CUTTER',
} as const;

export type TscCommandName = (typeof TSC_COMMAND)[keyof typeof TSC_COMMAND];
