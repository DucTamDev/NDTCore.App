import { Buffer } from 'buffer';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import type { PrintDocument } from '../models/printing/PrintDocument';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import { PrintPaperType } from '../models/paper/PrintPaperConfig';
import { PAPER_SIZE_SPECS, DOTS_PER_MM } from '../paper/paperSpec';
import { LINE_HEIGHT_DOTS as LINE_HEIGHT_PX, BARCODE_HEIGHT_DOTS as BARCODE_HEIGHT_PX } from './printLayoutConstants';
import { encodeCode128 } from './code128';

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
 */
const estimateHeightPx = (document: PrintDocument): number => {
  let height = 0;
  for (const element of document.elements) {
    if (element.type === 'table') {
      height += element.rows.length * LINE_HEIGHT_PX;
    } else if (element.type === 'barcode') {
      height += BARCODE_HEIGHT_PX;
    } else {
      height += LINE_HEIGHT_PX;
    }
  }
  return Math.max(LINE_HEIGHT_PX, height);
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

/**
 * Vẽ trực tiếp `PrintDocument.elements[]` lên canvas Skia off-screen — không
 * mount `View`, không phụ thuộc `onLayout`/`devicePixelRatio` như
 * `useBillImageCapture`. Cùng contract `(document, media) => base64 PNG |
 * null` với `CaptureBillImage` — nơi gọi (`OrderPrintTrigger`) chọn 1 trong 2
 * theo `bitmapSource`, driver không biết/không cần biết khác biệt này.
 */
export const renderDocumentToBitmap = async (document: PrintDocument, media: PrintPaperConfig): Promise<string | null> => {
  try {
    const widthPx = resolveWidthPx(media);
    const heightPx = estimateHeightPx(document);
    const surface = Skia.Surface.MakeOffscreen(widthPx, heightPx);

    if (!surface) {
      return null;
    }

    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('white'));

    const font = Skia.Font(); // font hệ thống mặc định — đủ dấu tiếng Việt (Roboto trên Android), xem spec §5(b)
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
        case 'image':
          // Task 8 (qrCode). image: chưa xử lý (spec §5 — chưa từng phát sinh trong thực tế).
          break;
      }
    }

    const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG);
    return Buffer.from(bytes).toString('base64');
  } catch {
    return null;
  }
};
