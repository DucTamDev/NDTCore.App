# Semantic PrintElement & Compiler Warnings — Design Spec

## Bối cảnh

`packages/printer-core` có nguyên tắc kiến trúc: **Template là common, Element trong `ResolvedPrintDocument` cũng phải common** — `LayoutEngine` không được biết gì về capability riêng của từng ngôn ngữ máy in; chỉ `{Lang}Compiler` mới được phép ánh xạ 1 semantic field sang cách hiện thực cụ thể của ngôn ngữ đó.

Rà soát cho thấy nguyên tắc này đang bị vi phạm ở 2 dạng cụ thể:

### 1. Field mang ngữ nghĩa native rò rỉ vào tầng common

`TextOptions.font`/`size`/`xScale`/`yScale` không có khái niệm chung nào — mỗi ngôn ngữ diễn giải khác nhau:

| Ngôn ngữ | Công thức compiler dùng `size` |
|---|---|
| TSPL/EPL/CPCL/DPL/IPL/SBPL | hệ số nhân nguyên 1-8 lên 1 font bitmap cố định |
| ZPL | `h = size × 30` (hằng số `FONT_HEIGHT_UNIT`) — ra thẳng dots |
| ESC/POS/Star PRNT | đóng gói vào 1 byte theo cách riêng của hãng |

`LayoutEngine.toMagnification()` cố tính ra **1 giá trị `size`** dùng chung cho mọi ngôn ngữ — không tồn tại công thức `dots → size` nào cho kết quả đúng khi đi qua cả 9 công thức nghịch đảo khác nhau ở trên. Hệ quả: cùng 1 `fontSize` tác giả khai báo, in ra 9 máy in cho 9 chiều cao chữ vật lý khác nhau trên giấy thật — không chỉ preview.

`font` (chọn font code cụ thể, VD `'2'`) cũng cùng bệnh: `DEFAULT_FONT` khác nhau và không tương thích chéo giữa các ngôn ngữ (CPCL/EPL/TSPL dùng `'2'`, ZPL dùng `'0'`, DPL dùng `'9'` — cùng mã nhưng nghĩa khác hẳn hoặc không tồn tại ở ngôn ngữ khác). IPL còn xác nhận thêm: font/charset của nó **cố định cứng, không hỗ trợ chọn** — field `font` chưa từng có tác dụng ở đây.

Phát hiện phụ: `ZplPreviewRenderer` dùng chiều cao font mặc định = 18 dots, trong khi `ZplCompiler` dùng `FONT_HEIGHT_UNIT` = 30 dots cho cùng 1 font — 2 con số này đang lệch nhau ngay trong code hiện tại, độc lập với bug trên.

### 2. Field/element bị compiler âm thầm bỏ qua, không có tín hiệu báo lại

| Field/Element | Ngôn ngữ | Hành vi |
|---|---|---|
| `CutOptions.rows` | ZPL, Star PRNT | Bỏ qua hoàn toàn (lệnh cắt chỉ nhận 1 tham số cố định) |
| `CutOptions.mode` ('partial' vs 'full') | TSPL, Star PRNT | Gộp thành cùng 1 giá trị, không phân biệt được |
| `CutOptions` (toàn bộ) | CPCL, DPL, EPL, IPL | No-op hoàn toàn — không có lệnh cắt giấy nào được ngôn ngữ này tài liệu hoá |
| `BarcodeConfig.readable` | CPCL | Bỏ qua — hiện/ẩn chữ đọc được do 1 lệnh trạng thái riêng điều khiển, không phải tham số inline |
| `QrCodeConfig.rotation` | ZPL | Bỏ qua riêng cho QR (`^BQ` chỉ ổn định ở orientation N) — cùng field hoạt động đúng cho `barcode`/`text` trên chính ZPL |
| `Circle`/`Ellipse`/`Reverse`/`Erase` | 7/9 ngôn ngữ (trừ TSPL, +ZPL cho Circle) | No-op toàn phần — ngôn ngữ không có lệnh vẽ hình học tương ứng |
| `Barcode`/`QrCode` | 5/9 ngôn ngữ (DPL, ESC/POS, IPL, SBPL, Star PRNT) | No-op toàn phần |

`PrintCompiler.compile()` hiện chỉ trả về `TOutput` (string/bytes) — không có kênh nào để báo những trường hợp trên. So sánh: `PrintParser` đã có sẵn `warnings: string[]` trong mọi implementation. Đây là chỗ bất đối xứng khiến các case trên không thể được phát hiện ở compile-time.

## Mục tiêu

1. `TextOptions` chỉ còn field semantic — loại bỏ hoàn toàn field mang ngữ nghĩa native (`font`, `size`, `xScale`, `yScale`).
2. Mỗi ngôn ngữ tự chịu trách nhiệm quy đổi semantic → native, dùng đúng 1 nguồn dữ liệu font duy nhất (không còn duplicate/lệch số giữa Compiler và PreviewRenderer).
3. `PrintCompiler` có kênh báo capability-gap, đối xứng với `PrintParser` — áp dụng cho mọi case đã liệt kê ở trên (field bị bỏ, element không hỗ trợ).

## Ngoài phạm vi (Non-goals)

- Không thêm field mới để chọn "kiểu font" (`fontFamily`/`fontStyle`) — chưa có nhu cầu thật, tránh đoán trước (YAGNI). Nếu sau này cần, đây là 1 spec riêng.
- Không đổi hành vi no-op hiện tại của bất kỳ element/field nào — chỉ thêm **cảnh báo**, không thêm capability mới, không cố "sửa" cho các ngôn ngữ hỗ trợ những gì chúng chưa hỗ trợ.
- Không đổi `Template`/`TemplateNode`/`DocumentResolver` — các tầng này đã đúng common từ đầu.
- Không bắt buộc `PrintPreview`/`{Lang}PreviewRenderer` phải có kênh warnings tương tự (preview là dev-tool, không phải đường in thật) — chỉ đổi nguồn bảng font để hết duplicate.
- Không mở rộng command catalog của bất kỳ ngôn ngữ nào (thêm lệnh mới) — đây là việc khác.

## Kiến trúc

### Luồng dữ liệu

```
Template (TextStyle.fontSize: dots)
   │
   ▼
DocumentResolver.resolve(template, data)      — không đổi
   │
   ▼
LayoutEngine.resolve(...)                     — ĐƠN GIẢN HOÁ: bỏ hẳn toMagnification()
   │  PrintElement[] — TextOptions.fontSize mang thẳng từ TextStyle.fontSize, không tính toán
   ▼
ResolvedPrintDocument
   │
   ▼
LanguageDispatch.compileTo(language, document, profile)
   │
   ▼
{Lang}Compiler.compile(document)
   │  tự derive font code + magnification/dots từ fontSize, dùng {Lang}FontMetrics.ts riêng
   │  push warning vào mảng warnings[] mỗi khi phải bỏ/gộp field hoặc no-op cả element
   ▼
{ output: TOutput; warnings: string[] }
```

### 1. `TextOptions` (`document/elements/content/TextElement.ts`)

```ts
export interface TextOptions {
  x?: number;
  y?: number;
  fontSize?: number;      // dots — chiều cao glyph danh nghĩa, cùng đơn vị TextStyle.fontSize
  rotation?: Rotation;
  bold?: boolean;
  underline?: boolean;
  reverse?: boolean;
  align?: Alignment;
  maxWidth?: number;
  lineSpacing?: number;
}
```

Bỏ hẳn `font`, `size`, `xScale`, `yScale`. Không thay thế bằng field nào khác.

### 2. `LayoutEngine.ts`

Xoá hàm `toMagnification()` và hằng số `DOTS_PER_MAGNIFICATION_STEP`. Dòng build `text` element trong `arrange()`:

```ts
// Trước:
options: { x, y, size: toMagnification(node.style?.fontSize), align, bold }
// Sau:
options: { x, y, fontSize: node.style?.fontSize, align, bold }
```

`LayoutEngine` không còn import/biết gì liên quan tới magnification hay font code của bất kỳ ngôn ngữ nào.

### 3. `{Lang}FontMetrics.ts` — 1 file mới mỗi ngôn ngữ

Vị trí: `language/{lang}/{Lang}FontMetrics.ts`. Đây là nguồn dữ liệu font **duy nhất** của ngôn ngữ đó — thay thế các bảng `TSC_FONTS`/`ZPL_FONTS`/... hiện đang định nghĩa trùng lặp trong từng `{Lang}PreviewRenderer.ts`.

**Không ép 1 interface chung cho cả 9 file** — mỗi file tự định nghĩa shape khớp đúng lệnh TEXT native của chính ngôn ngữ đó, vì đơn vị native khác nhau theo nhóm:

- **Nhóm bitmap cố định** (TSPL, EPL, CPCL, DPL, IPL, SBPL):
  ```ts
  export function fontSizeToNative(fontSizeDots: number): { font: string; magnification: number };
  export function nativeToFontSize(font: string, magnification: number): number;
  ```
- **Nhóm scalable** (ZPL — font "0" nhận dots thật trực tiếp qua `^A0N,h,w`):
  ```ts
  export function fontSizeToNative(fontSizeDots: number): { font: string; heightDots: number; widthDots: number };
  export function nativeToFontSize(font: string, heightDots: number): number;
  ```
- **Nhóm đóng gói byte** (ESC/POS, Star PRNT — không có khái niệm chọn font code riêng):
  ```ts
  export function fontSizeToMagnification(fontSizeDots: number): number;
  export function magnificationToFontSize(magnification: number): number;
  ```

Người dùng module này:
- `{Lang}Compiler.ts` gọi `fontSizeToNative()`/`fontSizeToMagnification()` khi emit lệnh TEXT (thay cho đọc trực tiếp `options.font`/`options.size` như hiện tại).
- `{Lang}Parser.ts` gọi `nativeToFontSize()`/`magnificationToFontSize()` khi dựng lại `PrintElement` từ bytes thật — best-effort, **không cam kết khôi phục đúng font code gốc** (cùng tinh thần best-effort các Parser khác trong package đã áp dụng, VD DPL/IPL).
- `{Lang}PreviewRenderer.ts` import bảng font/hàm quy đổi thẳng từ đây thay vì tự định nghĩa bảng riêng — xoá duplicate, xoá luôn lệch số ZPL 18-vs-30 đã phát hiện.

Bảng font gốc (con số dots) giữ nguyên giá trị đã có trong từng PreviewRenderer hiện tại — coi là nguồn đáng tin cậy nhất hiện có (đã dùng ổn định qua nhiều lần refactor trong session này), không đối chiếu lại tài liệu hãng ở phạm vi spec này.

### 4. `PrintCompiler` (`core/PrintCompiler.ts`)

```ts
export interface CompileResult<TOutput> {
  readonly output: TOutput;
  readonly warnings: readonly string[];
}

export interface PrintCompiler<TOutput = string | Uint8Array> {
  compile(document: ResolvedPrintDocument, encoding?: TextEncodingOptions): CompileResult<TOutput>;
}
```

Mỗi trong 9 `{Lang}Compiler.compile()` tích luỹ `warnings: string[]` xuyên suốt quá trình biên dịch, push 1 dòng mỗi khi:

- **Field bị bỏ/gộp dù element được hỗ trợ** — áp dụng cho toàn bộ case đã xác nhận ở bảng trên (`CutOptions.rows`/`mode`, `BarcodeConfig.readable`, `QrCodeConfig.rotation`).
- **Cả element type không được hỗ trợ ở ngôn ngữ này** — áp dụng cho `Circle`/`Ellipse`/`Reverse`/`Erase`/`Barcode`/`QrCode`/`Cut` ở các ngôn ngữ không có lệnh tương ứng (bảng trên). **Không đổi việc no-op** — chỉ thêm 1 dòng warning song song với việc trả về `''`/bỏ qua như hiện tại.

Nội dung warning: ngắn gọn, tiếng Việt, nêu rõ field/element nào và lý do (VD: `"CutOptions.rows bị bỏ qua — ZPL chỉ hỗ trợ cắt sau mỗi label, không hỗ trợ cắt mỗi N label."`).

### 5. `LanguageDispatch.compileTo()`

Đổi chữ ký trả về theo `PrintCompiler` mới:

```ts
export function compileTo(
  language: PrinterLanguage,
  document: ResolvedPrintDocument,
  profile?: PrinterProfile,
): CompileResult<string | Uint8Array> {
  return lookup(language, 'compiler').compiler.compile(document, profile?.features);
}
```

### Không đổi

- `PrintParser` — giữ nguyên contract (`{ commands, warnings }` đã có sẵn), chỉ đổi cách nó build `fontSize` (dùng `nativeToFontSize()` từ `{Lang}FontMetrics.ts` thay vì gán thẳng `size`/`font` đọc được).
- `Template`/`TemplateNode`/`DocumentResolver`/`TextStyle` — không đổi, đã đúng common.
- `PrintPreview`/`{Lang}PreviewRenderer` contract — không thêm `warnings`, chỉ đổi nguồn bảng font (mục 3).
- Hành vi no-op của mọi element/field đã liệt kê — giữ y nguyên, chỉ thêm warning.

## Consumer cần cập nhật

- `packages/printer-core/src/__tests__/phase2-integration.test.ts` — dùng `LabelBuilder().text('...', { x, y, size: 2 })`, đổi `size`→`fontSize`; cập nhật assertion theo `CompileResult` mới (`result.output` thay vì gọi `.compile()` lấy thẳng chuỗi).
- `packages/printer-core/src/document/builder/markup/MarkupBuilder.ts` — hiện parse attribute `font`/`size` từ cú pháp markup vào `TextOptions`; đổi sang chỉ parse `fontSize` (bỏ `font`). Module này đã được xác định trước đó là gần như không có consumer thật ngoài test của chính nó — cập nhật tối thiểu để không vỡ build, không đầu tư thêm.
- Không có consumer thật nào khác gọi `compileTo()`/`.compile()` trực tiếp trong `printer-preview` (chỉ dùng `previewFor()`) — không cần cập nhật package đó cho phần `CompileResult`.

## Testing

- Mỗi `{Lang}FontMetrics.ts`: unit test round-trip `fontSizeToNative → nativeToFontSize` (hoặc chiều tương ứng) cho vài giá trị `fontSizeDots` tiêu biểu.
- Mỗi `{Lang}Compiler.test.ts`: cập nhật test hiện có theo `TextOptions.fontSize` mới; thêm test cho từng warning đã liệt kê (VD: compile 1 document có `cut: { rows: 3 }` ra ZPL, assert `warnings` chứa đúng 1 dòng nhắc `rows`).
- Mỗi `{Lang}Parser.test.ts`: cập nhật assertion `options.font`/`options.size` cũ → `options.fontSize`.
- `phase2-integration.test.ts`: cập nhật theo `CompileResult`, giữ nguyên tinh thần test end-to-end hiện tại.
- Toàn bộ 540 test hiện có của `printer-core` phải tiếp tục pass sau khi cập nhật (không giảm coverage).

## Rủi ro & đánh đổi

- **Breaking API**: đổi shape `TextOptions` và `PrintCompiler.compile()` return type. `printer-core` hiện chưa có consumer thật ngoài `printer-preview` (chỉ dùng `previewFor()`, không dùng `compileTo()`) — rủi ro thực tế thấp, nhưng đây vẫn là thay đổi phá vỡ tương thích ngược nếu package từng được publish/dùng ở nơi khác.
- **Mất khả năng chọn font code cụ thể qua semantic field**: tác giả template không còn cách nào ép dùng đúng 1 font code (VD ép ZPL dùng font `'A'` thay vì `'0'` mặc định) qua `TextOptions` nữa — chỉ còn cách dùng `RawElement` (chấp nhận được, theo đã thống nhất, vì đây không phải nhu cầu phổ biến và `RawElement` vốn đã tồn tại cho đúng use-case "cần chính xác tuyệt đối, chấp nhận rời layout pipeline").
- **Không cam kết round-trip font code**: Parser đọc ngược 1 document rồi compile lại có thể ra font code khác với bản gốc (nếu bản gốc dùng font không phải `DEFAULT_FONT`) — chấp nhận được vì đây là hệ quả trực tiếp của quyết định bỏ `font`, đã được duyệt.
- **Phạm vi lớn**: đụng tới 1 type công khai (`TextElement.ts`), 1 contract công khai (`PrintCompiler.ts`), `LayoutEngine.ts`, `LanguageDispatch.ts`, và toàn bộ 9 bộ ba Compiler/Parser/PreviewRenderer (27 file sửa + 9 file mới) — nên triển khai theo plan chia nhỏ từng ngôn ngữ, review độc lập từng phần, giống cách đã làm thành công ở các đợt refactor `language/` trước đó trong dự án này.
