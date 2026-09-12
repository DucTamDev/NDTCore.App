# Printer Render Mode Expansion — TSPL text mode + AST-based bitmap rendering

**Ngày:** 2026-09-12

## 1. Bối cảnh & động lực

UI "Cài đặt nâng cao" của Add/Edit Printer (`DriverRenderModeSection`) hiện chỉ cho **ESC/POS** chọn `renderMode` (`Encoder`/`Bitmap`) — TSPL bị khoá cứng `Bitmap` từ đợt redesign `2026-09-11-printer-model-redesign-design.md`, vì 2 chiến lược text cũ của TSPL (`TrueType`, `InternalFont`) đều có rủi ro đã biết (không verify được font còn tồn tại sau mất điện; 1 số firmware như XP-420B không hỗ trợ codepage tiếng Việt qua `internalfont`) và chưa từng chạy thật ở production nên đã bị xoá hoàn toàn.

Yêu cầu mới:

1. **TSPL cũng cần chọn được text mode** — nhưng theo hướng đơn giản/rủi ro thấp hơn 2 cách cũ: dùng **font built-in mặc định của máy in**, không tải font, không đổi CODEPAGE. Chấp nhận luôn giới hạn đã biết (font built-in `"3"` của TSPL trên nhiều dòng máy chỉ có glyph ASCII — xem comment trong `TsplEncoder.text()`), không cố sửa.
2. **Bitmap mode (cả ESC/POS lẫn TSPL) có thêm 1 lựa chọn nguồn ảnh**: `Image` (hành vi hiện tại — chụp `View` React qua `react-native-view-shot`) hoặc `Ast` (mới — vẽ trực tiếp từ `PrintDocument.elements[]` lên canvas Skia off-screen, không mount View, không phụ thuộc `onLayout`).

Lý do chọn `Ast` (đủ cả 3, theo xác nhận): tốc độ/hiệu năng, chất lượng/độ sắc nét (đường chụp ảnh hiện tại phải anti-alias rồi threshold về đen-trắng, dễ mờ/răng cưa), và in được mà không cần mount UI (né toàn bộ fragility đã tự ghi chú trong `useBillImageCapture.tsx`: race `onLayout`, tính lại theo `devicePixelRatio`).

**Phạm vi rõ ràng: cả 2 phần trên làm chung 1 spec/plan.**

## 2. Data model

`RenderMode` (`Encoder`/`Bitmap`) giữ nguyên ý nghĩa — vẫn là lựa chọn cấp protocol (lệnh text vs lệnh bitmap). Thêm enum mới **`BitmapSource`**, chỉ có ý nghĩa khi `renderMode === Bitmap`:

```ts
export const BitmapSource = {
  Image: 'Image',
  Ast: 'Ast',
} as const;
export type BitmapSource = (typeof BitmapSource)[keyof typeof BitmapSource];

export interface PrinterDriverConfig {
  renderMode: RenderMode;
  /** Chỉ có ý nghĩa khi renderMode === Bitmap. Mặc định `Image` (backward-compat — printer đã lưu trước khi field này tồn tại không có field, coi như Image). */
  bitmapSource?: BitmapSource;
}
```

`PrinterDriver`/`PrinterDriverConfig` dùng chung 1 shape cho cả 2 protocol (không đổi từ đợt redesign trước) — `bitmapSource` thêm vào field chung, không tạo config riêng theo driver.

## 3. Schema (`PrinterSchema.ts`)

- **Bỏ** rule khoá cứng "TSPL luôn `Bitmap`". TSPL giờ chọn được `Encoder`/`Bitmap` y hệt ESC/POS.
- Rule capability-check hiện có (driver-capability-vs-`printer.type`, thêm ở đợt fix review trước) giữ nguyên — không liên quan tới `renderMode`.
- Thêm validate cho `bitmapSource`: chỉ set khi `renderMode === Bitmap` (không bắt buộc phải set — thiếu thì coi như `Image`).

## 4. TSPL Text Strategy (`drivers/tspl/strategies/TsplTextStrategy.ts`)

Mirror `TsplBitmapStrategy`, implement `ITsplPrintStrategy` với `mode = RenderMode.Encoder`. Đi qua `documents.text.elements[]` (AST dùng chung với ESC/POS Encoder), map từng loại sang lệnh TSPL thật:

```ts
export class TsplTextStrategy implements ITsplPrintStrategy {
  readonly mode = RenderMode.Encoder;

  validate(): void {} // không cần ảnh như Bitmap — không có precondition

  encode(context: TsplStrategyContext): Uint8Array {
    const { documents, paper, printType, rows } = context;
    const encoder = new TsplEncoder().initialize(paper, printType);
    const charsPerLine = contentWidthChars(paper); // đã có sẵn, dùng chung TsplEncoder
    let y = 0;

    for (const element of documents.text.elements) {
      switch (element.type) {
        case 'text':
          encoder.text(0, y, element.content);
          y += LINE_HEIGHT_DOTS;
          break;
        case 'line':
          encoder.text(0, y, '-'.repeat(charsPerLine));
          y += LINE_HEIGHT_DOTS;
          break;
        case 'row':
          encoder.text(0, y, formatRow(element.left, element.right, charsPerLine)); // util dùng chung với ESC/POS
          y += LINE_HEIGHT_DOTS;
          break;
        case 'table':
          for (const row of element.rows) {
            encoder.text(0, y, row.join('  '));
            y += LINE_HEIGHT_DOTS;
          }
          break;
        case 'barcode':
          encoder.barcode(0, y, element.content); // TsplEncoder đã có sẵn — ESC/POS text mode KHÔNG hỗ trợ được cái này
          y += BARCODE_HEIGHT_DOTS;
          break;
        case 'qrCode':
          encoder.qrcode(0, y, element.content); // tương tự, đã có sẵn
          y += QRCODE_HEIGHT_DOTS;
          break;
        case 'image':
          throw new PrinterErrorException({ code: PrinterErrorCode.TSPL_ELEMENT_UNSUPPORTED, message: 'TSPL text mode không hỗ trợ phần tử image — dùng chế độ Bitmap.' });
      }
    }

    return encoder.cut(rows, resolveEffectiveCutterMode(paper)).encode();
  }
}
```

`LINE_HEIGHT_DOTS` — hằng số ước lượng theo font built-in `"3"`. `BARCODE_HEIGHT_DOTS` **không phải đoán** — `TsplEncoder.barcode()` đã hardcode chiều cao `50` dots ngay trong lệnh (`BARCODE x,y,"128",50,...`), lấy đúng số đó (+ margin nhỏ) là chính xác. `QRCODE_HEIGHT_DOTS` mới thật sự là ước lượng cố định — kích thước QR thật phụ thuộc độ dài nội dung/version, theo quyết định "không wrap" ở mục 6 chấp nhận cấp chỗ cố định, tràn thì chấp nhận.

`TsplDriver.buildBytes()` chọn strategy theo `renderMode`, y hệt cách `EscPosDriver.sendDocuments()` rẽ nhánh hiện tại:

```ts
const strategy = printer.driver.config.renderMode === RenderMode.Bitmap ? tsplBitmapStrategy : tsplTextStrategy;
```

**Ghi chú:** TSPL text mode hỗ trợ `barcode`/`qrCode` (qua lệnh native `TsplEncoder` đã có) — **mạnh hơn** ESC/POS Encoder hiện tại (`buildEscPosText` throw `TSPL_ELEMENT_UNSUPPORTED` cho 2 loại này). Đây là khác biệt có chủ đích giữa 2 protocol, không phải thiếu nhất quán cần sửa.

## 5. Skia AST→bitmap renderer (`rendering/renderDocumentToBitmap.ts`)

Cùng contract với `CaptureBillImage` hiện tại: `(document: PrintDocument, media: PrintPaperConfig) => Promise<string | null>` (base64 PNG, `null` khi lỗi) — driver tiêu thụ `documents.image` giống hệt nhau bất kể nguồn nào tạo ra nó, **không đổi code driver**.

```ts
export const renderDocumentToBitmap = async (document: PrintDocument, media: PrintPaperConfig): Promise<string | null> => {
  try {
    const widthPx = resolveWidthPx(media); // logic đo bề rộng giống useBillImageCapture
    const heightPx = estimateHeightPx(document, media); // pass đo trước — xem ghi chú (a)
    const surface = Skia.Surface.MakeOffscreen(widthPx, heightPx);
    if (!surface) return null;

    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('white'));
    const font = getPrintFont(); // xem ghi chú (b) — không cần nhúng font riêng

    let y = LINE_HEIGHT_PX;
    for (const element of document.elements) {
      switch (element.type) {
        case 'text':
          canvas.drawText(element.content, 0, y, paint, font);
          y += LINE_HEIGHT_PX;
          break;
        case 'line':
          canvas.drawLine(0, y, widthPx, y, linePaint);
          y += LINE_HEIGHT_PX;
          break;
        case 'row':
          // vẽ left tại x=0; right canh phải qua font.measureText(element.right).width
          y += LINE_HEIGHT_PX;
          break;
        case 'table':
          // mỗi phần tử row.join('  ') là 1 dòng, y += LINE_HEIGHT_PX mỗi dòng
          break;
        case 'barcode':
          drawBarcode(canvas, element.content, 0, y, widthPx); // xem ghi chú (c)
          y += BARCODE_HEIGHT_PX;
          break;
        case 'qrCode':
          drawQrCode(canvas, element.content, 0, y); // xem ghi chú (c)
          y += QRCODE_HEIGHT_PX;
          break;
      }
    }

    const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG);
    return base64Encode(bytes);
  } catch {
    return null;
  }
};
```

**(a) Đo chiều cao trước khi tạo surface** — khác biệt quan trọng so với `View`-shot: Skia surface cần size cố định NGAY lúc tạo, không tự cao theo nội dung như `View`. Phải đi qua `document.elements` 2 lần: 1 lần đếm dòng → tính tổng chiều cao (đơn giản vì đã quyết định "không wrap" ở mục 6 — số dòng cố định theo số phần tử, không phụ thuộc đo pixel thật), tạo surface đúng size đó, rồi mới vẽ thật lần 2.

**(b) Font — không cần nhúng font riêng.** Khác hẳn vấn đề font của TSPL (font cứng trong máy in). Skia vẽ trên **điện thoại** trước khi rasterize — dùng font hệ thống Android (Roboto, có sẵn đầy đủ dấu tiếng Việt) là đủ, không có rủi ro font như TSPL.

**(c) Barcode/QR:**

- QR: thêm dependency **`qrcode`** (npm, pure-JS, chỉ sinh ma trận boolean, không đụng DOM/React) — lấy `modules` rồi tự vẽ từng ô thành `canvas.drawRect(...)`.
- Barcode (Code128): **tự viết** thuật toán encode (gọn, ~50-80 dòng, không cần thêm dependency thứ 2 chỉ cho 1 thuật toán nhỏ) — trả về chuỗi bar-width pattern rồi tự vẽ từng vạch bằng `drawRect`.

`image` element type: chưa từng được `OrderPrintTrigger.buildBillElements` sinh ra trong thực tế (chỉ `text`/`line`/`row`/`table`) — giữ nguyên chưa xử lý ở cả TSPL text mode lẫn Skia renderer, không mở rộng scope ngoài yêu cầu.

## 6. Quyết định đã chốt: KHÔNG wrap dòng dài (v1)

Cả `TsplTextStrategy` và Skia renderer đều **không tự wrap** text quá khổ giấy — giống mức đơn giản của ESC/POS Encoder hiện tại (máy in tự lo, hoặc tràn). Khác với 2 đường render hiện có (ESC/POS: máy in tự wrap; Image-capture: `<Text>` của RN tự wrap qua flexbox), 2 đường MỚI này lần đầu tiên phải tự lo layout — chấp nhận không wrap ở v1, có thể nâng cấp sau (đo pixel thật qua Skia `measureText` hoặc ước lượng ký tự qua `contentWidthChars`) nếu thực tế cần.

## 7. UI & orchestration wiring

`DriverRenderModeSection.tsx` — bỏ early-return chặn TSPL (`driver.type !== EscPos → null`), cả 2 driver đều hiện selector `renderMode`; nhãn theo từng driver (TSPL: "Text (font mặc định máy in)"; ESC/POS: giữ nguyên "Văn bản, cần đúng codepage"). Thêm selector thứ 2 **chỉ khi `renderMode === Bitmap`**: "Nguồn ảnh bitmap" → `Image`/`Ast`.

`useDriverConfig.ts` — thêm `onSelectBitmapSource`, persist qua `PrinterConfigService.setBitmapSource()` (method mới, mirror `setRenderMode`).

`PrintService.imageDocumentMedia()` đổi tên/trả thêm `bitmapSource` của target đã resolve:

```ts
const imageDocumentTarget = (printType: PrintType): { paper: PrintPaperConfig; bitmapSource: BitmapSource } | null => {
  const target = deps.routing.resolveTargets(printType).find((printer) => usesBitmapRenderMode(printer.driver));
  return target ? { paper: target.paper, bitmapSource: target.driver.config.bitmapSource ?? BitmapSource.Image } : null;
};
```

`OrderPrintTrigger.buildPrintDocumentVariants` rẽ nhánh gọi đúng hàm sinh ảnh, vẫn gán kết quả vào **cùng field** `documents.image`:

```ts
const target = PrintService.imageDocumentTarget(printType);
if (!target) return { text: textDocument };
const base64 = target.bitmapSource === BitmapSource.Ast
  ? await renderDocumentToBitmap(textDocument, target.paper)   // hàm thuần, KHÔNG cần React tree
  : await captureBillImage(textDocument, target.paper);        // hook, cần captureNode đã mount
if (!base64) return { text: textDocument };
return { text: textDocument, image: base64 };
```

**Driver (`EscPosDriver.sendBitmap`, `TsplBitmapStrategy`) không đổi 1 dòng nào** — chỉ tầng orchestration (`OrderPrintTrigger`) biết về `bitmapSource`.

## 8. Testing

- **`TsplTextStrategy`** — thuần JS/TS (chỉ gọi `TsplEncoder`, không đụng native) → unit test trực tiếp, không cần mock, giống `TsplBitmapStrategy.test.ts`.
- **Code128 encoder** (tự viết) — test bar-pattern output so khớp vài input đã biết kết quả chuẩn.
- **QR matrix** (`qrcode` lib) — pure JS, test trực tiếp không cần mock.
- **`renderDocumentToBitmap` (Skia)** — dùng `@shopify/react-native-skia/jest/setup` (Skia CanvasKit chạy trong Node, do lib chính thức publish) để test thật (assert kích thước/vài pixel ảnh output) — verify khả năng này cụ thể ở bước implementation.
- **Chỗ gọi `renderDocumentToBitmap`** (`OrderPrintTrigger`) — mock nguyên function, giống pattern `jest.mock('../useBillImageCapture', ...)` đã có cho `captureBillImage`.
- **`DriverRenderModeSection.tsx`** — theo convention hiện tại của repo, component UI thuần không có test file riêng, verify qua type-check/lint + tay trên thiết bị.
- **`PrinterSchema.test.ts`** — cập nhật: TSPL chấp nhận cả `Encoder`/`Bitmap`; thêm case cho `bitmapSource`.

## 9. Rủi ro/giới hạn đã chấp nhận

- TSPL text mode dùng font built-in `"3"` — trên nhiều dòng máy **không có dấu tiếng Việt** dù gửi đúng UTF-8 (giới hạn đã biết, ghi trong `TsplEncoder.text()`). Người dùng chọn text mode cho TSPL cần biết đánh đổi này (nhãn UI nên phản ánh, xem mục 7).
- Không wrap dòng dài ở TSPL text mode / Skia AST renderer (mục 6) — nội dung quá khổ giấy sẽ tràn thay vì tự xuống dòng.
- Barcode/QR trong TSPL text mode và Skia renderer dùng chiều cao ước lượng cố định, không tính theo kích thước thật đã encode — có thể tràn ở nội dung dài bất thường.
- `image` element type chưa được xử lý ở cả 2 đường mới (chưa từng phát sinh trong thực tế, không mở rộng scope).

## 10. Phạm vi KHÔNG làm ở đợt này

- Không phục hồi `TrueType`/`InternalFont` strategy cũ của TSPL (đã xoá hẳn, quyết định không đổi).
- Không làm in nền/background khi app không chạy (Skia off-screen chỉ giải quyết "không cần mount UI thấy được", vẫn cần app đang chạy).
- Không implement text-wrapping thật (đo pixel/ký tự) — để lại nâng cấp sau nếu cần.
