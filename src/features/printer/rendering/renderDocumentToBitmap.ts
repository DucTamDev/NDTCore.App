import { Buffer } from 'buffer';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import type { PrintDocument } from '../models/printing/PrintDocument';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PrintPaperType } from '../models/paper/PrintPaperConfig';
import { PAPER_SIZE_SPECS, DOTS_PER_MM } from '../paper/paperSpec';
import { create as createQrCode } from 'qrcode';
import {
  LINE_HEIGHT_DOTS as LINE_HEIGHT_PX,
  BARCODE_HEIGHT_DOTS as BARCODE_HEIGHT_PX,
  QRCODE_HEIGHT_DOTS as QRCODE_HEIGHT_PX,
} from './printLayoutConstants';
import { encodeCode128 } from './code128';
import { LoggerService } from '../../../services/LoggerService';

/** Kiểu canvas Skia thật, suy ra từ chính API đang dùng — Task 7/8 tái dùng type này cho các hàm vẽ phụ trợ (drawBarcode/drawQrCode), không định nghĩa lại. */
type SkiaSurface = ReturnType<typeof Skia.Surface.MakeOffscreen>;
export type SkiaCanvas = ReturnType<NonNullable<SkiaSurface>['getCanvas']>;

/** Cùng logic đo bề rộng với `useBillImageCapture.tsx` — die-cut theo itemWidthMm, còn lại theo khổ giấy. */
const resolveWidthPx = (media: PrintPaperConfig): number =>
  media.type === PrintPaperType.DieCut ? (media.itemWidthMm ?? 0) * DOTS_PER_MM : PAPER_SIZE_SPECS[media.paperSize].imageWidthPx;

/**
 * Đếm số dòng sẽ vẽ (không wrap — spec §6, mỗi phần tử/mỗi row trong table là
 * đúng 1 dòng) để tính chiều cao surface TRƯỚC khi tạo — Skia cần size cố
 * định ngay lúc tạo, khác `View` tự cao theo nội dung.
 *
 * Cộng thêm đúng 1 `LINE_HEIGHT_PX` vào tổng: vòng lặp vẽ bên dưới bắt đầu ở
 * `y = LINE_HEIGHT_PX` (baseline dòng đầu), không phải `0`, nên nếu không bù
 * lại ở đây, surface sẽ bị tạo thấp hơn thực tế đúng 1 dòng và cắt mất phần
 * dưới baseline của phần tử CUỐI — với tiếng Việt là cắt dấu (dấu nặng...) và
 * đuôi chữ, với barcode/QR là cắt sát mép.
 *
 * `image` KHÔNG cộng chiều cao — phải khớp với `case 'image': break;` trong
 * vòng lặp vẽ (chưa xử lý, không tự vẽ gì, xem spec §5), nếu không 2 hàm này
 * sẽ tính lệch nhau.
 */
const estimateHeightPx = (document: PrintDocument): number => {
  let height = 0;
  for (const element of document.elements) {
    if (element.type === 'table') {
      height += element.rows.length * LINE_HEIGHT_PX;
    } else if (element.type === 'barcode') {
      height += BARCODE_HEIGHT_PX;
    } else if (element.type === 'qrCode') {
      height += QRCODE_HEIGHT_PX;
    } else if (element.type === 'image') {
      // Không vẽ, không cộng chiều cao — xem doc comment ở trên.
    } else {
      height += LINE_HEIGHT_PX;
    }
  }
  return Math.max(LINE_HEIGHT_PX, height) + LINE_HEIGHT_PX;
};

/**
 * Vẽ barcode bằng cách đi qua từng độ rộng module trong `widths` (bar, space,
 * bar, space, ...) — chỉ index CHẴN (0, 2, 4, ...) là bar (đen), index lẻ là
 * space (bỏ qua, không vẽ). `moduleWidthPx = 2` — độ rộng 1 module tối thiểu,
 * đủ để barcode fit trong khổ giấy phổ biến (chưa wrap — spec §6, tràn thì
 * chấp nhận).
 */
const MODULE_WIDTH_PX = 2;

const drawBarcode = (canvas: SkiaCanvas, content: string, x: number, y: number, paint: ReturnType<typeof Skia.Paint>): void => {
  const { widths } = encodeCode128(content);
  let cursor = x;

  widths.forEach((width, index) => {
    const barWidthPx = width * MODULE_WIDTH_PX;
    if (index % 2 === 0) {
      canvas.drawRect({ x: cursor, y, width: barWidthPx, height: BARCODE_HEIGHT_PX - 10 }, paint);
    }
    cursor += barWidthPx;
  });
};

/** Mỗi module QR vẽ thành 1 ô vuông `QR_MODULE_PX` cạnh — cell size cố định, không co giãn theo version QR (v1, chấp nhận tràn nếu QR lớn — spec §6/§9). */
const QR_MODULE_PX = 4;

const drawQrCode = (canvas: SkiaCanvas, content: string, x: number, y: number, paint: ReturnType<typeof Skia.Paint>): void => {
  const { modules } = createQrCode(content);
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.data[row * modules.size + col] === 0) {
        continue;
      }
      canvas.drawRect({ x: x + col * QR_MODULE_PX, y: y + row * QR_MODULE_PX, width: QR_MODULE_PX, height: QR_MODULE_PX }, paint);
    }
  }
};

/**
 * Font monospace hệ thống, cỡ `LINE_HEIGHT_PX` — bắt buộc monospace vì
 * `table`/`row` dựa vào `formatRow`/`row.join('  ')` tạo lưới ký tự CỐ ĐỊNH
 * bề rộng (cùng giả định với path `Image`, nơi `BillImagePreview.tsx` dùng
 * `fontFamily: 'monospace'`); dùng font tỉ lệ (proportional) sẽ làm lệch cột.
 * Cỡ chữ phải khớp `LINE_HEIGHT_PX` (= `LINE_HEIGHT_DOTS` = 24) — mọi hằng số
 * layout khác trong module này (kể cả `BillImagePreview.tsx`'s `fontSize: 24`)
 * đều giả định chữ cao 24px, để `y += LINE_HEIGHT_PX` mỗi dòng không đè lên
 * dòng trước hay để hở khoảng trắng lớn.
 *
 * Không phải nền tảng/mock nào cũng có family "monospace" qua
 * `FontMgr.System()` (vd `jest.setup.js` mock trả `null`) — fallback về
 * typeface mặc định của Skia nếu match thất bại: mất căn lưới ký tự cho
 * `table`/`row`, nhưng vẫn đúng CỠ chữ, không crash.
 */
const resolveFont = (): ReturnType<typeof Skia.Font> => {
  const typeface = Skia.FontMgr.System().matchFamilyStyle('monospace', { weight: 400, width: 5, slant: 0 });
  return typeface ? Skia.Font(typeface, LINE_HEIGHT_PX) : Skia.Font(undefined, LINE_HEIGHT_PX);
};

/**
 * Vẽ trực tiếp `PrintDocument.elements[]` lên canvas Skia off-screen — không
 * mount `View`, không phụ thuộc `onLayout`/`devicePixelRatio` như
 * `useBillImageCapture`. Cùng contract `(document, media) => base64 PNG |
 * null` với `CaptureBillImage` — nơi gọi (`OrderPrintTrigger`) chọn 1 trong 2
 * theo `bitmapSource`, driver không biết/không cần biết khác biệt này.
 *
 * Lỗi luôn trả `null` (không throw) — CÙNG hợp đồng với
 * `useBillImageCapture.tsx`'s `captureBillImage` (path `Image`, cũng nuốt lỗi
 * và resolve `null`). Khác biệt duy nhất: path này không mount `View` nên khi
 * fail không có gì hiện trên màn hình để debug — log `warning` ở cả 2 nhánh
 * lỗi chỉ để còn dấu vết, KHÔNG đổi hợp đồng trả về.
 */
export const renderDocumentToBitmap = async (document: PrintDocument, media: PrintPaperConfig): Promise<string | null> => {
  try {
    const widthPx = resolveWidthPx(media);
    const heightPx = estimateHeightPx(document);
    const surface = Skia.Surface.MakeOffscreen(widthPx, heightPx);

    if (!surface) {
      LoggerService.warning('renderDocumentToBitmap: Skia.Surface.MakeOffscreen trả null');
      return null;
    }

    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('white'));

    const font = resolveFont();
    const paint = Skia.Paint();
    let y = LINE_HEIGHT_PX;

    for (const element of document.elements) {
      switch (element.type) {
        case 'text':
          canvas.drawText(element.content, 0, y, paint, font);
          y += LINE_HEIGHT_PX;
          break;
        case 'line':
          canvas.drawLine(0, y, widthPx, y, paint);
          y += LINE_HEIGHT_PX;
          break;
        case 'row': {
          const rightWidth = font.measureText(element.right).width;
          canvas.drawText(element.left, 0, y, paint, font);
          canvas.drawText(element.right, widthPx - rightWidth, y, paint, font);
          y += LINE_HEIGHT_PX;
          break;
        }
        case 'table':
          for (const row of element.rows) {
            canvas.drawText(row.join('  '), 0, y, paint, font);
            y += LINE_HEIGHT_PX;
          }
          break;
        case 'barcode':
          drawBarcode(canvas, element.content, 0, y, paint);
          y += BARCODE_HEIGHT_PX;
          break;
        case 'qrCode':
          drawQrCode(canvas, element.content, 0, y, paint);
          y += QRCODE_HEIGHT_PX;
          break;
        case 'image':
          // Chưa xử lý (spec §5 — chưa từng phát sinh trong thực tế).
          break;
      }
    }

    const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG);
    return Buffer.from(bytes).toString('base64');
  } catch (error) {
    LoggerService.warning(`renderDocumentToBitmap thất bại: ${String(error)}`);
    return null;
  }
};
