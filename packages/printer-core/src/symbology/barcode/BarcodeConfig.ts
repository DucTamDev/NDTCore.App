import type { Rotation } from '../../types/Rotation';
import type { BarcodeSymbology } from './BarcodeType';

/**
 * Cấu hình mô tả cho 1 element mã vạch 1D.
 *
 * Theo đúng mô hình pass-through của lệnh barcode gốc máy in (TSPL `BARCODE`,
 * ESC/POS `GS k`): chỉ mô tả nội dung và tham số layout — firmware máy in tự
 * render các vạch. Vị trí chỉ có x/y (không có width/height) vì mọi lệnh
 * barcode gốc máy in đều tự tính khung render từ `height`/độ rộng vạch, không
 * nhận khung box do caller truyền vào.
 */
export interface BarcodeConfig {
  /** Toạ độ X, tính bằng dots. */
  x?: number;
  /** Toạ độ Y, tính bằng dots. */
  y?: number;
  /** Symbology (loại mã vạch) cần render. */
  symbology: BarcodeSymbology;
  /** Dữ liệu mã hoá trong mã vạch. */
  content: string;
  /** Chiều cao vạch, tính bằng dots. */
  height?: number;
  /** In kèm chữ số/ký tự đọc được bên dưới vạch hay không. */
  readable?: boolean;
  /** Góc xoay của mã vạch. */
  rotation?: Rotation;
  /** Độ rộng module vạch hẹp, tính bằng dots. */
  narrowBarWidth?: number;
  /** Độ rộng module vạch rộng, tính bằng dots. */
  wideBarWidth?: number;
}
