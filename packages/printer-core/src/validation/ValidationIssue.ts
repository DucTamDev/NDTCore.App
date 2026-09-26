/** 1 vấn đề tìm thấy khi kiểm tra lệnh máy in (byte hoặc chuỗi lệnh). */
export interface ValidationIssue {
  /** Mức độ: lỗi, cảnh báo, thông tin. */
  level: 'error' | 'warning' | 'info';

  /** Dòng lệnh chứa vấn đề (từ 1); bỏ trống với nguồn dạng byte. */
  line?: number;

  /** Tên lệnh liên quan. */
  command?: string;

  /** Mô tả vấn đề. */
  message: string;
}
