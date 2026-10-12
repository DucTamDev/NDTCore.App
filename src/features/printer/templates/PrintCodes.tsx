import React from 'react';
import { View, StyleSheet } from 'react-native';
import qrcode from 'qrcode-generator';
import { CODE128 } from 'jsbarcode/bin/barcodes/CODE128';

/** Cạnh QR khoảng 22mm, đủ để camera điện thoại quét từ giấy nhiệt. */
const QR_TARGET_SIZE_DOTS = 176;

/** Ô QR nhỏ hơn 3 dot thì đầu in nhiệt làm nhoè, máy quét đọc sai. */
const QR_MIN_MODULE_DOTS = 3;

/** Vùng trắng quanh QR theo chuẩn: 4 ô. */
const QR_QUIET_ZONE_MODULES = 4;

/** Vạch 1 dot quá mảnh với đầu in nhiệt; 2 dot vẫn vừa khổ 58mm với mã đơn khoảng 10 ký tự. */
const BARCODE_MODULE_DOTS = 2;

const BARCODE_HEIGHT_DOTS = 64;

const INK = '#000000';

/** Một đoạn liên tiếp cùng màu trên một hàng. */
interface Run {
  dark: boolean;

  length: number;
}

/** Gộp các ô liền nhau cùng màu thành một đoạn, để mỗi hàng chỉ cần vài View thay vì một View mỗi ô. */
const runsOf = (cells: boolean[]): Run[] => {
  const runs: Run[] = [];

  for (const dark of cells) {
    const last = runs[runs.length - 1];

    if (last && last.dark === dark) {
      last.length += 1;
      continue;
    }

    runs.push({ dark, length: 1 });
  }

  return runs;
};

/** Một hàng ô đen/trắng, mỗi ô rộng `moduleDots`. */
const ModuleRow: React.FC<{ cells: boolean[]; moduleDots: number; heightDots: number }> = (props) => {
  const { cells, moduleDots, heightDots } = props;

  return (
    <View style={styles.row}>
      {runsOf(cells).map((run, index) => (
        <View
          key={index}
          style={{ width: run.length * moduleDots, height: heightDots, backgroundColor: run.dark ? INK : undefined }}
        />
      ))}
    </View>
  );
};

/** Ma trận QR, mức sửa lỗi M; dữ liệu quá dài so với QR lớn nhất thì `null`. */
const qrMatrixOf = (value: string): boolean[][] | null => {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (__, col) => qr.isDark(row, col)));
  } catch {
    return null;
  }
};

/** Mã QR căn giữa, kèm vùng trắng chuẩn; không mã hoá được thì không vẽ gì. */
export const PrintQrCode: React.FC<{ value: string }> = ({ value }) => {
  const matrix = qrMatrixOf(value);

  if (!matrix) {
    return null;
  }

  const moduleDots = Math.max(QR_MIN_MODULE_DOTS, Math.floor(QR_TARGET_SIZE_DOTS / matrix.length));

  return (
    <View style={[styles.centered, { padding: QR_QUIET_ZONE_MODULES * moduleDots }]}>
      {matrix.map((cells, row) => (
        <ModuleRow key={row} cells={cells} moduleDots={moduleDots} heightDots={moduleDots} />
      ))}
    </View>
  );
};

/** Chuỗi bit CODE128 → ô vạch; dữ liệu có ký tự ngoài ASCII thì `null`. */
const barcodeCellsOf = (value: string): boolean[] | null => {
  const barcode = new CODE128(value, {});

  if (!barcode.valid()) {
    return null;
  }

  return Array.from(barcode.encode().data, (bit) => bit === '1');
};

/** Mã vạch CODE128 căn giữa; giá trị không mã hoá được thì không vẽ gì. */
export const PrintBarcode: React.FC<{ value: string }> = ({ value }) => {
  const cells = barcodeCellsOf(value);

  if (!cells) {
    return null;
  }

  return (
    <View style={styles.centered}>
      <ModuleRow cells={cells} moduleDots={BARCODE_MODULE_DOTS} heightDots={BARCODE_HEIGHT_DOTS} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  centered: { alignSelf: 'center' },
});
