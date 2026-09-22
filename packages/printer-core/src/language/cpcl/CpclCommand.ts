export const CPCL_COMMAND = {
  SESSION_START: '!',
  TONE: 'TONE',
  SPEED: 'SPEED',
  PAGE_WIDTH: 'PAGE-WIDTH',
  /**
   * CPCL biến thể động từ TEXT theo hậu tố xoay (TEXT90/TEXT180/TEXT270);
   * `CpclCompiler` tự ghép hậu tố này khi biên dịch.
   */
  TEXT: 'TEXT',
  IMAGE: 'EG',
  BOX: 'BOX',
  LINE: 'LINE',
  PRINT: 'PRINT',
  BARCODE: 'BARCODE',
  QRCODE_START: 'B QR',
  QRCODE_END: 'ENDQR',
} as const;

export type CpclCommandName = (typeof CPCL_COMMAND)[keyof typeof CPCL_COMMAND];
