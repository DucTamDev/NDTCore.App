/** Code page 1 byte của máy in: ánh xạ byte cao (0x80-0xFF) sang ký tự Unicode. */
export interface CodePage {
  /** Số hiệu code page (VD 437 cho CP437, 1252 cho Windows-1252). */
  id: number;

  /** Tên hiển thị. */
  name: string;

  /** Byte (0x80-0xFF) → ký tự Unicode; 0x00-0x7F luôn là ASCII nên không liệt kê. */
  chars: Record<number, string>;
}
