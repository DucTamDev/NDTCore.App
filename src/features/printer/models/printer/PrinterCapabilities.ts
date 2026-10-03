/** Khả năng phần cứng của máy in; hiện chỉ khai báo, chưa chặn hành vi in. */
export interface PrinterCapabilities {
  /** Có dao cắt giấy. */
  cutter: boolean;

  /** Có cổng mở ngăn kéo tiền. */
  cashDrawer: boolean;

  /** In được màu. */
  color: boolean;

  /** In được ảnh. */
  image: boolean;
}
