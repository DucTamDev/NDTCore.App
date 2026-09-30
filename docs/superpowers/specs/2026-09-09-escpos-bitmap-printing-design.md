# ESC/POS Bitmap Printing — Architecture Goal & Design Specification

## 0. Bối cảnh

ESC/POS hiện chỉ có 1 cách in duy nhất: encode text tiếng Việt (có tag `<C>`/`<B>`...) thành byte qua `EPToolkit.exchange_text()` (vendored từ upstream), gửi qua `NativeAdapter.printText()`. Chất lượng hiển thị dấu tiếng Việt phụ thuộc hoàn toàn vào việc firmware máy in có hỗ trợ đúng codepage (CP1258) hay không — máy không hỗ trợ sẽ mất dấu/hiển thị sai, không có cách nào app tự sửa được.

TSPL đã giải quyết đúng vấn đề này từ trước bằng `renderMode: 'bitmap'` — render nội dung ra ảnh (app tự kiểm soát font qua React Native `Text`), rasterize thành bitmap 1-bit, gửi bằng lệnh `BITMAP` của TSPL. App kiểm soát hoàn toàn hiển thị, không phụ thuộc firmware.

**Mục tiêu của thiết kế này:** thêm đúng cơ chế tương tự cho ESC/POS (`renderMode: 'bitmap'`, dùng lệnh chuẩn Epson `GS v 0`), tái dùng tối đa pipeline capture/rasterize đã có (không viết lại), và **tiện thể dọn 3 chỗ đã xác định là "lằng nhằng"** trong kiến trúc hiện tại — vốn đều bắt nguồn từ việc code được viết khi mới có 1 protocol cần bitmap (TSPL), nên hardcode thẳng tên protocol thay vì khái niệm chung.

Đã xác nhận (audit trước khi viết spec, xem điều tra native layer): **native Android không cần sửa gì** — `writeByBase64`/`PrinterQueue`/`UsbWriter`/`BluetoothWriter`/`NetWriter` đều chỉ chuyển tiếp byte thô, không phân biệt ý nghĩa nội dung. Toàn bộ thay đổi nằm ở tầng JS.

**Đã cân nhắc và loại bỏ** (không đưa vào phạm vi):
- *"Universal PrintBitmap cho mọi content"* (text/image/QR/barcode đều rasterize) — sai với thực hành thương mại thật: QR/barcode luôn nên dùng lệnh gốc firmware (nhỏ hơn, scan tin cậy hơn), và ESC/POS vẫn cần giữ đường text nhanh làm mặc định cho máy đã hỗ trợ đúng codepage.
- *Auto-detect theo bảng vendor/model* — đã từng bị gỡ bỏ khỏi codebase vì không đáng tin (xem `ARCHITECTURE.md`), không làm lại.
- *Luôn luôn bật bitmap cho ESC/POS, bỏ hẳn đường text* — mất tốc độ + gây regression cho máy đang in đúng.

---

## 1. Phạm vi

**Trong phạm vi:**
1. `EscPosRenderMode` (`'text' | 'bitmap'`) + `EscPosDriverConfig.renderMode`.
2. `EscPosBitmapEncoder.ts` — build lệnh `GS v 0` từ `MonochromeBitmap` đã có sẵn.
3. `EscPosDriver.sendDocuments()` rẽ nhánh theo renderMode.
4. Đổi tên 3 error code ảnh (`TSPL_IMAGE_*` → `IMAGE_*`) — dùng chung cho cả 2 protocol.
5. Tổng quát hoá 2 chỗ hardcode-TSPL: `PrintService.imageDocumentMedia()`, `useTestPrint.resolveTestPrintDocuments()`.
6. Dời `CONTINUOUS_HEIGHT_MM` từ `TsplEncoder.ts` sang `media/paperSpec.ts` (khái niệm thuộc `PrintMedia`, không thuộc riêng TSPL).
7. UI: mở `DriverRenderModeSection` cho ESC/POS, persist qua `PrinterConfigService.setEscPosRenderMode`.
8. Test cho toàn bộ phần trên.

**Ngoài phạm vi:**
- Bất kỳ thay đổi native Android nào (đã xác nhận không cần).
- QR/barcode rasterization — giữ nguyên lệnh gốc TSPL, không thêm cho ESC/POS (ESC/POS hiện vốn cũng chưa có QR/barcode, không nằm trong yêu cầu này).
- Auto phát hiện máy không hỗ trợ codepage để tự chuyển bitmap — vẫn là lựa chọn thủ công của user, giống TSPL.

---

## 2. Kiến trúc mục tiêu — cấu trúc thư mục

```text
src/features/printer/
├── media/
│   └── paperSpec.ts          # + CONTINUOUS_HEIGHT_MM (dời từ TsplEncoder.ts)
├── errors/
│   └── PrinterError.ts       # TSPL_IMAGE_* → IMAGE_* (dùng chung)
├── models/printer/
│   └── PrinterDriver.ts      # + EscPosRenderMode, EscPosDriverConfig.renderMode
├── drivers/
│   ├── driverConfig.ts       # + escPosRenderModeOf, usesBitmapRenderMode
│   ├── escpos/
│   │   ├── EscPosDriver.ts           # sửa: rẽ nhánh renderMode
│   │   ├── EscPosTextBuilder.ts      # không đổi
│   │   └── EscPosBitmapEncoder.ts    # MỚI — lệnh GS v 0
│   └── tspl/
│       └── TsplEncoder.ts    # bỏ CONTINUOUS_HEIGHT_MM (import lại từ paperSpec)
├── services/
│   ├── printing/PrintService.ts      # imageDocumentMedia() dùng usesBitmapRenderMode
│   └── PrinterConfigService.ts       # + setEscPosRenderMode
├── hooks/
│   ├── addPrinter/useTestPrint.ts    # resolveTestPrintDocuments() dùng usesBitmapRenderMode
│   ├── addPrinter/useDriverConfig.ts # + onSelectEscPosRenderMode
│   └── useAddPrinterFlow.ts          # thread prop mới
├── components/
│   ├── PrinterInfoCard.tsx           # thread prop mới
│   └── DriverRenderModeSection.tsx   # bỏ gate TSPL-only, thêm nhánh ESC/POS
├── drivers/DriverCapabilities.ts     # defaultConfig.escpos.renderMode = 'text'
└── forms/addPrinter/PrinterSchema.ts # escPosDriverConfigSchema + renderMode
```

Nguyên tắc phân chia (trả lời đúng câu hỏi "cái gì thuộc protocol, cái gì thuộc media"):
- **Thuộc `PrintMedia` (dùng chung mọi protocol chạy trên giấy cuộn liên tục):** kích thước paper (`PAPER_SIZE_SPECS`), dot density (`DOTS_PER_MM`), ngưỡng an toàn chiều cao continuous (`CONTINUOUS_HEIGHT_MM`).
- **Thuộc riêng TSPL** (không tổng quát hoá vì ESC/POS không bao giờ chạm tới, schema đã cấm die-cut cho ESC/POS): `resolveSizeHeightMm`/`DEFAULT_LABEL_HEIGHT_MM` (khai báo lệnh `SIZE`/`GAP` — ESC/POS không có khái niệm này), `columnPitchDots`/`columnOffsets`/`contentWidthChars` (lặp nội dung theo cột die-cut).
- **Thuộc riêng từng protocol driver:** cách encode byte cuối cùng (`EPToolkit`/`EscPosBitmapEncoder` cho ESC/POS, `TsplEncoder` cho TSPL) — không gộp, vì lệnh vật lý gửi xuống máy in khác hẳn nhau.

---

## 3. Data Model

### 3.1 `models/printer/PrinterDriver.ts`

```ts
export const EscPosRenderMode = {
  text: 'text',
  bitmap: 'bitmap',
} as const;
export type EscPosRenderMode = (typeof EscPosRenderMode)[keyof typeof EscPosRenderMode];

export interface EscPosDriverConfig {
  type: 'escpos';
  /** `undefined` ⇒ coi như `'text'` — giữ tương thích ngược printer đã lưu trước khi có field này. */
  renderMode?: EscPosRenderMode;
  media: PrintMedia;
}
```

Không gộp `EscPosRenderMode` với `TsplRenderMode` thành 1 enum chung — TSPL có 3 mode (`bitmap`/`truetype`/`internalfont`) với ý nghĩa khác hẳn ESC/POS chỉ có 2 (`text`/`bitmap`). Gộp sẽ tạo ra giá trị vô nghĩa cho protocol còn lại (vd `truetype` cho ESC/POS không có ý nghĩa gì).

### 3.2 `errors/PrinterError.ts`

Đổi tên (không thêm code mới):

```diff
- TSPL_IMAGE_REQUIRED: 'TSPL_IMAGE_REQUIRED',
- TSPL_IMAGE_INVALID: 'TSPL_IMAGE_INVALID',
- TSPL_IMAGE_TOO_LARGE: 'TSPL_IMAGE_TOO_LARGE',
+ IMAGE_REQUIRED: 'IMAGE_REQUIRED',
+ IMAGE_INVALID: 'IMAGE_INVALID',
+ IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
```

**Lý do đổi:** 3 code này mô tả trạng thái của `documents.image` (base64 PNG) — 1 khái niệm ở tầng `PrintDocuments` chung, không phải lỗi riêng của TSPL. Giữ tiền tố `TSPL_` sẽ gây hiểu lầm khi ESC/POS bitmap cũng ném cùng nhóm lỗi này. Đây là rename nội bộ (reject code gửi qua `promise.reject(code, message)` xuống JS caller) — không phải giao thức với bên thứ 3, an toàn để đổi.

**Cập nhật theo:** `TsplBitmapStrategy.ts` (3 chỗ ném lỗi), test liên quan trong `TsplBitmapStrategy.test.ts`.

### 3.3 `media/paperSpec.ts` — thêm hằng số dùng chung

```ts
/**
 * Ngưỡng an toàn chiều cao (mm) cho nội dung render bitmap trên giấy cuộn
 * liên tục (continuous) — không phải giới hạn phần cứng thật, chỉ để chặn 1
 * document lỗi/vô hạn vòng lặp tạo ra bitmap khổng lồ. Dùng chung cho mọi
 * protocol in trên giấy cuộn liên tục (ESC/POS luôn continuous; TSPL
 * continuous Receipt).
 */
export const CONTINUOUS_HEIGHT_MM = 200;
```

`drivers/tspl/TsplEncoder.ts` xoá định nghĩa cũ, `import { CONTINUOUS_HEIGHT_MM } from '../../media/paperSpec';` — hành vi `resolveSizeHeightMm()` không đổi.

---

## 4. Bộ mã hoá ESC/POS bitmap — `drivers/escpos/EscPosBitmapEncoder.ts` (file mới)

Không dựng class stateful như `TsplEncoder` — TSPL cần vì 1 bill TSPL có nhiều lệnh nối tiếp (`SIZE`/`GAP`/nhiều `TEXT`/`BARCODE`/`PRINT`). ESC/POS bitmap mode gửi **toàn bộ nội dung là đúng 1 ảnh**, nên chỉ cần 1 hàm thuần:

```ts
import type { MonochromeBitmap } from '../../utils/monochromeBitmap';
import { CutterMode } from '../../models/media/PrintMedia';

const INIT_PRINTER_BYTES = [0x1b, 0x40]; // ESC @
const CUT_BYTES = [0x1b, 0x6d]; // khớp hành vi cắt ESC/POS text-mode hiện tại (EPToolkit.cut_bytes)

/**
 * Lệnh raster bit image chuẩn Epson `GS v 0` — width tính theo BYTE (little-
 * endian 2 byte), height theo DOT, theo sau đúng `widthBytes * heightPx` byte
 * nhị phân MSB-first (bit=1 là đen). Định dạng này khớp NGUYÊN VẸN với
 * `MonochromeBitmap.bits` đã có — KHÔNG cần đảo bit như quirk firmware
 * riêng của lệnh `BITMAP` TSPL (đó là lỗi 1 dòng máy clone cụ thể, không áp
 * dụng cho `GS v 0`).
 */
export const buildEscPosBitmapBytes = (bitmap: MonochromeBitmap, cutterMode: CutterMode): Uint8Array => {
  const header = [
    0x1d, 0x76, 0x30, 0x00,
    bitmap.widthBytes & 0xff, (bitmap.widthBytes >> 8) & 0xff,
    bitmap.heightPx & 0xff, (bitmap.heightPx >> 8) & 0xff,
  ];

  const trailer = cutterMode === CutterMode.none ? [] : CUT_BYTES;

  return new Uint8Array([...INIT_PRINTER_BYTES, ...header, ...bitmap.bits, ...trailer]);
};
```

**Chưa xác nhận trên phần cứng thật** (ghi rõ theo đúng convention đã dùng cho `truetype`/`internalfont`/die-cut TSPL trước đây): byte cắt `[0x1b, 0x6d]` copy từ hằng số `cut_bytes` trong `EPToolkit.ts` (vendored, không export — khai lại local trong file mới để không đụng file vendored) để giữ đúng hành vi cắt vật lý người dùng đã quen với text-mode hiện tại. Đây không phải lệnh `GS V` chuẩn Epson mới nhất, nhưng là lệnh ESC/POS text-mode hiện tại của app đã hoạt động — giữ nguyên cho nhất quán thay vì đổi sang chuẩn khác chưa test.

`resolveEffectiveCutterMode()` (đã có, generic) tính `cutterMode` truyền vào — vì ESC/POS media luôn `continuous` (schema đã ràng buộc), luôn ra `media.cutterMode ?? CutterMode.perJob`, không bao giờ `none` trừ khi user chọn tường minh.

---

## 5. `drivers/escpos/EscPosDriver.ts`

```ts
private async sendDocuments(adapter: NativeAdapter, driver: PrinterDriver, documents: PrintDocuments): Promise<void> {
  if (escPosRenderModeOf(driver) === EscPosRenderMode.bitmap) {
    if (!documents.image) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_REQUIRED, message: 'Chế độ Bitmap cần ảnh bill đã render — capture ảnh thất bại hoặc chưa chạy.' });
    }

    const media = mediaOf(driver);
    const targetWidthPx = PAPER_SIZE_SPECS[paperSizeOf(driver)].imageWidthPx;

    let bitmap;
    try {
      bitmap = decodePngBase64ToMonochrome(documents.image, targetWidthPx);
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_INVALID, message: 'Ảnh bill không hợp lệ (không giải mã được PNG).', cause: error });
    }

    const maxHeightPx = CONTINUOUS_HEIGHT_MM * DOTS_PER_MM;
    if (bitmap.heightPx > maxHeightPx) {
      throw new PrinterErrorException({ code: PrinterErrorCode.IMAGE_TOO_LARGE, message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt ngưỡng an toàn ${CONTINUOUS_HEIGHT_MM}mm.` });
    }

    const bytes = buildEscPosBitmapBytes(bitmap, resolveEffectiveCutterMode(media));
    await adapter.write(bytes); // KHÔNG dùng adapter.printText() — cần chunk qua UsbTransport như TSPL bitmap
    return;
  }

  const cut = resolveEffectiveCutterMode(mediaOf(driver)) !== CutterMode.none;
  const text = buildEscPosText(paperSizeOf(driver), documents);
  await adapter.printText(text, { ...ESC_POS_BASE_OPTIONS, cut });
}
```

Vì ESC/POS media luôn `continuous` (schema hiện tại đã cấm die-cut cho ESC/POS), bitmap builder **không cần** `columnOffsets`/`rows` như TSPL die-cut — đơn giản hơn hẳn theo đúng lý do vật lý, không phải cắt bớt tính năng.

`adapter.write(bytes)` thay vì `adapter.printText()`: `printText()` trên USB gọi thẳng `writeByBase64` không chunk (giữ hành vi cũ cho bill nhỏ), còn `write()` chunk qua `UsbTransport` 16KB/lần — bitmap 1 bill dài có thể vượt 1 lần transfer, cần chunk giống cách TSPL bitmap đã làm.

---

## 6. Tầng dùng chung

### 6.1 `drivers/driverConfig.ts`

```ts
export const escPosRenderModeOf = (driver: PrinterDriver): EscPosRenderMode | null =>
  driver.config.type === PrinterDriverType.escpos ? (driver.config.renderMode ?? EscPosRenderMode.text) : null;

/** Driver này có đang ở chế độ render ảnh không — dùng chung cho mọi protocol có khái niệm bitmap. */
export const usesBitmapRenderMode = (driver: PrinterDriver): boolean => {
  if (driver.type === PrinterDriverType.tspl) {
    return tsplRenderModeOf(driver) === TsplRenderMode.bitmap;
  }
  if (driver.type === PrinterDriverType.escpos) {
    return escPosRenderModeOf(driver) === EscPosRenderMode.bitmap;
  }
  return false;
};
```

### 6.2 `services/printing/PrintService.ts`

```diff
  const imageDocumentMedia = (printType: PrintType): PrintMedia | null => {
-   const target = deps.routing.resolveTargets(printType).find((t) => t.driver.type === PrinterDriverType.tspl && tsplRenderModeOf(t.driver) === TsplRenderMode.bitmap);
+   const target = deps.routing.resolveTargets(printType).find((t) => usesBitmapRenderMode(t.driver));
    return target ? mediaOf(target.driver) : null;
  };
```

### 6.3 `hooks/addPrinter/useTestPrint.ts`

```diff
  const resolveTestPrintDocuments = async (driver, document) => {
-   if (tsplRenderModeOf(driver) !== TsplRenderMode.bitmap) return { text: document };
+   if (!usesBitmapRenderMode(driver)) return { text: document };
    ...
```

### 6.4 `services/PrinterConfigService.ts` — thêm setter đối xứng

```ts
const setEscPosRenderMode = (printerId: string, renderMode: EscPosRenderMode): void => {
  const printer = repository.getPrinters().find((p) => p.id === printerId);
  const entry = printer?.drivers.find((d) => d.type === PrinterDriverType.escpos);

  if (!printer || !entry || entry.config.type !== PrinterDriverType.escpos) {
    return;
  }

  repository.savePrinters(
    repository.getPrinters().map((p) =>
      p.id !== printerId
        ? p
        : { ...p, drivers: p.drivers.map((d) => (d.type !== PrinterDriverType.escpos || d.config.type !== PrinterDriverType.escpos ? d : { ...d, config: { ...d.config, renderMode } })) },
    ),
  );
};
```

Không cần bước "install" như `installTsplFont` — bitmap ESC/POS không cài gì lên máy in, chỉ đổi cách encode ở JS.

---

## 7. UI

### 7.1 `components/DriverRenderModeSection.tsx`

Bỏ gate `if (driver.type !== tspl) return null`, thêm nhánh ESC/POS (1 `AppSelect` 2 option):

```tsx
if (driver.type === PrinterDriverType.escpos) {
  return (
    <AppSelect
      label="Chế độ in ESC/POS"
      value={escPosRenderModeOf(driver) ?? EscPosRenderMode.text}
      onSelect={(value) => onSelectEscPosRenderMode(value as EscPosRenderMode)}
      options={[
        { label: 'Text (nhanh, cần máy hỗ trợ CP1258)', value: EscPosRenderMode.text },
        { label: 'Bitmap (có dấu, mọi máy)', value: EscPosRenderMode.bitmap },
      ]}
      disabled={disabled}
    />
  );
}
```

Vẫn 1 component, 1 trách nhiệm ("UI chọn render mode theo driver type") — không tách thành `EscPosRenderModeSection`/`TsplRenderModeSection` riêng vì logic hiển thị đủ ngắn để giữ chung mà không rối.

### 7.2 Thread prop mới

`onSelectEscPosRenderMode` đi qua: `useDriverConfig.ts` (thêm handler, gọi `PrinterConfigService.setEscPosRenderMode` giống `onSelectTsplRenderMode` nhưng không có bước async cài font) → `useAddPrinterFlow.ts` (expose ra `infoCard` prop) → `PrinterInfoCard.tsx` (nhận prop, truyền xuống `DriverRenderModeSection`).

### 7.3 `drivers/DriverCapabilities.ts`

```diff
- escpos: { contentTypes: [...], defaultConfig: { type: 'escpos', media: { ...DEFAULT_MEDIA } } },
+ escpos: { contentTypes: [...], defaultConfig: { type: 'escpos', renderMode: EscPosRenderMode.text, media: { ...DEFAULT_MEDIA } } },
```

Khai tường minh `renderMode: 'text'` trong default config (khớp cách TSPL khai tường minh `renderMode: 'bitmap'`) — dù field optional/undefined cũng tương đương 'text', khai rõ giúp default config luôn là 1 giá trị hợp lệ đầy đủ, không dựa vào suy luận ngầm ở nơi đọc.

### 7.4 `forms/addPrinter/PrinterSchema.ts`

```diff
  const escPosDriverConfigSchema = z.object({
    type: z.literal(PrinterDriverType.escpos),
+   renderMode: z.enum([EscPosRenderMode.text, EscPosRenderMode.bitmap]).optional(),
    media: printMediaSchema,
  });
```

---

## 8. Testing

- `EscPosBitmapEncoder.test.ts` (mới): header bytes đúng little-endian cho vài kích thước, `cutterMode: none` không phát `CUT_BYTES`, data đúng bằng `bitmap.bits`.
- `EscPosDriver.test.ts`: thêm case renderMode bitmap — thiếu `documents.image` ném `IMAGE_REQUIRED`; PNG hỏng ném `IMAGE_INVALID`; ảnh quá cao ném `IMAGE_TOO_LARGE`; case hợp lệ gọi `adapter.write()` (không phải `printText()`) với bytes đúng.
- `TsplBitmapStrategy.test.ts`: cập nhật assertion sang `IMAGE_REQUIRED`/`IMAGE_INVALID`/`IMAGE_TOO_LARGE`.
- `PrintService.test.ts`: `imageDocumentMedia()` trả đúng media khi target là ESC/POS bitmap (case mới) lẫn TSPL bitmap (case cũ, không được regress).
- `useTestPrint`/`useAddPrinterFlow` test: case renderMode ESC/POS bitmap capture ảnh trước khi test print.
- `PrinterConfigService.test.ts`: `setEscPosRenderMode` — no-op khi printer chưa lưu (draft), persist đúng khi đã lưu.
- `PrinterSchema.test.ts`: `renderMode` hợp lệ/không hợp lệ cho `escPosDriverConfigSchema`.

---

## 9. Rủi ro / giới hạn đã biết

- Lệnh `GS v 0` và byte cắt `[0x1b, 0x6d]` **chưa test trên phần cứng ESC/POS thật** — cùng mức độ chưa-verify như `TsplRenderMode.truetype`/`internalfont` đã ghi nhận trước đây. Cần test thật trước khi khuyến nghị người dùng bật bitmap mode trên diện rộng.
- Bitmap render qua `useBillImageCapture` vẫn giữ nguyên toàn bộ giới hạn đã biết (race `onLayout`, cần `collapsable={false}`, chi phí capture cao hơn hẳn text) — không có gì mới, nhưng giờ ESC/POS cũng chịu chi phí này khi bật bitmap.
- Không có ngưỡng nào chặn user bật đồng thời bitmap cho CẢ 2 driver (ESC/POS + TSPL) trên cùng 1 printer — mỗi lần in sẽ capture ảnh riêng cho từng driver (2 lần capture, xem `imageDocumentMedia` chỉ trả 1 media đầu tiên tìm thấy — cần xác nhận lại hành vi này có đúng ý muốn khi có 2 driver cùng bitmap, hiện tại out of scope, giữ nguyên hành vi "first match" đã có).
