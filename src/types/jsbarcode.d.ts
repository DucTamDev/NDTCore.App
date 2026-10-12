// `jsbarcode` chỉ khai báo kiểu cho hàm vẽ lên canvas/svg; app chỉ dùng bộ mã hoá CODE128 thuần JS bên trong.
declare module 'jsbarcode/bin/barcodes/CODE128' {
  /** CODE128 tự chọn bộ ký tự A/B/C theo dữ liệu. */
  export class CODE128 {
    constructor(data: string, options: object);

    /** `false` khi dữ liệu có ký tự ngoài ASCII (vd chữ có dấu). */
    valid(): boolean;

    /** `data` là chuỗi bit `1` (vạch) / `0` (khoảng trắng), đã gồm ký tự bắt đầu, checksum và kết thúc. */
    encode(): { text: string; data: string };
  }
}
