# printer-core

Core thuần TypeScript cho feature máy in của NDTCorePOS: mô hình document/label,
compiler + parser + validator + preview cho các ngôn ngữ máy in, mã hoá
barcode/QR/ảnh (dithering), receipt layout, printer profile theo hãng.

Mục tiêu dài hạn là mirror đầy đủ chức năng của
[portakal](https://github.com/productdevbook/portakal) (SDK ngôn ngữ máy in mã
nguồn mở, zero-dependency) — không trim bớt ngôn ngữ, để giữ khả năng mở rộng
sang các giao thức máy in khác ngoài ESC/POS + TSPL mà app đang dùng hôm nay.

> **Trạng thái hiện tại: đầy đủ, package đã hoàn chỉnh.** Cả 9 ngôn ngữ máy in,
> `convert/`, và toàn bộ profile theo hãng đều đã có logic thật — không còn
> file placeholder (`export {}`) nào. Cụ thể:
>
> **Đã có logic thật:**
> - Nền tảng: types, document model, core dispatch (`PrintCompiler`/`Parser`/
>   `Preview`/`Validation` theo ngôn ngữ)
> - Encoding: code page (Cp437/858/866/857, Windows1252/1258) + tiếng Việt
>   (TCVN3, CP1258)
> - `image/`: dithering ảnh (threshold, Floyd-Steinberg, Atkinson, ordered)
> - `symbology/barcode/`, `symbology/qrcode/`: lớp mô tả + validate (chưa render ảnh module thật)
> - `receipt/`: layout công thức in hoá đơn (pair/table/separator, word wrap)
> - `profile/`: đầy đủ — cả 9 file hãng (Generic, Epson, TSC, Bixolon, Citizen,
>   Honeywell, Sato, Star, Zebra) đều có dữ liệu thật
> - `document/builder/`: fluent builder API (PrintBuilder/LabelBuilder/ReceiptBuilder)
>   và `document/builder/markup/`: markup DSL kiểu HTML (`<label>...</label>`)
> - **Cả 9 ngôn ngữ máy in** (TSC/TSPL, ESC/POS, ZPL, EPL, CPCL, DPL, SBPL,
>   Star PRNT, IPL): đầy đủ pipeline compile → parse → validate → preview (SVG)
> - `convert/`: cross-compiler giữa các ngôn ngữ (parse ngôn ngữ A → dựng lại
>   `PrintElement[]` → compile sang ngôn ngữ B)
> - `transport/` — **chỉ định nghĩa interface theo đúng thiết kế**, I/O thật
>   (USB/BT/LAN) vẫn thuộc về app, không phải nợ kỹ thuật
> - `testing/` (MockPrinterTransport, PrintDataAssertion, HexDump...)
>
> Có bài test tích hợp end-to-end thật chứng minh cả 9 ngôn ngữ hoạt động đúng:
> `src/__tests__/phase2-integration.test.ts` — dựng một document thật (text +
> barcode + table + cut), compile/parse/validate/preview lần lượt qua tất cả
> 9 `PrinterLanguage` bằng `core/LanguageDispatch.ts`, cộng thêm 2 test chi
> tiết riêng cho ESC/POS và TSC kế thừa từ Phase 1.
>
> **Chưa có consumer nào dùng package này** — app hiện vẫn giữ logic in ấn
> trùng lặp của riêng nó. Việc chuyển app sang dùng `printer-core` thay vì
> logic riêng là việc khác, để sau.
>
> **Giới hạn đã biết (không thuộc phạm vi port này):**
> - Chuỗi string trong `TsplCompiler.compile().output` trộn lẫn hai kiểu encoding
>   byte khác nhau (text UTF-8 và payload bitmap dạng latin-1 one-char-per-byte)
>   khi document có element ảnh — xem JSDoc trên `TsplCompiler.compile()`
>   (`src/language/tspl/TsplCompiler.ts`) để biết chi tiết trước khi dùng output
>   TSPL compile ra để gửi máy in thật.
> - `Tcvn3Encoder` chỉ phủ một phần bảng mã TCVN3 (partial coverage) — xem
>   JSDoc trên `Tcvn3Encoder` (`src/encoding/encoders/Tcvn3Encoder.ts`) để biết
>   phạm vi ký tự đã hỗ trợ.

## Ranh giới với `src/features/printer`

- **`printer-core`** — tính toán thuần, đồng bộ, không phụ thuộc React Native:
  dựng document/label, biên dịch ra lệnh máy in, parse ngược, validate, preview
  SVG, mã hoá bitmap/barcode/QR, printer profile. Không biết gì về USB/Bluetooth/
  LAN thật, AsyncStorage, hay React — `transport/` ở đây chỉ là interface mô tả.
- **`src/features/printer`** (giữ nguyên) — mọi thứ cần I/O hoặc API của React
  Native: transport thật (USB/BT/LAN), adapter (native/library/vendor), kết nối,
  discovery, permission, storage, hook, component UI, orchestration
  (PrintScheduler/PrintService).

## Cấu trúc

```text
src/
├── index.ts
│
├── types/                     # KHÔNG đổi — primitive/value types thực sự generic
│   ├── Alignment.ts, Bitmap.ts, Direction.ts, FontStyle.ts, FontWeight.ts,
│   │   Point.ts, Rect.ts, Rotation.ts, Size.ts, Unit.ts, index.ts
│
├── catalog/                   # Cầu nối template ↔ data: biến có tên theo loại nội dung
│   ├── VariableType.ts, VariableSpec.ts, CatalogCollection.ts, CatalogDescription.ts,
│   │   Catalog.ts, BuiltInVariable.ts, CatalogRegistry.ts, describeCatalog.ts,
│   │   defineCatalog.ts, CatalogIndex.ts, index.ts
│
├── template/                  # TemplateDocument JSON thuần, độc lập DPI
│   ├── TemplateDocument.ts, index.ts
│   ├── style/                  # Length.ts, Dimension.ts, Insets.ts, BoxStyle.ts,
│   │                           # LayoutStyle.ts, TextStyle.ts
│   ├── content/                # Segment.ts, ValueFormat.ts, Condition.ts
│   ├── nodes/                  # TemplateNode.ts, TemplateNodeBase.ts, ContainerNode.ts,
│   │                           # TextNode.ts, ImageNode.ts, BarcodeNode.ts,
│   │                           # QrCodeNode.ts, LineNode.ts, RepeatNode.ts
│   ├── format/                 # formatter vi-VN tự cài đặt (không dùng Intl)
│   ├── parse/                  # parseTemplate, migrateTemplate, validate cấu trúc,
│   │                           # validateTemplateAgainstCatalog
│   └── builder/                # DSL: labelTemplate/receiptTemplate(catalog), scope.var/repeat
│
├── resolution/                 # Ghép template + data qua catalog, stack scope tường minh
│   ├── DocumentResolver.ts, ResolveContext.ts, readVariable.ts, resolveContent.ts,
│   │   evaluateCondition.ts, readRepeatEntries.ts, resolveNode.ts, countPages.ts,
│   │   collectAssetIds.ts, AssetProvider.ts, ResolvedNode.ts, ResolvedPage.ts,
│   │   ResolveError.ts, index.ts
│
├── layout/                     # Đổi Length → dots theo DPI rồi xếp vị trí
│   ├── LayoutConfig.ts, lengthToDots.ts, LayoutNode.ts, toLayoutNode.ts,
│   │   LayoutEngine.ts, FontMetrics.ts, ApproximateFontMetrics.ts,
│   │   TextMeasurement.ts, TypographyProfile.ts, index.ts
│
├── document/
│   ├── PrintDocument.ts, PrintDocumentOptions.ts, ResolvedPrintDocument.ts,
│   │   PrintElementType.ts, index.ts    # KHÔNG đổi vị trí (đã ở document/)
│   │
│   └── elements/                # MỚI — gộp builder/PrintElement.ts +
│       │                        # builder/content|drawing|layout|printer/*
│       ├── PrintElement.ts      # từ builder/PrintElement.ts (union type)
│       ├── content/             # từ builder/content/
│       │   ├── BarcodeElement.ts, ImageElement.ts, QrCodeElement.ts,
│       │   │   RawElement.ts, TextElement.ts, index.ts
│       ├── drawing/              # từ builder/drawing/ — KHÔNG chia nhỏ thêm
│       │   │                     # thành shape/line/effect (xem "Quyết định
│       │   │                     # KHÔNG áp dụng" bên dưới)
│       │   ├── BoxElement.ts, CircleElement.ts, DiagonalElement.ts,
│       │   │   EllipseElement.ts, EraseElement.ts, LineElement.ts,
│       │   │   ReverseElement.ts, index.ts
│       ├── layout/                # từ builder/layout/
│       │   ├── ColumnElement.ts, PageBreakElement.ts, RowElement.ts,
│       │   │   SpacerElement.ts, TableElement.ts, index.ts
│       └── control/                # từ builder/printer/ (đổi tên `printer`→`control`,
│           │                        # khớp đúng ý nghĩa: CutElement là lệnh điều
│           │                        # khiển máy in, không phải nội dung in)
│           ├── CutElement.ts, index.ts
│
├── symbology/                    # MỚI — gộp barcode/ + qrcode/ (root cũ)
│   ├── barcode/
│   │   ├── BarcodeConfig.ts, BarcodeType.ts, BarcodeValidator.ts, index.ts
│   └── qrcode/
│       ├── QrCodeConfig.ts, QrCodeErrorCorrection.ts, QrCodeModel.ts,
│       │   QrCodeValidator.ts, index.ts
│
├── formatting/                    # MỚI — phần dùng chung, generic của receipt/ cũ
│   ├── TableColumn.ts             # rename từ receipt/ReceiptColumn.ts
│   ├── PairFormatter.ts           # KHÔNG đổi tên, chỉ đổi vị trí
│   ├── TableFormatter.ts          # KHÔNG đổi tên, chỉ đổi vị trí
│   ├── SeparatorFormatter.ts      # KHÔNG đổi tên, chỉ đổi vị trí
│   ├── WordWrapper.ts             # KHÔNG đổi tên, chỉ đổi vị trí
│   ├── RowFormatter.ts            # rename từ receipt/ReceiptFormatter.ts
│   ├── validateTableColumns.ts    # KHÔNG đổi tên, chỉ đổi vị trí
│   └── index.ts
│
├── receipt/                        # THU GỌN — chỉ còn phần thật sự receipt-specific
│   ├── ReceiptLayout.ts            # cập nhật import TableColumn thay ReceiptColumn
│   └── index.ts
│
├── image/                          # KHÔNG đổi
│   ├── ImageCrop.ts, ImageDither.ts, ImageResize.ts, ImageSource.ts,
│   │   ImageThreshold.ts, ImageTransform.ts, MonochromeBitmap.ts,
│   │   RgbaImage.ts, index.ts
│   └── dithering/
│       ├── AtkinsonDither.ts, DitherAlgorithm.ts, FloydSteinbergDither.ts,
│       │   OrderedDither.ts, ThresholdDither.ts, index.ts
│
├── encoding/                       # KHÔNG đổi
│   ├── CodePage.ts, CodePageEncoder.ts, EncodingResult.ts, index.ts
│   └── encoders/
│       ├── Cp437Encoder.ts, Cp857Encoder.ts, Cp858Encoder.ts,
│       │   Cp866Encoder.ts, Tcvn3Encoder.ts, Utf8Encoder.ts,
│       │   Windows1252Encoder.ts, Windows1258Encoder.ts, index.ts
│
├── core/                           # THU GỌN — chỉ còn contract, KHÔNG implementation
│   ├── LanguageDispatch.ts, LanguageRegistry.ts, PrinterLanguage.ts,
│   │   PrinterLanguageDefinition.ts, PrinterCoreError.ts,
│   │   PrintCompiler.ts, PrintParser.ts, PrintPreview.ts, PrintValidation.ts,
│   │   index.ts                     # KHÔNG đổi tên file nào, chỉ giữ nguyên vị trí
│
├── language/                        # MỚI — gộp compiler/{lang} + parser/{lang}
│   │                                 # (KHÔNG gồm validation, KHÔNG gồm preview)
│   ├── CompileWarnings.ts            # gom cảnh báo của 1 lần compile (field bỏ/gộp, element không hỗ trợ)
│   ├── BitmapFont.ts                 # chọn font bitmap + hệ số phóng đại (TSPL, EPL, CPCL)
│   ├── MagnifiedFont.ts              # 1 font phóng đại nguyên (DPL, SBPL, ESC/POS, Star PRNT)
│   ├── tspl/      (đổi tên từ `tsc` — TSC chỉ còn dùng cho tên hãng)
│   │   ├── TsplCommand.ts, TsplCompiler.ts, TsplEncoder.ts, TsplFontMetrics.ts, TsplParser.ts, index.ts
│   ├── zpl/       ├── ZplCommand.ts, ZplCompiler.ts, ZplEncoder.ts, ZplFontMetrics.ts, ZplParser.ts, index.ts
│   ├── epl/       ├── EplCommand.ts, EplCompiler.ts, EplEncoder.ts, EplFontMetrics.ts, EplParser.ts, index.ts
│   ├── cpcl/      ├── CpclCommand.ts, CpclCompiler.ts, CpclEncoder.ts, CpclFontMetrics.ts, CpclParser.ts,
│   │              │   index.ts
│   ├── dpl/       ├── DplCommand.ts, DplCompiler.ts, DplEncoder.ts, DplFontMetrics.ts, DplParser.ts, index.ts
│   ├── ipl/       ├── IplCommand.ts, IplCompiler.ts, IplEncoder.ts, IplFontMetrics.ts, IplParser.ts, index.ts
│   ├── sbpl/      ├── SbplCommand.ts, SbplCompiler.ts, SbplEncoder.ts, SbplFontMetrics.ts, SbplParser.ts,
│   │              │   index.ts
│   ├── escpos/    ├── EscPosCommand.ts, EscPosCompiler.ts, EscPosCodePage.ts,
│   │              │   EscPosBarcodeEncoder.ts, EscPosImageEncoder.ts, EscPosFontMetrics.ts,
│   │              │   EscPosQrCodeEncoder.ts, EscPosParser.ts, index.ts
│   └── starprnt/  └── StarPrntCommand.ts, StarPrntCompiler.ts, StarPrntEncoder.ts,
│                      StarPrntFontMetrics.ts, StarPrntParser.ts, index.ts
│
├── preview/                          # THU GỌN + thêm per-language subfolder
│   ├── PreviewRenderer.ts            # implementation dùng chung cho Dpl/Sbpl/Ipl — chiều cao
│   │                                 # chữ do FontMetrics của ngôn ngữ gọi truyền vào
│   ├── index.ts
│   └── languages/
│       ├── tspl/TsplPreviewRenderer.ts     (MỚI — thêm 1 cấp thư mục theo lang)
│       ├── zpl/ZplPreviewRenderer.ts
│       ├── epl/EplPreviewRenderer.ts
│       ├── cpcl/CpclPreviewRenderer.ts
│       ├── dpl/DplPreviewRenderer.ts
│       ├── ipl/IplPreviewRenderer.ts
│       ├── sbpl/SbplPreviewRenderer.ts
│       ├── escpos/EscPosPreviewRenderer.ts
│       └── starprnt/StarPrntPreviewRenderer.ts
│       (mỗi thư mục có index.ts riêng — MỚI)
│
├── validation/                        # THU GỌN + languages/{lang}/ giữ nguyên
│   │                                  # cấu trúc hiện có (đã đúng theo pattern mới)
│   ├── ValidationIssue.ts, ValidationResult.ts, index.ts
│   └── languages/                     # đổi tên từ validation/{lang}/ trực tiếp
│       │                              # → validation/languages/{lang}/ (thêm 1 cấp
│       │                              #   `languages/`, khớp preview/languages/)
│       ├── tspl/TsplValidator.ts, index.ts
│       ├── zpl/ZplValidator.ts, index.ts
│       ├── epl/EplValidator.ts, index.ts
│       ├── cpcl/CpclValidator.ts, index.ts
│       ├── dpl/DplValidator.ts, index.ts
│       ├── ipl/IplValidator.ts, index.ts
│       ├── sbpl/SbplValidator.ts, index.ts
│       ├── escpos/EscPosValidator.ts, index.ts
│       └── starprnt/StarPrntValidator.ts, index.ts
│
├── convert/                            # KHÔNG đổi tên (giữ nguyên `convert`,
│   │                                   # không đổi thành `conversion`)
│   ├── ConversionPath.ts, ConversionRegistry.ts, ConversionResult.ts,
│   │   PrinterConverter.ts, index.ts
│
├── profile/                            # KHÔNG đổi
│   ├── PrinterProfile.ts, PrinterProfileResolver.ts, PrinterVendor.ts, index.ts
│   └── profiles/
│       ├── BixolonProfiles.ts, CitizenProfiles.ts, EpsonProfiles.ts,
│       │   GenericProfile.ts, HoneywellProfiles.ts, SatoProfiles.ts,
│       │   StarProfiles.ts, TscProfiles.ts, ZebraProfiles.ts, index.ts
│
├── transport/                          # KHÔNG đổi
│   ├── BluetoothTransport.ts, NetworkTransport.ts, PrinterTransport.ts,
│   │   UsbTransport.ts, index.ts
│
├── testing/
│   ├── HexDump.ts, MockPrinterTransport.ts, OrderTestCatalog.ts, PrintDataAssertion.ts, index.ts
│
└── __tests__/                            # integration test ở root
    ├── template-pipeline-integration.test.ts, phase2-integration.test.ts
```

## Cỡ chữ và cảnh báo compile

- `TextOptions.fontSize` (dots) là field cỡ chữ duy nhất của `PrintElement` text. Mỗi ngôn ngữ tự quy đổi
  sang lệnh native qua `language/{lang}/{Lang}FontMetrics.ts` — đây là nguồn dữ liệu font duy nhất, dùng
  chung cho compiler, parser (dựng lại `fontSize` best-effort) và preview.
- `PrintCompiler.compile()` và `compileTo()` trả `{ output, warnings }`. `warnings` liệt kê field bị bỏ
  qua/gộp và element ngôn ngữ không có lệnh tương ứng; `output` giữ nguyên hành vi cũ (element không hỗ
  trợ vẫn không phát lệnh nào). Cảnh báo trùng nội dung chỉ xuất hiện 1 lần; `cut` với `mode: 'off'`
  không cảnh báo vì không yêu cầu cắt.
- Với các compiler chỉ phát output dạng chuỗi (TSPL, ZPL, EPL, CPCL, DPL, SBPL, IPL), element `raw` mang
  nội dung `Uint8Array` bị bỏ qua (output vẫn là `''` như trước) kèm cảnh báo — ESC/POS và Star PRNT phát
  output dạng byte nên không bị giới hạn này.

| Ngôn ngữ | Element bị bỏ qua (có cảnh báo) | Field bị bỏ/gộp (có cảnh báo) |
|---|---|---|
| TSPL | — | `CutOptions.mode: 'partial'` in như `'full'` |
| EPL | diagonal, circle, ellipse, reverse, erase, cut | — |
| CPCL | circle, ellipse, reverse, erase, cut | `BarcodeConfig.readable` |
| ZPL | ellipse, reverse, erase | `CutOptions.rows`, `QrCodeConfig.rotation` |
| DPL, SBPL, IPL | diagonal, circle, ellipse, reverse, erase, cut, barcode, qrcode | — |
| ESC/POS | box, line, diagonal, circle, ellipse, reverse, erase | — |
| Star PRNT | box, line, diagonal, circle, ellipse, reverse, erase, barcode, qrcode | `CutOptions.rows`, `CutOptions.mode: 'partial'` |

## Scripts

```bash
npm run type-check -w printer-core   # tsc --noEmit
```

## Quy ước

Theo quy ước chung của repo (xem `../../CLAUDE.md`, `../../docs/CODING_STANDARDS_TS.md`):
TypeScript strict, không dùng `any`, comment chỉ khi WHY không rõ, không import
theo alias — dùng relative path.
