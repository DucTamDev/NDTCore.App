/** Định nghĩa 1 cột bảng. */
export interface TableColumn {
  /** Chiều rộng cột, tính bằng dots. */
  width: number;

  /** Căn lề nội dung trong cột — mặc định 'left' khi bỏ trống. */
  align?: "left" | "center" | "right";
}
