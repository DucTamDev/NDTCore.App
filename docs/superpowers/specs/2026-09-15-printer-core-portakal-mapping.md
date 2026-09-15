# printer-core ⇄ portakal — source-to-destination mapping

Mục đích tài liệu này: ánh xạ chi tiết từng file đích trong khung thư mục
`NDTCore.App/packages/printer-core/src/` (hiện tại toàn bộ là placeholder
`export {}`) tới logic thực tương ứng trong package nguồn mở
[`portakal`](https://github.com/productdevbook/portakal) (checked out tại
`NDTCore/portakal/`), để một implementer sau này có thể port từng file mà
không cần đọc lại toàn bộ portakal từ đầu. Với mỗi thư mục cấp 1 của
`printer-core/src/`, bảng dưới liệt kê: file đích, file+export/section nguồn
trong portakal (nếu có), và ghi chú về việc port thẳng / tách nhỏ / đổi tên /
hay hoàn toàn NET-NEW (không có logic tương ứng trong portakal). Phần cuối
tổng hợp danh sách net-new và đề xuất thứ tự port.

Đã đọc toàn bộ 42 file `.ts` trong `portakal/src/` (15 file gốc + 9
`lang/*.ts` + 9 `languages/*.ts` + 9 `parsers/*.ts`) và toàn bộ 227 file
trong `printer-core/src/` (chỉ đọc tên/đường dẫn vì đều là placeholder).

**Lưu ý cấu trúc portakal quan trọng cho người port:**
- `src/languages/*.ts` chứa logic compile thật (`compileTo*`). `src/lang/*.ts`
  là các "Drizzle-style" wrapper module (tree-shakeable) — mỗi file bọc
  `{compile, parse, preview, validate}` quanh `languages/*.ts` +
  `parsers/*.ts` + `validate.ts`, và **thường tự định nghĩa renderer preview
  SVG riêng theo font-table của ngôn ngữ đó** (không dùng chung
  `src/preview.ts`) — đây chính là nguồn cho `preview/languages/*.ts`.
- `LabelElement` (trong `types.ts`) — kiểu union trung tâm mà mọi
  builder/compiler/parser/preview thao tác — **không có variant `barcode`
  hay `qrcode`**. Toàn bộ hỗ trợ barcode/QR trong portakal chỉ dừng ở mức
  parser nhận diện lệnh máy in gốc (TSC `BARCODE`/`QRCODE`, ZPL `^B*`,
  ESC/POS `GS k`/`GS ( k`) và lưu dưới dạng lệnh thô hoặc bỏ qua — không hề
  có encoder tự tính module/bar width/QR matrix. Đây là lý do `barcode/` và
  `qrcode/` gần như 100% net-new.
- `src/markup.ts` (HTML-like label markup DSL, `markup()` function) — người
  dùng đã quyết định PORT (không bỏ qua). Đã thêm thư mục `markup/` vào
  skeleton (`MarkupParser.ts` + `MarkupBuilder.ts` + `index.ts`, xem mục
  `markup/` bên dưới).

---

## core/

| Destination file | Portakal source | Notes |
|---|---|---|
| `core/PrinterLanguage.ts` | `src/profiles.ts` — `PrinterLanguage` type (dòng 6-15) | Port thẳng/relocate — portakal định nghĩa union này trong `profiles.ts`, printer-core đưa lên `core/` làm kiểu trung tâm để dispatch compiler/parser/preview/validation. |
| `core/PrintCompiler.ts` | `src/lang/*.ts` (cả 9 file) — hình dạng method `.compile(builder)` chung của các object `tsc`, `zpl`, `epl`, `cpcl`, `dpl`, `sbpl`, `escpos`, `starprnt`, `ipl`; `src/index.ts` dòng 4-12 (`compileTo*` re-export) | Không có file portakal nào định nghĩa đây là interface chính thức — portakal dùng duck-typing. Đây là ADAPT: trích xuất hợp đồng `compile(document): string \| Uint8Array` ngầm định thành interface có tên, để `compiler/*/*.Compiler.ts` implement. |
| `core/PrintParser.ts` | `src/lang/*.ts` method `.parse()`; `src/convert.ts` `parseSource()` switch (dòng 49-113) | Tương tự — hình thức hoá hợp đồng parse ngầm định. |
| `core/PrintPreview.ts` | `src/lang/*.ts` method `.preview()`/`.previewResolved()`; `src/preview.ts` `renderPreview()` (dòng 156-179) | Hình thức hoá hợp đồng preview; `preview.ts` là implementation mặc định mà `dpl`/`sbpl`/`ipl` dùng lại nguyên xi. |
| `core/PrintValidation.ts` | `src/lang/*.ts` method `.validate()` (chỉ `tsc`/`zpl` thực sự nối method này); `src/validate.ts` `validate()` (dòng 34-61) | Hình thức hoá hợp đồng validate. Lưu ý: 7/9 language module (epl, cpcl, dpl, sbpl, escpos, starprnt, ipl) trong portakal **chưa bao giờ** nối `.validate()`. |
| `core/index.ts` | `src/index.ts` (barrel, một phần) | Barrel export cho 5 file trên; không có file portakal 1:1. |

## types/

| Destination file | Portakal source | Notes |
|---|---|---|
| `types/Unit.ts` | `src/types.ts` — `Unit` type (dòng 2) | Port thẳng. |
| `types/Rotation.ts` | `src/types.ts` — `Rotation` type (dòng 5) | Port thẳng. |
| `types/Alignment.ts` | `src/types.ts` — `Alignment` type (dòng 8) | Port thẳng. |
| `types/Bitmap.ts` | `src/types.ts` — `MonochromeBitmap` interface (dòng 126-135) | Port thẳng. Trùng nguồn với `image/MonochromeBitmap.ts` — cần chọn 1 nơi canonical, re-export ở nơi còn lại. |
| `types/Point.ts` | — | **NET-NEW.** portakal không bao giờ gộp x/y thành object `Point`; mọi options interface (`TextOptions`, `ImageOptions`, `BoxOptions`, `LineOptions`, `CircleOptions`...) đều inline `x?: number; y?: number` trực tiếp. |
| `types/Size.ts` | — | **NET-NEW**, lý do tương tự (width/height luôn inline, vd `ImageOptions.width/height`). |
| `types/Rect.ts` | — | **NET-NEW** (tổ hợp x+y+width+height chưa bao giờ được model thành 1 type — `BoxOptions`/`EraseOptions`/`ReverseOptions` lặp lại 4 field độc lập). |
| `types/Direction.ts` | `src/types.ts` `LabelConfig.direction?: 0 \| 1` (dòng 32) + lệnh TSPL `DIRECTION` (`parsers/tsc.ts` dòng 22, 425-433) | Liên quan lỏng — "direction" trong portakal chỉ là hướng in giấy (0\|1), hẹp hơn một enum Direction tổng quát. Adapt, không copy nguyên văn. |
| `types/FontWeight.ts` | — | **NET-NEW.** portakal chỉ có boolean `TextOptions.bold` (dòng 54), không có thang weight. |
| `types/FontStyle.ts` | — | **NET-NEW.** Không có khái niệm italic/oblique ở đâu trong portakal. |
| `types/index.ts` | — | Barrel. |

## document/

| Destination file | Portakal source | Notes |
|---|---|---|
| `document/PrintDocument.ts` | `src/types.ts` — `LabelConfig` (dòng 14-35) | Đổi tên/port thẳng. |
| `document/PrintDocumentOptions.ts` | `src/types.ts` — các field optional của `LabelConfig` (unit/dpi/gap/speed/density/direction/copies) | Tách từ cùng interface, chuyển sang pattern options-object riêng. |
| `document/PrintElement.ts` | `src/types.ts` — `LabelElement` union (dòng 163-172) | Cần thêm 2 variant mới (`barcode`, `qrcode`) — không có tương ứng trong portakal (xem `barcode/`, `qrcode/`). |
| `document/PrintElementType.ts` | Các discriminant string literal trong `LabelElement` ("text"\|"image"\|"box"\|"line"\|"circle"\|"ellipse"\|"reverse"\|"erase"\|"raw") | Trích xuất thành type riêng, cộng 2 tag mới ("barcode","qrcode") net-new. |
| `document/ResolvedPrintDocument.ts` | `src/types.ts` — `ResolvedLabel` (dòng 175-194), tạo ra bởi `builder.ts` `LabelBuilder.resolve()` (dòng 86-101) | Đổi tên/port thẳng. **Xác minh:** đây KHÔNG phải net-new — có tương ứng 1:1 là `ResolvedLabel`, chỉ đổi tên. |
| `document/index.ts` | — | Barrel. |

## builder/

| Destination file | Portakal source | Notes |
|---|---|---|
| `builder/LabelBuilder.ts` | `src/builder.ts` — class `LabelBuilder` (toàn bộ, dòng 19-106), gồm logic default theo printer profile (dòng 24-34) và `resolve()` (86-101) | Port thẳng. |
| `builder/PrintBuilder.ts` | — | **NET-NEW** như base class riêng. portakal chỉ có 1 class `LabelBuilder` cụ thể, không có base + subclass. ADAPT: trích xuất pattern "chain trả về `this`" (`.text/.image/.box/.line/.circle/.ellipse/.reverse/.erase/.raw`, dòng 41-84) thành base `PrintBuilder`. |
| `builder/ReceiptBuilder.ts` | — | **NET-NEW.** portakal dùng chung 1 `LabelBuilder` cho cả label và receipt; hành vi "receipt-style" chỉ xuất hiện ở tầng preview (`lang/escpos.ts`, `lang/starprnt.ts` — `renderReceiptSVG`), chưa bao giờ là 1 builder class riêng. Có thể mượn ý tưởng từ `receipt.ts` nhưng class thì chưa tồn tại. |
| `builder/content/TextElement.ts` | `src/builder.ts` `.text()` (dòng 41-44) + `src/types.ts` `TextOptions` (dòng 38-65) | Port thẳng. |
| `builder/content/ImageElement.ts` | `src/builder.ts` `.image()` (46-49) + `TextOptions`... `ImageOptions` (67-81) | Port thẳng. |
| `builder/content/RawElement.ts` | `src/builder.ts` `.raw()` (81-84) + variant `{type:"raw"}` | Port thẳng. |
| `builder/content/BarcodeElement.ts` | — | **NET-NEW.** Không có `.barcode()` trong `LabelBuilder`, không có variant "barcode" trong `LabelElement`. Nhận thức về barcode duy nhất nằm ở parser (vd `parsers/tsc.ts` lệnh `BARCODE`, `parsers/zpl.ts` `^B*`/`^BY`, `parsers/escpos.ts` `GS k`) — chỉ parse ngược lệnh có sẵn, không model input builder. |
| `builder/content/QrCodeElement.ts` | — | **NET-NEW**, lý do tương tự — chỉ `parsers/tsc.ts` lệnh `QRCODE` và `parsers/escpos.ts` `GS ( k` nhận diện byte QR có sẵn. |
| `builder/content/index.ts` | — | Barrel. |
| `builder/drawing/BoxElement.ts` | `src/builder.ts` `.box()` (51-54) + `BoxOptions` (84-97) | Port thẳng. |
| `builder/drawing/LineElement.ts` | `src/builder.ts` `.line()` (56-59) + `LineOptions` (100-111) | Port thẳng. |
| `builder/drawing/CircleElement.ts` | `src/builder.ts` `.circle()` (61-64) + `CircleOptions` (114-123) | Port thẳng. |
| `builder/drawing/EllipseElement.ts` | `src/builder.ts` `.ellipse()` (66-69) + `EllipseOptions` (138-144) | Port thẳng. |
| `builder/drawing/ReverseElement.ts` | `src/builder.ts` `.reverse()` (71-74) + `ReverseOptions` (147-152) | Port thẳng. |
| `builder/drawing/EraseElement.ts` | `src/builder.ts` `.erase()` (76-79) + `EraseOptions` (155-160) | Port thẳng. |
| `builder/drawing/DiagonalElement.ts` | Không có method/element riêng — logic nằm rải rác: `languages/zpl.ts` `compileElement()` case "line" (dòng 70-85, phát `^GD` khi line không thẳng trục) và `parsers/tsc.ts` lệnh `DIAGONAL` riêng (dòng 163, 779-796, map ngược về element "line" chung) | ADAPT một phần — coi là biến thể của LineElement (x1≠x2 và y1≠y2) chứ không phải port thẳng. |
| `builder/drawing/index.ts` | — | Barrel. |
| `builder/layout/ColumnElement.ts` | — | **NET-NEW** — không có khái niệm container layout nào trong portakal. |
| `builder/layout/RowElement.ts` | — | **NET-NEW**, lý do tương tự. |
| `builder/layout/PageBreakElement.ts` | — | **NET-NEW** (portakal có multi-copy qua `PRINT n` nhưng không có element ngắt trang). |
| `builder/layout/SpacerElement.ts` | — | **NET-NEW.** |
| `builder/layout/TableElement.ts` | `src/receipt.ts` `formatTable()`/`Column` (dòng 2-7, 45-47) | Liên quan lỏng — đó là hàm format chuỗi dạng grid ký tự cho receipt, không phải builder element class. Chỉ dùng làm tham khảo ý tưởng. |
| `builder/layout/index.ts` | — | Barrel. |
| `builder/printer/CutElement.ts` | Hành vi cut hardcode, không qua element, ở 2 nơi: `languages/starprnt.ts` (`ESC d 1` luôn append cuối, dòng 128) và `parsers/escpos.ts` decode `GS V m [n]` (dòng 346-367) | Byte sequence đã biết; khái niệm element thì net-new — không có `.cut()` hay variant LabelElement nào trong portakal. |
| `builder/printer/index.ts` | — | Barrel. |
| `builder/index.ts` | `src/builder.ts` export list (`LabelBuilder`, `label`) | Barrel. |

## markup/

| Destination file | Portakal source | Notes |
|---|---|---|
| `markup/MarkupParser.ts` | `src/markup.ts` — `ParsedTag` interface (19-24), `parseUnitValue()` (27-30), `parseTag()` (33-53), `parseAttrs()` (56-64), `getUnit()` (67-71) | Port thẳng — tách phần tokenizer chuỗi→tag thuần khỏi phần dispatch sang builder, theo quy ước 1 file/1 trách nhiệm của repo. |
| `markup/MarkupBuilder.ts` | `src/markup.ts` — hàm `markup()` (76-210): parse thuộc tính `<label>`, vòng lặp `tagRegex` dispatch sang `LabelBuilder.text/line/box/circle/ellipse/reverse/erase/raw` (117-206) | Port thẳng. Phụ thuộc `MarkupParser.ts` (cùng thư mục) và `builder/LabelBuilder.ts` — chỉ port được sau khi `builder/` đã có logic thật. Lưu ý 2 chỗ portakal dùng `any` (dòng 88, 124) — phải thay bằng type thật khi port do repo cấm `any`. |
| `markup/index.ts` | `src/index.ts` dòng 48 (`markup`) | Barrel. |

**Quyết định của user (2026-09-15):** PORT markup DSL (không bỏ qua) — đã thêm `markup/` vào skeleton, xem `src/index.ts` gốc của printer-core (barrel đặt giữa `builder/` và `receipt/`). Thêm vào bước 5 của thứ tự port bên dưới (ngay sau `builder/`, vì phụ thuộc trực tiếp `LabelBuilder`).

## receipt/

| Destination file | Portakal source | Notes |
|---|---|---|
| `receipt/ReceiptFormatter.ts` | `src/receipt.ts` (toàn file), đặc biệt `formatRow()`/`formatTable()` (dòng 10-34, 45-47) | Port thẳng phần orchestration chính. |
| `receipt/PairFormatter.ts` | `src/receipt.ts` `formatPair()` (dòng 37-42) | Port thẳng. |
| `receipt/TableFormatter.ts` | `src/receipt.ts` `formatTable()` (45-47) + `alignText()` helper (80-95) | Port thẳng. |
| `receipt/SeparatorFormatter.ts` | `src/receipt.ts` `separator()` (dòng 50-52) | Port thẳng. |
| `receipt/WordWrapper.ts` | `src/receipt.ts` `wordWrap()` (dòng 55-78) | Port thẳng. |
| `receipt/ReceiptColumn.ts` | `src/receipt.ts` `Column` interface (dòng 2-7) | Port thẳng/đổi tên. |
| `receipt/ReceiptCell.ts` | — | **NET-NEW.** `formatRow`/`formatTable` trong portakal thao tác trên `string[]` thô mỗi hàng, không có object per-cell với style riêng. |
| `receipt/ReceiptLayout.ts` | — | **NET-NEW** như model có state. portakal chỉ có hàm formatting stateless (Column[] + values[] + totalWidth → string); không có object `ReceiptLayout` giữ columns/rows/config cùng nhau. |
| `receipt/index.ts` | `src/index.ts` dòng 23-24 (`formatRow`, `formatPair`, `formatTable`, `separator`, `wordWrap`, type `Column`) | Barrel. |

## barcode/

| Destination file | Portakal source | Notes |
|---|---|---|
| `barcode/BarcodeType.ts` | — | **NET-NEW.** portakal không enum hoá symbology — tên symbology luôn là chuỗi tự do đi thẳng qua lệnh (vd `parsers/tsc.ts` `BARCODE` field `type: string`; `parsers/zpl.ts` chữ cái lệnh `^B0`-`^B9`/`^BA`-`^BZ` coi như chuỗi mờ, dòng 167-175). |
| `barcode/BarcodeConfig.ts` | — | **NET-NEW.** Không có config barcode hợp nhất; mỗi ngôn ngữ tự giữ layout tham số riêng (TSC: x/y/type/height/readable/rotation/narrow/wide; ZPL: orientation+height+moduleWidth qua `^BY`/`^B*`). |
| `barcode/BarcodeValidator.ts` | — | **NET-NEW.** `validate.ts` không có check tham số barcode nào (không trong `validateTSC` lẫn `validateZPL`). |
| `barcode/index.ts` | — | Barrel. |

**Ghi chú chung barcode/:** phần compile (sinh module width/check digit/start-stop pattern cho Code128/Code39/EAN/UPC...) phải viết mới hoàn toàn — portakal luôn giao việc này cho firmware máy in, chỉ phát lệnh barcode gốc kèm chuỗi dữ liệu pass-through, chưa bao giờ tự tính bar.

## qrcode/

| Destination file | Portakal source | Notes |
|---|---|---|
| `qrcode/QrCodeModel.ts` | — | **NET-NEW.** Không có sinh ma trận/module QR nào trong portakal (không Reed-Solomon, không encode data/format/version). Máy in tự làm việc này; portakal chỉ phát `QRCODE ...,"content"` (TSC). |
| `qrcode/QrCodeErrorCorrection.ts` | `parsers/tsc.ts` `QRCODE` field `ecc: string` (dòng 142) | Liên quan lỏng — chỉ parse như chuỗi mờ, không validate theo mức L/M/Q/H. Coi như net-new. |
| `qrcode/QrCodeConfig.ts` | — | **NET-NEW** — mỗi ngôn ngữ có shape lệnh QR khác nhau (TSC: ecc/cellWidth/mode/rotation/model/mask; ESC/POS `GS ( k` cho QR hoàn toàn chưa được implement trong portakal). |
| `qrcode/QrCodeValidator.ts` | — | **NET-NEW**, không có validation nào. |
| `qrcode/index.ts` | — | Barrel. |

## image/

| Destination file | Portakal source | Notes |
|---|---|---|
| `image/MonochromeBitmap.ts` | `src/types.ts` `MonochromeBitmap` (126-135) + `src/image.ts` `packBitmap()` (125-141) | Port thẳng. |
| `image/RgbaImage.ts` | `src/image.ts` `rgbaToGrayscale()` (4-23) — tham số Uint8Array/Uint8ClampedArray + width/height | ADAPT — portakal không bọc bộ ba này thành class, chỉ truyền tham số rời. |
| `image/ImageTransform.ts` | `src/image.ts` `imageToMonochrome()` orchestration (144-170) | Port thẳng pipeline "grayscale → dither → pack". |
| `image/ImageThreshold.ts` | `src/image.ts` `ditherThreshold()` (26-37) + `ImageOptions.threshold` (`types.ts` dòng 80) | Port thẳng — dù `dithering/ThresholdDither.ts` cũng trùng nguồn (xem bên dưới), cần chọn nơi canonical. |
| `image/ImageDither.ts` | `src/image.ts` switch chọn thuật toán trong `imageToMonochrome()` (dòng 150-167) | Port thẳng phần dispatch. |
| `image/ImageCrop.ts` | — | **NET-NEW.** portakal không crop; caller phải tự crop trước khi gọi `imageToMonochrome`. |
| `image/ImageResize.ts` | — | **NET-NEW.** Không có resample bitmap — `ImageOptions.width/height` (`types.ts` dòng 74-76) chỉ dùng làm scale hiển thị lúc render SVG preview (`preview.ts` dòng 84-86), không bao giờ resample bitmap thật trước khi gửi máy in. |
| `image/ImageSource.ts` | — | **NET-NEW** abstraction — portakal luôn kỳ vọng caller đã có sẵn buffer RGBA đã decode + width/height. |
| `image/dithering/ThresholdDither.ts` | `src/image.ts` `ditherThreshold()` (26-37) | Port thẳng. |
| `image/dithering/FloydSteinbergDither.ts` | `src/image.ts` `ditherFloydSteinberg()` (39-70) | Port thẳng. |
| `image/dithering/AtkinsonDither.ts` | `src/image.ts` `ditherAtkinson()` (72-102) | Port thẳng. |
| `image/dithering/OrderedDither.ts` | `src/image.ts` `ditherOrdered()` (112-122) + hằng `BAYER4` (104-110) | Port thẳng. |
| `image/dithering/DitherAlgorithm.ts` | `src/types.ts` `DitherAlgorithm` type (dòng 11) | Port thẳng. |
| `image/dithering/index.ts` | — | Barrel. |
| `image/index.ts` | `src/index.ts` dòng 14-22 (`imageToMonochrome`, `rgbaToGrayscale`, `packBitmap`, `ditherThreshold`, `ditherFloydSteinberg`, `ditherAtkinson`, `ditherOrdered`) | Barrel. |

## encoding/

| Destination file | Portakal source | Notes |
|---|---|---|
| `encoding/CodePage.ts` | `src/encoding.ts` `CodePage` interface (dòng 10-17) | Port thẳng. |
| `encoding/CodePageEncoder.ts` | `src/encoding.ts` `encodeText()` (170-216), `encodeTextForPrinter()` (222-243), `isASCII()` (246-254), `findCodePage()` (154-162) | Port thẳng. |
| `encoding/EncodingResult.ts` | `src/encoding.ts` `EncodedSegment` interface (dòng 20-25) | Đổi tên/adapt. **Xác minh:** KHÔNG phải net-new — có tương ứng 1:1 `EncodedSegment`. |
| `encoding/encoders/Cp437Encoder.ts` | `src/encoding.ts` `CP437_CHARS` (39-74) + entry trong `CODE_PAGES` (146) | Port thẳng. |
| `encoding/encoders/Cp858Encoder.ts` | `src/encoding.ts` `CP858_CHARS` (77-80, spread CP437 + Euro) | Port thẳng. |
| `encoding/encoders/Windows1252Encoder.ts` | `src/encoding.ts` `CP1252_CHARS` (83-113) | Port thẳng (đổi tên CP1252→Windows1252). |
| `encoding/encoders/Cp866Encoder.ts` | `src/encoding.ts` `CP866_CHARS` (116-131) | Port thẳng. |
| `encoding/encoders/Cp857Encoder.ts` | `src/encoding.ts` `CP857_CHARS` (134-142) | Port thẳng. |
| `encoding/encoders/Utf8Encoder.ts` | Nhánh passthrough ASCII trong `encodeText()` (dòng 186-189, 191-195) | Phần lớn **NET-NEW** — portakal chưa bao giờ có "UTF-8 passthrough encoder" thật (chỉ áp dụng cho máy in native-UTF-8 như Epson TM-m30II, `profiles.ts` `nativeUtf8: true`, nhưng `encodeTextForPrinter` không hề rẽ nhánh theo cờ này). |
| `encoding/encoders/Windows1258Encoder.ts` | — | **NET-NEW.** Không có bảng CP1258 (Windows Vietnamese) nào trong portakal. |
| `encoding/encoders/Tcvn3Encoder.ts` | — | **NET-NEW.** TCVN3 (bảng mã Việt cũ dùng ở nhiều máy in nhiệt local) hoàn toàn không có trong portakal — không phải code page thật, mà là remap ký tự Latin gốc + dấu kết hợp vào vùng 0xB0-0xFF theo layout riêng. |
| `encoding/encoders/index.ts` | — | Barrel. |
| `encoding/index.ts` | `src/index.ts` dòng 25-26 (`encodeText`, `encodeTextForPrinter`, `isASCII`, `CODE_PAGES`, type `CodePage`/`EncodedSegment`) | Barrel. |

## compiler/

| Destination file | Portakal source | Notes |
|---|---|---|
| `compiler/PrinterCompiler.ts` | `src/convert.ts` `compileTarget()` dispatch (dòng 118-139) + `src/index.ts` dòng 4-12 (`compileTo*` re-export) | Gần nhất với 1 compiler entrypoint hợp nhất trong portakal. |
| `compiler/CompilerResult.ts` | `src/convert.ts` `ConvertResult` (34-44) | Liên quan lỏng — `ConvertResult` mang thêm field đặc thù convert (elements/warnings); 1 result "compile 1 document sang 1 ngôn ngữ" đơn giản hơn là adapt nhẹ. |
| `compiler/CompiledPrintData.ts` | — | **NET-NEW** như wrapper có tên — hàm compile portakal trả thẳng `string \| Uint8Array`, không có envelope metadata. |
| `compiler/index.ts` | — | Barrel. |

Pattern lặp lại cho mỗi thư mục ngôn ngữ (`cpcl/dpl/epl/ipl/sbpl/starprnt/tsc/zpl`, escpos có biến thể riêng bên dưới):

| Destination file pattern | Portakal source | Notes |
|---|---|---|
| `compiler/{lang}/{Lang}Compiler.ts` | `src/languages/{lang}.ts` — export `compileTo{LANG}()` (toàn file) | Port thẳng logic chính. |
| `compiler/{lang}/{Lang}Command.ts` | Hằng số/ký tự lệnh hardcode inline trong `languages/{lang}.ts` (vd `ESC=0x1b, GS=0x1d, LF=0x0a` ở `languages/escpos.ts` dòng 3-5, **lặp lại y hệt** ở `languages/starprnt.ts` dòng 3-4; từ khoá `"SIZE"`,`"^XA"`,`"BOX"`,`"! "`,`STX`,`ESC`... rải rác trong `compileElement()` của từng file) | **NET-NEW về tổ chức** (không phải logic mới) — portakal không đặt tên các hằng số này thành module riêng; đây là refactor tách hằng số, không phải port logic mới. |
| `compiler/{lang}/{Lang}Encoder.ts` | Xem ghi chú theo từng ngôn ngữ bên dưới | Hỗn hợp — với giao thức nhị phân là class `ByteBuffer`; với giao thức text là logic encode bitmap→hex/text trong case "image". |

**Ghi chú `{Lang}Encoder.ts` theo từng ngôn ngữ (một số bị lỗi/thiếu ngay trong portakal — quan trọng cho việc port):**

| Ngôn ngữ | Nguồn | Tình trạng trong portakal |
|---|---|---|
| Tsc | `languages/tsc.ts` case "image" (dòng 22-28) | **THIẾU DỮ LIỆU** — chỉ phát `BITMAP x,y,bytesPerRow,height,0,` rồi bỏ lửng dấu phẩy, không bao giờ append byte/hex data thật. Phải viết lại đúng khi port, không chỉ copy. |
| Epl | `languages/epl.ts` case "image" (dòng 30-36) | **THIẾU DỮ LIỆU** — chỉ phát header `GW x,y,bytesPerRow,height`, không có payload pixel. |
| Dpl | `languages/dpl.ts` case "image" (dòng 33-43) | **THIẾU DỮ LIỆU** — header cố định `1{col}{row}{h}{w}0005`, không có payload bitmap. |
| Ipl | `languages/ipl.ts` case "image" (dòng 35-41) | **GẦN NHƯ STUB** — chỉ `{STX}G{fieldNum};o{x},{y};f0{ETX}`, không cả width/height/data. |
| Zpl | `languages/zpl.ts` case "image" (dòng 44-57) | **HOẠT ĐỘNG ĐÚNG** — hex-encode toàn bộ `bmp.data`, phát `^GFA,...`. Port thẳng. |
| Cpcl | `languages/cpcl.ts` case "image" (dòng 17-30) | **HOẠT ĐỘNG ĐÚNG** — hex-encode vào lệnh `EG`. Port thẳng. |
| Sbpl | `languages/sbpl.ts` case "image" (dòng 39-53) | **HOẠT ĐỘNG ĐÚNG** — hex-encode vào `ESC GM size,hex`. Port thẳng. |
| StarPrnt | `languages/starprnt.ts` case "image" (dòng 77-96) | **HOẠT ĐỘNG ĐÚNG** — ghi từng dòng raster qua `ByteBuffer`. Port thẳng. |

**`compiler/escpos/` (7 file thay vì pattern 4 file):**

| Destination file | Portakal source | Notes |
|---|---|---|
| `EscPosCommand.ts` | `languages/escpos.ts` hằng `ESC`/`GS`/`LF` (dòng 3-5) + byte lệnh inline suốt `compileElement()` (align `ESC,0x61`; bold `ESC,0x45`; size `GS,0x21`; reverse `GS,0x42`; raster image `GS,0x76,0x30`, dòng 51-91) | Trích xuất hằng số — net-new về tổ chức. |
| `EscPosCompiler.ts` | `languages/escpos.ts` `compileToESCPOS()` (113-124) + case text/raw (46-79, 103-109) | Port thẳng. Case box/line/circle/ellipse/reverse/erase đều no-op trong portakal (95-101) vì ESC/POS không có lệnh vẽ vector gốc — giữ nguyên hành vi hoặc nâng cấp render-thành-ảnh là quyết định thiết kế, không phải port. |
| `EscPosImageEncoder.ts` | `languages/escpos.ts` case "image" (81-93) | **HOẠT ĐỘNG ĐÚNG** — port thẳng format `GS v 0` raster. |
| `EscPosCodePage.ts` | `src/encoding.ts` (toàn file — `CODE_PAGES`/`findCodePage`/`encodeText`) | **QUAN TRỌNG:** `compileToESCPOS()` trong portakal **KHÔNG BAO GIỜ** gọi logic code-page của `encoding.ts` — `ByteBuffer.writeText()` (dòng 29) chỉ `new TextEncoder().encode(text)` (UTF-8 thô), nghĩa là text non-ASCII sẽ ra lỗi font trên máy in không native-UTF8. Port `EscPosCodePage.ts` từ `encoding.ts` và **nối nó vào** `EscPosCompiler.ts` case text là sửa bug qua port, không phải hành vi thật của portakal hôm nay. |
| `EscPosBarcodeEncoder.ts` | — | **NET-NEW** (xem `barcode/`). Tham khảo gần nhất là chiều decode `parsers/escpos.ts` xử lý `GS k` (dòng 312-344) — chỉ tài liệu hoá format byte, không phải cách sinh nó từ config. |
| `EscPosQrCodeEncoder.ts` | — | **NET-NEW** (xem `qrcode/`). Tham khảo: `parsers/escpos.ts` xử lý `GS ( k` (dòng 390-415), cùng hạn chế. |
| `escpos/index.ts` | — | Barrel. |

Các `compiler/{lang}/index.ts` khác — barrel, không có nguồn.

## parser/

| Destination file | Portakal source | Notes |
|---|---|---|
| `parser/PrinterParser.ts` | `src/convert.ts` `parseSource()` dispatch (dòng 49-113) + `src/index.ts` dòng 36-44 (`parse*` re-export) | Port thẳng phần dispatch. |
| `parser/ParsedCommand.ts` | Mỗi parser tự định nghĩa 1 shape command khác nhau: `TSPLCommand` (`parsers/tsc.ts`, union khổng lồ, dòng 11-239), `ZPLCommand` (`{code,rawParams,params}`, `parsers/zpl.ts` 12-19), `ESCPOSCommand` (`{name,bytes,params}`, `parsers/escpos.ts` 10-17), và các shape ad hoc `{cmd,params}`/`{type,params}`/`{name,bytes}` ở epl/cpcl/dpl/sbpl/starprnt/ipl | **ADAPT/hợp nhất net-new** — một `ParsedCommand` chung là sự tổng quát hoá 9 shape không tương thích; sẽ phải đánh đổi giữa tổng quát hoá mạnh (mất chi tiết riêng ngôn ngữ) và giữ base chung + extension riêng từng ngôn ngữ. |
| `parser/ParsedPrintData.ts` | Các result shape chung `{commands, widthDots, heightDots, elements, warnings}` (`TSPLParseResult`, `ZPLParseResult`, `ESCPOSParseResult`, `EPLParseResult`, `CPCLParseResult`, `DPLParseResult`, `SBPLParseResult`, `StarPRNTParseResult`, `IPLParseResult` — mỗi file parser 1 cái) | Tương tự — hợp nhất net-new. |
| `parser/index.ts` | — | Barrel. |
| `parser/tsc/TscParser.ts` | `parsers/tsc.ts` — `parseTSPL()` + `parseTSC()` (toàn file, 1320 dòng — file lớn nhất portakal, chứa toàn bộ ngữ pháp lệnh TSPL/TSPL2 kể cả BASIC programming) | Port thẳng. |
| `parser/zpl/ZplParser.ts` | `parsers/zpl.ts` — `tokenize()` + `parseZPL()` (toàn file, 676 dòng) | Port thẳng. |
| `parser/escpos/EscPosParser.ts` | `parsers/escpos.ts` — `parseESCPOS()` (toàn file, 532 dòng, state machine nhị phân) | Port thẳng. |
| `parser/epl/EplParser.ts` | `parsers/epl.ts` — `parseEPL()` (toàn file) | Port thẳng. |
| `parser/cpcl/CpclParser.ts` | `parsers/cpcl.ts` — `parseCPCL()` (toàn file) | Port thẳng. |
| `parser/dpl/DplParser.ts` | `parsers/dpl.ts` — `parseDPL()` (toàn file) | Port thẳng, nhưng lưu ý: parsing label-record cố định (dòng 63-85) là "best-effort" ngay trong portakal — nội dung text được đoán qua offset `slice(20)` hardcode, khá mong manh. |
| `parser/sbpl/SbplParser.ts` | `parsers/sbpl.ts` — `parseSBPL()` (toàn file) | Port thẳng. |
| `parser/starprnt/StarPrntParser.ts` | `parsers/starprnt.ts` — `parseStarPRNT()` (toàn file) | Port thẳng. |
| `parser/ipl/IplParser.ts` | `parsers/ipl.ts` — `parseIPL()` (toàn file) | Port thẳng. |
| Mỗi `parser/{lang}/index.ts` | — | Barrel. |

**Ghi chú chung parser/:** không parser nào trong 9 file dựng lại `BarcodeElement`/`QrCodeElement` có cấu trúc — chúng chỉ lưu lệnh barcode/QR dưới dạng structured command mờ (TSC) hoặc nhét nguyên văn vào element "raw" (ZPL, `parsers/zpl.ts` dòng 287-293) hoặc bỏ qua hẳn (CPCL — comment tại dòng 101: "BARCODE, EG, CG, PRINT... recognized but no preview"). Logic dựng lại element có cấu trúc phải viết mới hoàn toàn khi `barcode/`/`qrcode/` có mặt.

## preview/

| Destination file | Portakal source | Notes |
|---|---|---|
| `preview/PreviewRenderer.ts` | `src/preview.ts` `renderPreview()` (156-179) + `renderElement()` (47-154) | Đây là renderer MẶC ĐỊNH mà `lang/dpl.ts`, `lang/sbpl.ts`, `lang/ipl.ts` gọi thẳng, không tuỳ biến gì. Port thẳng. |
| `preview/PreviewResult.ts` | — | **NET-NEW** wrapper — mọi `renderPreview()`/`renderPreviewSVG()` trong portakal trả về `string` SVG thô, không có metadata đi kèm. |
| `preview/SvgDocument.ts` | — | **NET-NEW.** portakal không bao giờ dựng SVG DOM/object model — mọi renderer nối chuỗi template-literal trực tiếp (`preview.ts` dòng 169-178; `lang/tsc.ts` dòng 167-176; `lang/zpl.ts` dòng 205-214). Xây `SvgDocument` là tái tạo lại cùng layout (viewBox/padding/rect nền/rect viền/`<g transform>`/caption chân trang) từ các template chuỗi này, không phải port object model có sẵn. |
| `preview/SvgElement.ts` | — | **NET-NEW**, cùng lý do — mỗi `<rect>`/`<text>`/`<line>`/`<circle>`/`<ellipse>` trong portakal là chuỗi nội suy, chưa từng là object. |
| `preview/index.ts` | `src/index.ts` dòng 13 (`renderPreview`) | Barrel. |
| `preview/languages/TscPreviewRenderer.ts` | `lang/tsc.ts` (toàn file trừ compile/parse/validate passthrough) — bảng `TSC_FONTS` (23-32), `tscFontSize()`/`tscCharWidth()` (42-57), `renderElement()` (59-155), `renderPreviewSVG()` (157-177) | Port thẳng renderer tuỳ biến đầy đủ. |
| `preview/languages/ZplPreviewRenderer.ts` | `lang/zpl.ts` — `ZPL_FONTS` (13-30), `isProportionalFont()`/`zplFontSize()`/`zplBaselineRatio()`/`zplFontFamily()` (40-67), `renderElement()` gồm cả render placeholder barcode cho element "raw" chứa `^B` (163-191), `renderPreviewSVG()` (195-215) | Port thẳng. Logic "scrape lại `^BY`/`^FO`/`^B*`/`^FD` bằng regex từ chuỗi ZPL thô" (dòng 166-169) là minh hoạ tốt cho việc nên thay bằng renderer nhận `BarcodeElement` có cấu trúc một khi element đó tồn tại. |
| `preview/languages/EscPosPreviewRenderer.ts` | `lang/escpos.ts` `renderReceiptSVG()` (17-45) | Port thẳng — style receipt (không toạ độ tuyệt đối, xếp dọc theo chiều cao dòng). |
| `preview/languages/StarPrntPreviewRenderer.ts` | `lang/starprnt.ts` `renderReceiptSVG()` (16-36) | Gần giống ESC/POS nhưng THIẾU xử lý reverse/underline (dù compiler Star PRNT có hỗ trợ underline, `languages/starprnt.ts` dòng 57) — cần quyết định khi port có đồng bộ hay không. |
| `preview/languages/EplPreviewRenderer.ts` | `lang/epl.ts` — `EPL_FONTS` (12-18), `eplFontSize()`/`eplCharWidth()` (24-32), `renderElement()` (34-73, lưu ý circle/ellipse/reverse/erase/image/raw đều trả rỗng — chưa implement trong portakal), `renderPreviewSVG()` (75-82) | Port thẳng phần đã có; phần trả rỗng là hạn chế có sẵn của portakal. |
| `preview/languages/CpclPreviewRenderer.ts` | `lang/cpcl.ts` — `CPCL_FONTS` (12-20), `cpclFontSize()` (26-29), `renderElement()` (31-52, chỉ text/box/line có implement, còn lại `default: return ""`), `renderPreviewSVG()` (54-61) | Port thẳng phần đã có. |
| `preview/languages/DplPreviewRenderer.ts` | — | Không có nguồn riêng — `lang/dpl.ts` (toàn file) chỉ gọi `renderPreview()` chung từ `preview.ts`. Quyết định: dùng chung `PreviewRenderer` hay viết font/rendering rule riêng cho DPL (net-new). |
| `preview/languages/SbplPreviewRenderer.ts` | — | Tương tự Dpl — `lang/sbpl.ts` không có renderer riêng. |
| `preview/languages/IplPreviewRenderer.ts` | — | Tương tự — `lang/ipl.ts` không có renderer riêng. |
| `preview/languages/index.ts` | — | Barrel. |

## validation/

| Destination file | Portakal source | Notes |
|---|---|---|
| `validation/PrinterValidator.ts` | `src/validate.ts` `validate()` dispatch (dòng 34-61) | Port thẳng. |
| `validation/ValidationIssue.ts` | `src/validate.ts` `ValidationIssue` interface (9-18) | Port thẳng. |
| `validation/ValidationResult.ts` | `src/validate.ts` `ValidationResult` interface (20-29) | Port thẳng. |
| `validation/ValidationLevel.ts` | Union inline `"error"\|"warning"\|"info"` dùng trong `ValidationIssue.level` (`validate.ts` dòng 12) | Trích xuất thành type riêng — không phải logic mới. **Xác minh:** KHÔNG net-new, chỉ extraction. |
| `validation/index.ts` | `src/index.ts` dòng 47-49 (`validate`, type `ValidationIssue`/`ValidationResult`) | Barrel. |
| `validation/tsc/TscValidator.ts` | `src/validate.ts` `validateTSC()` (64-142) | Port thẳng (check: SIZE đầu tiên, CLS trước element, có PRINT, DENSITY 0-15, SPEED 1-18, cảnh báo lệnh UNKNOWN). |
| `validation/zpl/ZplValidator.ts` | `src/validate.ts` `validateZPL()` (144-189) | Port thẳng (check: ^XA đầu, ^XZ cuối, cảnh báo ^FD thiếu ^FO, range ^PW, forward warnings từ parser). |
| `validation/epl/EplValidator.ts` | Nhánh `default:` của `validate.ts` (49-54) chỉ đẩy 1 info chung "Validation for EPL is basic" | **NET-NEW** — không có rule riêng EPL nào trong portakal. |
| `validation/cpcl/CpclValidator.ts` | Nhánh `default:` tương tự | **NET-NEW.** |
| `validation/dpl/DplValidator.ts` | Nhánh `default:` tương tự | **NET-NEW.** |
| `validation/sbpl/SbplValidator.ts` | Nhánh `default:` tương tự | **NET-NEW.** |
| `validation/starprnt/StarPrntValidator.ts` | Nhánh `default:` tương tự | **NET-NEW.** |
| `validation/ipl/IplValidator.ts` | Nhánh `default:` tương tự | **NET-NEW.** |
| `validation/escpos/EscPosValidator.ts` | Không có gì — `escpos` thậm chí không nằm trong union `SourceLanguage` mà `validate.ts` chấp nhận (`convert.ts` dòng 28 loại trừ cả `escpos` và `starprnt`) | **NET-NEW hoàn toàn**, kể cả chỗ để "cắm vào" cũng chưa tồn tại. |
| Mỗi `validation/{lang}/index.ts` | — | Barrel. |

## convert/

| Destination file | Portakal source | Notes |
|---|---|---|
| `convert/PrinterConverter.ts` | `src/convert.ts` `convert()` (155-184) + `parseSource()` (49-113) + `compileTarget()` (118-139) | Port thẳng toàn bộ orchestration cross-compiler. |
| `convert/ConversionResult.ts` | `src/convert.ts` `ConvertResult` interface (34-44) | Đổi tên/port thẳng. **Xác minh:** KHÔNG net-new. |
| `convert/ConversionPath.ts` | `src/convert.ts` union `SourceLanguage`/`TargetLanguage` (28, 31) + mảng `SUPPORTED_SOURCES`/`SUPPORTED_TARGETS` (187-206) | ADAPT — portakal chưa bao giờ model 1 cặp (from,to) thành object riêng; đây là tái cấu trúc dữ liệu phẳng thành "path", không phải port thẳng. |
| `convert/ConversionRegistry.ts` | `parseSource()`/`compileTarget()` — 2 switch statement hardcode (49-113, 118-139) | **NET-NEW** về kiến trúc — không có registry/lookup table nào map ngôn ngữ→hàm parser / ngôn ngữ→hàm compiler; đây là nâng cấp so với switch-statement. |
| `convert/index.ts` | `src/index.ts` dòng 45-46 (`convert`, `SUPPORTED_SOURCES`, `SUPPORTED_TARGETS`, `ConvertResult`, `SourceLanguage`, `TargetLanguage`) | Barrel. |

Ghi chú: `SourceLanguage` của `convert.ts` loại trừ `escpos` và `starprnt` (dòng 28) — dù `parsers/escpos.ts`/`parsers/starprnt.ts` có thể parse ngược byte ESC/POS/Star, cross-compiler của portakal chưa bao giờ nối chúng làm nguồn convert-FROM. Cần quyết định khi thiết kế `ConversionRegistry` có lấp khoảng trống này không.

## profile/

| Destination file | Portakal source | Notes |
|---|---|---|
| `profile/PrinterProfile.ts` | `src/profiles.ts` `PrinterProfile` interface (21-49) + `CutterType`/`ImageMode` (17, 19) | Port thẳng. |
| `profile/PrinterProfileResolver.ts` | `src/profiles.ts` `getProfile()` (375-377), `listProfiles()` (380-382), `findByVendorId()` (385-387), `findByLanguage()` (390-392) | Port thẳng. |
| `profile/PrinterVendor.ts` | `src/profiles.ts` field `PrinterProfile.vendor` (dòng 25) — luôn là chuỗi tự do ("Epson","Star Micronics","Bixolon","Citizen","Generic","TSC","Zebra","SATO","Honeywell") | **NET-NEW.** Không có enum/type `PrinterVendor` nào ràng buộc giá trị này trong portakal. |
| `profile/index.ts` | `src/index.ts` dòng 27-34 | Barrel. |
| `profile/profiles/EpsonProfiles.ts` | `src/profiles.ts` entries `epson-tm-t88vi`, `epson-tm-t88v`, `epson-tm-t20iii`, `epson-tm-m30ii` (dòng 54-125) | Port thẳng (tách theo vendor). |
| `profile/profiles/StarProfiles.ts` | `src/profiles.ts` entries `star-tsp143`, `star-tsp100` (128-163) | Port thẳng. |
| `profile/profiles/BixolonProfiles.ts` | `src/profiles.ts` entry `bixolon-srp-350` (166-183) | Port thẳng. |
| `profile/profiles/CitizenProfiles.ts` | `src/profiles.ts` entry `citizen-ct-s310ii` (186-203) | Port thẳng. |
| `profile/profiles/GenericProfile.ts` | `src/profiles.ts` entries `generic-58mm`, `generic-80mm` (206-239) | Port thẳng. |
| `profile/profiles/TscProfiles.ts` | `src/profiles.ts` entries `tsc-te200`, `tsc-te310` (242-277) | Port thẳng. |
| `profile/profiles/ZebraProfiles.ts` | `src/profiles.ts` entries `zebra-zd420`, `zebra-zt410`, `zebra-gk420` (280-333) | Port thẳng. |
| `profile/profiles/SatoProfiles.ts` | `src/profiles.ts` entry `sato-cl4nx` (336-352) | Port thẳng. |
| `profile/profiles/HoneywellProfiles.ts` | `src/profiles.ts` entry `honeywell-pc42t` (355-371) | Port thẳng. |
| `profile/profiles/index.ts` | `src/profiles.ts` `PRINTER_PROFILES` object hợp nhất (52-372) | Barrel gộp lại các vendor file thành 1 record như bản gốc. |

## transport/

| Destination file | Portakal source | Notes |
|---|---|---|
| `transport/PrinterTransport.ts` | `src/transport.ts` `PrinterTransport` interface (12-27), `ConnectionState` (9), `ChunkOptions`/`ReconnectOptions` (30-45), `chunkedWrite()` (51-66), `writeWithRetry()` (71-100) | Port thẳng. Theo README, giữ nguyên "interface only" trong printer-core, đúng tinh thần portakal ("these are interfaces and utilities, not implementations" — dòng 2-6). |
| `transport/NetworkTransport.ts` | `src/transport.ts` `TCPConfig` interface (106-110) | Port thẳng — interface-only ở cả 2 bên. |
| `transport/UsbTransport.ts` | `src/transport.ts` `USBConfig` interface (116-121) + `USB_VENDOR_IDS` (159-168) | Port thẳng. |
| `transport/BluetoothTransport.ts` | `src/transport.ts` `BLEConfig` interface (127-140) + `BLE_UUIDS` (143-156) | Port thẳng. |
| `transport/index.ts` | `src/index.ts` dòng 35, 61-69 | Barrel. |

**Xác minh riêng:** không tìm thấy interface `PrinterConnection`-liên-quan nào khác ngoài 3 file trên; cả 3 đều CÓ tương ứng portakal (TCPConfig/USBConfig/BLEConfig) — KHÔNG net-new, trái với giả định ban đầu trong đề bài.

## testing/

| Destination file | Portakal source | Notes |
|---|---|---|
| `testing/HexDump.ts` | — | **NET-NEW.** Không có tiện ích hex-dump/pretty-printer nào trong `src/` của portakal (chỉ có `.toString(16).padStart(2,"0")` rời rạc inline khi build hex payload bitmap — vd `languages/zpl.ts` dòng 52-54, `languages/sbpl.ts` dòng 48-50 — chưa từng được factor thành helper tái sử dụng). |
| `testing/MockPrinterTransport.ts` | — | **NET-NEW.** portakal không export mock implementation nào của `PrinterTransport` trong `src/`. |
| `testing/PrintDataAssertion.ts` | — | **NET-NEW.** Không có helper so sánh/assert output máy in nào trong API công khai của portakal. |
| `testing/index.ts` | — | Barrel. |

## Root

| Destination file | Portakal source | Notes |
|---|---|---|
| `index.ts` | `src/index.ts` (toàn file, 89 dòng) | Barrel API công khai. portakal tổ chức thành 1 danh sách re-export phẳng: compiler → preview → image → receipt → encoding → profiles → transport → parser → convert → validate → markup → cuối cùng là namespace "Drizzle-style" `lang.*` tree-shakeable. printer-core cần tái tạo bề mặt API tương đương từ compiler/parser/preview/validation/convert/profile/builder/receipt/encoding/barcode/qrcode/image/transport/testing đã tách. **Lưu ý:** `markup()` (dòng 48) và toàn bộ DSL `markup.ts` KHÔNG có thư mục đích nào trong skeleton — cần quyết định rõ có port hay bỏ trước khi đóng file này. |

---

## Net-new work (no portakal source)

Danh sách các file đích **hoàn toàn không có logic tương ứng** trong portakal (không tính các file chỉ là barrel `index.ts`, đã liệt kê riêng trong từng bảng ở trên):

**Xác minh các "candidate" nêu trong đề bài:**
- `Tcvn3Encoder` — **ĐÚNG, net-new** (`encoding/encoders/Tcvn3Encoder.ts`). TCVN3 không tồn tại trong portakal dưới bất kỳ hình thức nào.
- `PrinterVendor` — **ĐÚNG, net-new** (`profile/PrinterVendor.ts`). portakal chỉ dùng chuỗi tự do cho vendor.
- `ResolvedPrintDocument` — **SAI, KHÔNG net-new.** Có tương ứng 1:1 là `ResolvedLabel` (`types.ts` dòng 175-194), chỉ đổi tên.
- `EncodingResult` — **SAI, KHÔNG net-new.** Có tương ứng 1:1 là `EncodedSegment` (`encoding.ts` dòng 20-25), chỉ đổi tên.
- `ValidationLevel` — **SAI, KHÔNG net-new.** Chỉ là trích xuất union `"error"|"warning"|"info"` đã tồn tại inline trong `ValidationIssue.level` (`validate.ts` dòng 12).
- `ConversionPath`/`ConversionRegistry` — **MỘT ĐÚNG MỘT SAI.** `ConversionPath` chỉ là ADAPT từ `SourceLanguage`/`TargetLanguage`/`SUPPORTED_SOURCES`/`SUPPORTED_TARGETS` (đã có dữ liệu, chỉ thiếu object hoá) — không hẳn net-new. `ConversionRegistry` thì **ĐÚNG, net-new** — portakal chỉ có switch-statement, không có registry pattern.
- `MockPrinterTransport`, `PrintDataAssertion`, `HexDump` — **ĐÚNG, cả 3 đều net-new**, không có gì tương ứng trong `src/` của portakal.
- `PrinterConnection`-related transport interfaces — **KHÔNG tìm thấy net-new nào khác** ngoài `PrinterTransport`/`NetworkTransport`/`UsbTransport`/`BluetoothTransport` đã có, và cả 4 file này ĐỀU có tương ứng portakal (không net-new).

**Danh sách đầy đủ (nhóm theo thư mục):**

- `types/Point.ts`, `types/Size.ts`, `types/Rect.ts`, `types/FontWeight.ts`, `types/FontStyle.ts`
- `builder/PrintBuilder.ts`, `builder/ReceiptBuilder.ts`
- `builder/content/BarcodeElement.ts`, `builder/content/QrCodeElement.ts`
- `builder/layout/ColumnElement.ts`, `builder/layout/RowElement.ts`, `builder/layout/PageBreakElement.ts`, `builder/layout/SpacerElement.ts`, `builder/layout/TableElement.ts` (adapt nhẹ từ `receipt.ts`, nhưng ở mức element-class thì net-new)
- `builder/printer/CutElement.ts` (byte sequence đã biết, khái niệm element thì net-new)
- `receipt/ReceiptCell.ts`, `receipt/ReceiptLayout.ts`
- `barcode/BarcodeType.ts`, `barcode/BarcodeConfig.ts`, `barcode/BarcodeValidator.ts` (toàn bộ `barcode/`)
- `qrcode/QrCodeModel.ts`, `qrcode/QrCodeErrorCorrection.ts`, `qrcode/QrCodeConfig.ts`, `qrcode/QrCodeValidator.ts` (toàn bộ `qrcode/`)
- `image/ImageCrop.ts`, `image/ImageResize.ts`, `image/ImageSource.ts`
- `encoding/encoders/Windows1258Encoder.ts`, `encoding/encoders/Tcvn3Encoder.ts`, `encoding/encoders/Utf8Encoder.ts` (phần lớn net-new)
- `compiler/*/{Lang}Command.ts` × 9 (net-new về tổ chức, trích xuất hằng số — không phải logic mới)
- `compiler/escpos/EscPosBarcodeEncoder.ts`, `compiler/escpos/EscPosQrCodeEncoder.ts`
- `preview/PreviewResult.ts`, `preview/SvgDocument.ts`, `preview/SvgElement.ts`
- `preview/languages/DplPreviewRenderer.ts`, `preview/languages/SbplPreviewRenderer.ts`, `preview/languages/IplPreviewRenderer.ts` (không có renderer riêng để port — 3 ngôn ngữ này dùng chung `PreviewRenderer` trong portakal)
- `validation/epl/EplValidator.ts`, `validation/cpcl/CpclValidator.ts`, `validation/dpl/DplValidator.ts`, `validation/sbpl/SbplValidator.ts`, `validation/starprnt/StarPrntValidator.ts`, `validation/ipl/IplValidator.ts`, `validation/escpos/EscPosValidator.ts` (7/9 validator ngôn ngữ)
- `convert/ConversionRegistry.ts`
- `profile/PrinterVendor.ts`
- `testing/HexDump.ts`, `testing/MockPrinterTransport.ts`, `testing/PrintDataAssertion.ts` (toàn bộ `testing/`)

---

## Suggested porting order

Nguyên tắc: port từ dưới lên theo dependency graph thật (types → encoding/image → document/builder → compiler/parser/preview/validation theo ngôn ngữ → convert → profile → testing), và trong nhóm ngôn ngữ ưu tiên **ESC/POS + TSC** trước vì đây là 2 giao thức app đang dùng thật hôm nay (`src/features/printer/drivers/` theo README) — các ngôn ngữ còn lại (ZPL, EPL, CPCL, DPL, SBPL, Star PRNT, IPL) chỉ cần "giữ khả năng mở rộng", không có consumer thật ngay. `convert/` phụ thuộc vào toàn bộ compiler+parser nên phải làm sau cùng nhóm ngôn ngữ; `profile/` phụ thuộc vào types/core nhưng độc lập với compiler nên có thể song song; `testing/` không có consumer nào phụ thuộc ngược nên luôn ở cuối.

1. **`types/` + `document/`** — port các type nguyên thuỷ trước (từ `types.ts`), viết mới Point/Size/Rect/FontWeight/FontStyle; định nghĩa `PrintElement`/`ResolvedPrintDocument` (bao gồm 2 variant barcode/qrcode mới ngay từ đầu để tránh phải sửa lại union sau).
2. **`encoding/`** — port CodePage tables (CP437/858/1252/866/857) từ `encoding.ts`, viết mới Windows1258/Tcvn3/Utf8 encoder.
3. **`image/`** — port 4 thuật toán dither + packBitmap từ `image.ts`, viết mới Crop/Resize/ImageSource.
4. **`barcode/` + `qrcode/`** — viết mới hoàn toàn (không có nguồn portakal); cần trước khi builder/compiler vì `PrintElement` đã khai báo 2 variant này ở bước 1.
5. **`builder/` + `markup/` + `receipt/`** — port `LabelBuilder` từ `builder.ts`, tách content/drawing element theo builder methods hiện có; viết mới layout/ (Column/Row/PageBreak/Spacer/Table) và ReceiptBuilder/ReceiptCell/ReceiptLayout; port `markup()` từ `markup.ts` ngay sau `builder/` vì phụ thuộc trực tiếp `LabelBuilder` (thay 2 chỗ dùng `any` bằng type thật); port ReceiptFormatter/PairFormatter/TableFormatter/SeparatorFormatter/WordWrapper từ `receipt.ts`.
6. **`compiler/escpos/` + `parser/escpos/` + `validation/escpos/` + `preview/languages/EscPosPreviewRenderer.ts`** — ưu tiên số 1 vì app đang dùng thật. Nhớ sửa bug code-page (nối `EscPosCodePage` vào compiler text case) và viết mới Barcode/QrCode encoder.
7. **`compiler/tsc/` + `parser/tsc/` + `validation/tsc/` + `preview/languages/TscPreviewRenderer.ts`** — ưu tiên số 2 (giao thức thật thứ 2). `parsers/tsc.ts` là file lớn nhất (1320 dòng) — dành thời gian tương ứng.
8. **7 ngôn ngữ còn lại** (ZPL, EPL, CPCL, DPL, SBPL, Star PRNT, IPL) — mỗi ngôn ngữ lặp lại pattern compiler+parser+validator(net-new với 7/9)+preview. Có thể song song hoá theo ngôn ngữ vì độc lập với nhau. Ưu tiên ZPL trước (nhiều consumer tiềm năng nhất, printer phổ biến) rồi đến EPL/CPCL (cùng họ Zebra), sau cùng DPL/SBPL/StarPRNT/IPL (thị phần thấp hơn, và 3/4 trong số này không có preview renderer riêng để port — chỉ dùng chung `PreviewRenderer`).
9. **`convert/`** — chỉ làm sau khi toàn bộ 9 compiler + 9 parser đã port xong (phụ thuộc trực tiếp cả hai). Port `PrinterConverter` từ `convert.ts`, sau đó thiết kế mới `ConversionRegistry`/`ConversionPath` (không có nguồn thẳng).
10. **`profile/`** — độc lập với compiler/parser, có thể làm song song với bước 6-8 nếu có nhân lực. Port `PRINTER_PROFILES` tách theo vendor, viết mới `PrinterVendor` enum.
11. **`transport/`** — port thẳng (toàn bộ interface, không I/O thật), có thể làm bất kỳ lúc nào vì không phụ thuộc phần compile/parse.
12. **`testing/`** — cuối cùng, sau khi các API cần mock/assert (PrinterTransport, CompiledPrintData) đã ổn định.
