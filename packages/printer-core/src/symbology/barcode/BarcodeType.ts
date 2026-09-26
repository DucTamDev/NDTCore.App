/**
 * Loại mã vạch 1D mà cả lệnh `BARCODE` của TSPL lẫn `GS k` của ESC/POS đều in được, để không phải tự vẽ vạch.
 */
export type BarcodeSymbology =
  | 'code39'
  | 'code93'
  | 'code128'
  | 'ean8'
  | 'ean13'
  | 'upca'
  | 'upce'
  | 'itf'
  | 'codabar';
