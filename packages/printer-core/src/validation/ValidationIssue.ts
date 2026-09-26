/** 1 vấn đề tìm thấy khi kiểm tra lệnh máy in (byte hoặc chuỗi lệnh). */
export interface ValidationIssue {
  /** Mức độ: lỗi, cảnh báo, thông tin. */
  level: 'error' | 'warning' | 'info';

  /** Dòng lệnh chứa vấn đề, tính từ 1. Hiện chưa validator nào gán field này. */
  line?: number;

  /** Tên lệnh liên quan. */
  command?: string;

  /** Mô tả vấn đề. */
  message: string;
}
