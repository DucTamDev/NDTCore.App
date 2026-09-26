/** Ảnh RGBA gói trong 1 object (dữ liệu + kích thước). */
export interface ImageSource {
  /** Dữ liệu RGBA, 4 byte mỗi điểm, theo hàng. */
  data: Uint8Array | Uint8ClampedArray;

  /** Chiều rộng, tính bằng điểm ảnh. */
  width: number;

  /** Chiều cao, tính bằng điểm ảnh. */
  height: number;
}
