# printer-core

Core thuần TypeScript cho feature máy in của NDTCorePOS, không dependency, không phụ thuộc React Native.

Package hỗ trợ 2 ngôn ngữ máy in mà app dùng: **TSPL** (máy in tem) và **ESC/POS** (máy in hoá đơn). Luồng chính:

```text
TemplateDocument (JSON, DSL) ──parseTemplate──▶ resolve (catalog + data) ──▶ layout (dots)
  ──▶ PrintElement[] ──compileTo──▶ lệnh TSPL / ESC/POS  { output, warnings }
                     └─previewFor─▶ SVG xem trước
```

- **Template:** `TemplateDocument` là JSON thuần, độc lập DPI; DSL `labelTemplate`/`receiptTemplate` sinh ra nó.
- **Dữ liệu:** biến đọc qua catalog (`defineCatalog`), không trỏ thẳng vào data.
- **Compile:** mỗi ngôn ngữ có compiler, parser (đọc ngược lệnh), validator, preview SVG. Năng lực máy in đích
  truyền vào qua `PrinterFeatures`.
- **Chuyển đổi:** `convert()` chuyển lệnh giữa TSPL và ESC/POS.
- **Phụ trợ:** mã hoá chữ theo code page (CP437/857/858/866, Windows-1252), xử lý ảnh (dithering) và mô tả
  barcode/QR.

**Giới hạn đã biết:** khi document có ảnh, chuỗi trong `TsplCompiler.compile().output` trộn text UTF-8 với payload
bitmap dạng 1 ký tự = 1 byte. Xem JSDoc của `TsplCompiler.compile()` trước khi gửi output này tới máy in thật.
CP1258 (tiếng Việt) có encoder nhưng chưa nằm trong danh sách code page được dò, nên với máy ESC/POS không bật
`nativeUtf8`, chữ tiếng Việt có dấu bị in thành `?`.

## Ranh giới với `src/features/printer`

- **`printer-core`:** tính toán thuần, đồng bộ.
  - Dựng template, resolve, layout, biên dịch ra lệnh máy in, parse ngược, validate.
  - Preview SVG, mã hoá bitmap/barcode/QR.
  - Không biết gì về USB/Bluetooth/LAN, AsyncStorage hay React; chỉ nhận năng lực máy in đích qua
    `PrinterFeatures`.
- **`src/features/printer`** (app): mọi thứ cần I/O hoặc API của React Native.
  - Transport (USB/BT/LAN), adapter (native/library/vendor).
  - Dữ liệu máy in theo hãng/model (map sang `PrinterFeatures`).
  - Kết nối, discovery, permission, storage, hook, component UI.
  - Orchestration (PrintScheduler/PrintService).

## Cấu trúc

```text
src/
├── index.ts
├── types/          # Alignment, Bitmap, Direction, Point, Rect, Rotation, Size, Unit
├── catalog/        # biến có tên theo loại nội dung: defineCatalog, defineCollection, CatalogIndex, biến có sẵn
├── template/       # TemplateDocument JSON độc lập DPI
│   ├── style/      # Length, Dimension, Insets, BoxStyle, LayoutStyle, TextStyle
│   ├── content/    # Segment, ValueFormat, Condition
│   ├── nodes/      # TemplateNode và các node container/text/image/barcode/qrcode/line/repeat
│   ├── format/     # formatter vi-VN tự cài đặt (không dùng Intl)
│   ├── parse/      # parseTemplate, validate cấu trúc/tách tem/theo catalog
│   └── builder/    # DSL labelTemplate/receiptTemplate(catalog), scope.var/repeat
├── resolution/     # ghép template + data qua catalog, kế hoạch trang (planPages), tách repeat lồng
├── layout/         # đổi Length → dots theo DPI rồi xếp vị trí, sinh PrintElement[]
├── document/       # ResolvedPrintDocument + PrintElement (content/drawing/layout/control)
├── core/           # contract: PrinterLanguage, PrintCompiler/Parser/Preview/Validation, CompileResult,
│                   # PrintParseResult, PrinterFeatures, UnsupportedLanguageError
├── language/       # BitmapFont (TSPL), MagnifiedFont (ESC/POS), CompileWarnings
│   ├── tspl/       # TsplCommand, TsplCompiler, TsplEncoder, TsplFontMetrics, TsplParser
│   └── escpos/     # EscPosCommand, EscPosCompiler, EscPosCodePage, EscPos{Barcode,Image,QrCode}Encoder,
│                   # EscPosFontMetrics, EscPosParser
├── preview/languages/{tspl,escpos}/      # preview SVG theo từng ngôn ngữ
├── validation/     # ValidationIssue, ValidationResult + languages/{tspl,escpos}/ validator
├── registry/       # LANGUAGE_REGISTRY, SUPPORTED_LANGUAGES, compileTo/parseFrom/validateFor/previewFor
├── convert/        # convert() giữa TSPL và ESC/POS qua parseFrom + compileTo
├── formatting/     # TableColumn, formatTable/formatRow, validateTableColumns (bảng trong element table)
├── encoding/       # CodePage, encodeTextForPrinter + encoders/ (CP437/857/858/866, Windows-1252/1258, UTF-8),
│                   # binaryStringToBytes/bytesToBinaryString (chuỗi 1 ký tự = 1 byte)
├── image/          # crop/resize/threshold/dither ảnh thành bitmap đơn sắc + dithering/
├── symbology/      # barcode/ và qrcode/: cấu hình + validate
└── testing/        # OrderTestCatalog — catalog đơn hàng + data mẫu dùng chung cho test (không export ra ngoài)
```

Test đặt trong `__tests__/` cạnh file nguồn; test tích hợp ở `src/__tests__/`.

## Phân trang tem

- `repeat` ngoài cùng có `maxItemsPerPage` chia phần tử (sau `expand`) thành từng trang/tem.
- `repeat` lồng ngay bên trong nó cũng có thể khai báo `maxItemsPerPage` (VD topping mỗi tem tối đa 4):
  - Phần dư in sang tem tiếp theo; tem tiếp in lại toàn bộ nội dung của phần tử.
  - Điều kiện: repeat ngoài cùng có `maxItemsPerPage` là 1, chỉ lồng 1 tầng, và chỉ 1 repeat ngoài cùng được chứa
    repeat lồng tách tem. `parseTemplate` báo lỗi nếu vi phạm.
- Biến có sẵn `$part`/`$partCount` (dùng ở mọi chỗ) cho biết tem thứ mấy trong phần tử; là 1/1 khi không tách tem.
  VD chỉ in giá ở tem đầu: `visibleWhen(eq('$part', 1))`.

## Cỡ chữ và cảnh báo compile

- **Cỡ chữ:** `TextOptions.fontSize` (dots) là field cỡ chữ duy nhất của `PrintElement` text.
  - Mỗi ngôn ngữ quy đổi sang lệnh native qua `language/{lang}/{Lang}FontMetrics.ts`.
  - Đây là nguồn dữ liệu font duy nhất, dùng chung cho compiler, parser (dựng lại `fontSize` best-effort) và
    preview.
- **Kết quả compile:** `PrintCompiler.compile()` và `compileTo()` trả `{ output, warnings }`.
  - `warnings` liệt kê field bị bỏ qua/gộp và element ngôn ngữ không có lệnh tương ứng.
  - `output` không phát lệnh nào cho element không hỗ trợ.
  - Cảnh báo trùng nội dung chỉ xuất hiện 1 lần.
  - `cut` với `mode: 'off'` không cảnh báo vì không yêu cầu cắt.
- **Element `raw` với TSPL:** TSPL phát output dạng chuỗi, nên `raw` mang nội dung `Uint8Array` bị bỏ qua kèm
  cảnh báo. ESC/POS phát output dạng byte nên không có giới hạn này.

| Ngôn ngữ | Element bị bỏ qua (có cảnh báo) | Field bị bỏ/gộp (có cảnh báo) |
|---|---|---|
| TSPL | — | `CutOptions.mode: 'partial'` in như `'full'` |
| ESC/POS | box, line, diagonal, circle, ellipse, reverse, erase | — |

## Scripts

```bash
npm run type-check -w printer-core   # tsc --noEmit
```

## Quy ước

Theo quy ước chung của repo (xem `../../CLAUDE.md`, `../../docs/CODING_STANDARDS_TS.md`):
TypeScript strict, không dùng `any`, comment chỉ khi WHY không rõ, không import
theo alias — dùng relative path.
