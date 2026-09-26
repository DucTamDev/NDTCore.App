/** Nội dung QR code; firmware máy in tự tính ma trận module nên chỉ cần mang nội dung. */
export interface QrCodeModel {
  /** Dữ liệu mã hoá trong QR code. */
  content: string;
}
