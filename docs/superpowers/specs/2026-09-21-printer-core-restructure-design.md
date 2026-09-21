# printer-core — Tái cấu trúc thư mục — Design Spec

## Mục tiêu

Tổ chức lại toàn bộ `packages/printer-core/src/` theo trách nhiệm (responsibility)
rõ ràng hơn, sửa các bất nhất hiện tại (ví dụ `barcode/qrcode` ở root trùng tên
với `builder/content/*Element.ts`, `receipt/` trộn lẫn formatter dùng chung với
model receipt riêng, 4 cây song song `compiler/parser/validation/preview` rải
rác theo ngôn ngữ), và xoá dead code (11 file placeholder `export {}` còn sót
từ giai đoạn port ban đầu — hiện `README.md` đang khẳng định sai là "không còn
file placeholder nào").

Đây thuần tuý là tái cấu trúc — không đổi hành vi runtime nào. Mọi file di
chuyển/đổi tên, import path cập nhật theo, nhưng logic bên trong giữ nguyên
(trừ 2 rename identifier: `ReceiptColumn`→`TableColumn`, xoá `ReceiptCell`
không dùng).

## Hai trục phân loại

Cấu trúc mới dựa trên 2 trục rõ ràng, không trộn lẫn:

1. **Theo giai đoạn pipeline** (mỗi giai đoạn transform dữ liệu 1 bước):
   `template/` → `resolution/` → `layout/` → `document/` → `language/` →
   `transport/`.
2. **Theo subsystem cross-cutting** (không thuộc riêng 1 giai đoạn pipeline
   nào, dùng knowledge của nhiều ngôn ngữ nhưng bản thân KHÔNG phải là 1 phần
   thực thi ngôn ngữ): `preview/`, `validation/`, `convert/`, `symbology/`,
   `formatting/`, `image/`, `encoding/`, `profile/`, `types/`.

Trong đó `core/` giữ vai trò đặc biệt: chỉ chứa **contract/interface**
(`PrintCompiler`, `PrintParser`, `PrintPreview`, `PrintValidation`) mà
`language/`, `preview/`, `validation/` implement — không chứa implementation
thật. `core/` đứng ở root, ngang hàng `language/`, KHÔNG nested bên trong.

`language/{lang}/` chỉ chứa phần **mô tả/biên dịch/parse chính bản thân
ngôn ngữ đó**: `Command`, `Compiler`, `Encoder`, `Parser`. Validator và
PreviewRenderer của từng ngôn ngữ ở lại trong subsystem của chúng
(`validation/languages/{lang}/`, `preview/languages/{lang}/`) — vì bản chất
chúng thuộc về subsystem validation/preview, chỉ *dùng* knowledge của ngôn
ngữ đó, không phải là *implementation cốt lõi* của ngôn ngữ.

## Cấu trúc đầy đủ (sau khi tái cấu trúc)

```text
src/
├── index.ts
│
├── types/                     # KHÔNG đổi — primitive/value types thực sự generic
│   ├── Alignment.ts, Bitmap.ts, Direction.ts, FontStyle.ts, FontWeight.ts,
│   │   Point.ts, Rect.ts, Rotation.ts, Size.ts, Unit.ts, index.ts
│
├── template/                  # KHÔNG đổi
│   ├── model/                 # (đổi tên từ không-có-tên-riêng — các TemplateNode)
│   │   ├── PrintTemplate.ts, PrintTemplateType.ts, TemplateNode.ts,
│   │   │   TemplateNodeBase.ts, ContainerNode.ts, TextNode.ts, ImageNode.ts,
│   │   │   BarcodeNode.ts, QrCodeNode.ts, LineNode.ts, RepeatNode.ts
│   ├── style/                 # KHÔNG đổi vị trí (đã tách sẵn)
│   │   ├── BoxStyle.ts, Dimension.ts, Insets.ts, LayoutStyle.ts, TextStyle.ts,
│   │   │   VisibilityCondition.ts
│   ├── builder/                # đổi tên từ `builders/` (số nhiều) → `builder/`
│   │   │                       # (số ít, khớp `document/builder/` mới)
│   │   ├── BarcodeBuilder.ts, BuildContext.ts, ContainerBuilder.ts,
│   │   │   ImageBuilder.ts, LabelTemplateBuilder.ts, LineBuilder.ts,
│   │   │   NodeBuilder.ts, QrCodeBuilder.ts, ReceiptTemplateBuilder.ts,
│   │   │   RepeatBuilder.ts, TextBuilder.ts, conditions.ts, dimensions.ts,
│   │   │   index.ts
│   └── index.ts
│
├── resolution/                 # KHÔNG đổi
│   ├── DocumentResolver.ts, PrintData.ts, ResolvedNode.ts, ResolvedPage.ts,
│   │   index.ts
│
├── layout/                     # KHÔNG đổi
│   ├── ApproximateFontMetrics.ts, FontMagnification.ts, FontMetrics.ts,
│   │   LayoutConfig.ts, LayoutEngine.ts, TextMeasurement.ts,
│   │   TypographyProfile.ts, index.ts
│
├── document/
│   ├── PrintDocument.ts, PrintDocumentOptions.ts, ResolvedPrintDocument.ts,
│   │   PrintElementType.ts, index.ts    # KHÔNG đổi vị trí (đã ở document/)
│   │
│   ├── elements/                # MỚI — gộp builder/PrintElement.ts +
│   │   │                        # builder/content|drawing|layout|printer/*
│   │   ├── PrintElement.ts      # từ builder/PrintElement.ts (union type)
│   │   ├── content/             # từ builder/content/
│   │   │   ├── BarcodeElement.ts, ImageElement.ts, QrCodeElement.ts,
│   │   │   │   RawElement.ts, TextElement.ts, index.ts
│   │   ├── drawing/              # từ builder/drawing/ — KHÔNG chia nhỏ thêm
│   │   │   │                     # thành shape/line/effect (xem "Quyết định
│   │   │   │                     # KHÔNG áp dụng" bên dưới)
│   │   │   ├── BoxElement.ts, CircleElement.ts, DiagonalElement.ts,
│   │   │   │   EllipseElement.ts, EraseElement.ts, LineElement.ts,
│   │   │   │   ReverseElement.ts, index.ts
│   │   ├── layout/                # từ builder/layout/
│   │   │   ├── ColumnElement.ts, PageBreakElement.ts, RowElement.ts,
│   │   │   │   SpacerElement.ts, TableElement.ts, index.ts
│   │   └── control/                # từ builder/printer/ (đổi tên `printer`→`control`,
│   │       │                        # khớp đúng ý nghĩa: CutElement là lệnh điều
│   │       │                        # khiển máy in, không phải nội dung in)
│   │       ├── CutElement.ts, index.ts
│   │
│   └── builder/                  # MỚI — gộp builder/{Print,Label,Receipt}Builder.ts
│       │                         # + markup/ (front-end khác tạo LabelBuilder)
│       ├── PrintBuilder.ts, LabelBuilder.ts, ReceiptBuilder.ts, index.ts
│       └── markup/                # từ markup/ (root cũ)
│           ├── MarkupBuilder.ts, MarkupParser.ts, index.ts
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
│   ├── tsc/       (giữ tên `tsc`, KHÔNG đổi thành `tspl`)
│   │   ├── TscCommand.ts, TscCompiler.ts, TscEncoder.ts, TscParser.ts, index.ts
│   ├── zpl/       ├── ZplCommand.ts, ZplCompiler.ts, ZplEncoder.ts, ZplParser.ts, index.ts
│   ├── epl/       ├── EplCommand.ts, EplCompiler.ts, EplEncoder.ts, EplParser.ts, index.ts
│   ├── cpcl/      ├── CpclCommand.ts, CpclCompiler.ts, CpclEncoder.ts, CpclParser.ts, index.ts
│   ├── dpl/       ├── DplCommand.ts, DplCompiler.ts, DplEncoder.ts, DplParser.ts, index.ts
│   ├── ipl/       ├── IplCommand.ts, IplCompiler.ts, IplEncoder.ts, IplParser.ts, index.ts
│   ├── sbpl/      ├── SbplCommand.ts, SbplCompiler.ts, SbplEncoder.ts, SbplParser.ts, index.ts
│   ├── escpos/    ├── EscPosCommand.ts, EscPosCompiler.ts, EscPosCodePage.ts,
│   │              │   EscPosBarcodeEncoder.ts, EscPosImageEncoder.ts,
│   │              │   EscPosQrCodeEncoder.ts, EscPosParser.ts, index.ts
│   └── starprnt/  └── StarPrntCommand.ts, StarPrntCompiler.ts, StarPrntEncoder.ts,
│                      StarPrntParser.ts, index.ts
│
├── preview/                          # THU GỌN + thêm per-language subfolder
│   ├── PreviewRenderer.ts            # KHÔNG đổi — implementation dùng chung
│   │                                 # cho Dpl/Sbpl/Ipl (giữ nguyên vị trí + nội dung)
│   ├── index.ts
│   └── languages/
│       ├── tsc/TscPreviewRenderer.ts       (MỚI — thêm 1 cấp thư mục theo lang)
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
│       ├── tsc/TscValidator.ts, index.ts
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
├── testing/                             # KHÔNG đổi
│   ├── HexDump.ts, MockPrinterTransport.ts, PrintDataAssertion.ts, index.ts
│
└── __tests__/                            # KHÔNG đổi (integration test ở root)
    ├── layout-engine-integration.test.ts, phase2-integration.test.ts
```

## Xoá dead code (11 file placeholder — trước khi di chuyển bất cứ gì)

Các file này là `export {}` với comment "Placeholder — not yet ported (see
docs/superpowers)" — chưa từng có logic thật, không được import bởi bất cứ
đâu ngoài barrel `index.ts` của chính folder chứa chúng. Xoá thẳng, không di
chuyển đi đâu cả, và xoá luôn dòng `export * from './X'` tương ứng trong
`index.ts` của folder đó:

- `compiler/PrinterCompiler.ts`, `compiler/CompiledPrintData.ts`, `compiler/CompilerResult.ts`
- `parser/PrinterParser.ts`, `parser/ParsedCommand.ts`, `parser/ParsedPrintData.ts`
- `preview/PreviewResult.ts`, `preview/SvgDocument.ts`, `preview/SvgElement.ts`
- `validation/PrinterValidator.ts`, `validation/ValidationLevel.ts`

Đồng thời cập nhật lại đoạn "Trạng thái hiện tại" trong `README.md` — dòng
"không còn file placeholder (`export {}`) nào" hiện đang **sai**.

## Xoá dead code khác (không phải placeholder, nhưng không được dùng)

- `receipt/ReceiptCell.ts` — không có reference nào ngoài chính file này và
  barrel `receipt/index.ts`. Xoá thẳng, không rename/move.

## Rename identifier (không chỉ move file — đổi tên type/hàm dùng ở nhiều nơi)

- `ReceiptColumn` → `TableColumn` (định nghĩa lại trong `formatting/TableColumn.ts`).
  Lý do: đây là type cột của `TableElement` (`type:'table'` trong
  `PrintElement`), dùng bởi CẢ label (qua `LayoutEngine`'s
  `justifyContent:'space-between'` → `TableElement` đặc biệt) LẪN receipt —
  không còn là khái niệm riêng của receipt. Ảnh hưởng: mọi nơi import
  `ReceiptColumn` (9 compiler + preview renderers dùng `formatTable`/`TableElement`)
  cần đổi sang `TableColumn`.
- `receipt/ReceiptFormatter.ts` → `formatting/RowFormatter.ts` (đổi tên file,
  giữ nguyên tên hàm `formatRow`/`alignText`/`padRight` bên trong).

## Quyết định KHÔNG áp dụng (đã cân nhắc, loại bỏ)

- **KHÔNG** chia `document/elements/drawing/` thành `shape/`+`line/`+`effect/`
  subfolder, và **KHÔNG** chia `document/elements/layout/` thành 5 subfolder
  riêng (`row/column/spacer/page-break/table/`), và **KHÔNG** tách
  `Element.ts`/`Options.ts` thành 2 file riêng mỗi loại — đề xuất ban đầu có
  đề cập nhưng không được thảo luận/chốt tường minh trong quá trình brainstorm
  này. Giữ nguyên quy ước hiện tại: 1 file = 1 Element (chứa cả `XxxElement`
  type lẫn `XxxOptions` interface cùng file, như code hiện tại đã làm) để
  tránh nhân số file lên gấp đôi và độ sâu thư mục không cần thiết cho các
  file rất nhỏ (10-20 dòng). Nếu muốn áp dụng, cần 1 vòng brainstorm riêng.
- **KHÔNG** đổi tên `convert/` → `conversion/` (đã hỏi, giữ nguyên).
- **KHÔNG** đổi folder `tsc/` → `tspl/` hay đổi giá trị `PrinterLanguage`
  (đã hỏi, giữ nguyên `'tsc'`/`tsc/`).

## Về test files

Mỗi file test (`__tests__/X.test.ts` nằm cạnh file nguồn) di chuyển theo file
nguồn tương ứng, giữ nguyên vị trí tương đối (`__tests__/` con của mỗi
folder). Import path bên trong test file cập nhật theo vị trí mới.

## Ngoài phạm vi

- Không đổi `PrinterLanguage` type hay giá trị enum nào.
- Không đổi hành vi runtime của bất kỳ compiler/parser/validator/preview
  renderer nào (chỉ đổi vị trí file + import path + 2 rename identifier nêu
  trên).
- Không động vào `packages/printer-preview` ngoài việc cập nhật import (nếu
  nó import path cụ thể nào đó thay vì qua barrel `index.ts` gốc — cần kiểm
  tra khi thực thi).
- Không migrate `src/features/printer` (app logic riêng, ngoài phạm vi
  `printer-core`).

## Rủi ro & chiến lược triển khai

Đây là thay đổi lớn nhất từ trước đến nay trong `printer-core` về mặt SỐ FILE
CHẠM TỚI (~230 file nguồn + test, hầu hết chỉ đổi vị trí/import path, nhưng
sai sót ở barrel `index.ts` hoặc quên 1 import có thể làm gãy build toàn bộ
package giữa chừng). Plan thực thi (viết riêng qua `writing-plans`) cần chia
theo nhóm độc lập, mỗi nhóm tự chạy `type-check`/test xanh trước khi sang
nhóm tiếp theo — thứ tự đề xuất (ít rủi ro/phụ thuộc trước, nhiều rủi ro sau):

1. Xoá dead code (11 placeholder + `ReceiptCell.ts`) — không ai import, an toàn tuyệt đối.
2. `receipt/` → `formatting/` + rename `ReceiptColumn`→`TableColumn`,
   `ReceiptFormatter`→`RowFormatter` (chạm nhiều nơi dùng `TableElement`/`formatTable`
   nhưng đơn giản: tìm-thay tên import).
3. `barcode/`+`qrcode/` → `symbology/barcode`+`symbology/qrcode`.
4. `builder/content|drawing|layout|printer/` → `document/elements/*`.
5. `builder/{Print,Label,Receipt}Builder.ts` + `markup/` → `document/builder/*`.
6. `template/builders/` → `template/builder/` (đổi tên thư mục).
7. `compiler/{lang}/` + `parser/{lang}/` → `language/{lang}/` (gộp 2 cây).
8. `preview/languages/{Lang}PreviewRenderer.ts` → `preview/languages/{lang}/{Lang}PreviewRenderer.ts`
   (thêm 1 cấp thư mục).
9. `validation/{lang}/` → `validation/languages/{lang}/` (thêm 1 cấp thư mục `languages/`).

Sau mỗi nhóm: `npm run type-check -w printer-core`, `npx jest packages/printer-core`,
`npx eslint packages/printer-core/src` phải sạch trước khi commit nhóm đó.
Cuối cùng: cập nhật `packages/printer-core/README.md` (cấu trúc mới + sửa
tuyên bố sai về placeholder), xác nhận `packages/printer-preview` vẫn
type-check/test sạch (chỉ import qua barrel `index.ts` gốc nên nhiều khả năng
không bị ảnh hưởng, nhưng phải xác nhận).
