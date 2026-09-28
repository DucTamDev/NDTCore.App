# printer-core Registry + Core (R2) — Design Spec

Đợt R2 của `2026-09-26-printer-core-restructure-overview.md`. Áp dụng các quy tắc chung ghi trong file tổng đó. Code mới
và file bị chuyển/tách theo quy tắc "1 file = 1 khái niệm" ngay từ đợt này.

## Mục tiêu

1. **1 registry duy nhất** cho cả dispatch (`compileTo`/`parseFrom`/`validateFor`/`previewFor`) và `convert()`. Thêm
   1 ngôn ngữ chỉ sửa 1 chỗ.
2. **Kết quả parse chung** cho mọi ngôn ngữ: `commands`, `elements`, `widthDots?`, `heightDots?`, `warnings`. Mỗi
   parser tự nhận cả chuỗi lẫn byte.
3. **`core/` chỉ còn contract**: registry và dispatch chuyển sang thư mục mới `registry/`.
4. **Bỏ code đổi chuỗi ↔ byte lặp lại** ở 3 nơi.

## Hiện trạng (lý do)

- `core/LanguageRegistry.ts` và `convert/ConversionRegistry.ts` khai báo song song parse/compile của từng ngôn ngữ;
  `ConversionRegistry` còn tạo compiler mới mỗi lần convert.
- `PrintParser` chỉ trả `commands`/`warnings` (`ParsedCommands`), nên `convert` phải gọi thẳng `parseTSPL`/`decodeEscPos`
  để lấy `elements` và khổ tem.
- **Lỗi thật:** `parseFrom('escpos', chuỗi)` không đọc được lệnh nào. `EscPosParser.parse` chỉ xử lý `Uint8Array`;
  phần đổi chuỗi 1 ký tự = 1 byte sang byte chỉ nằm trong `ConversionRegistry`.
- `core/LanguageRegistry.ts` import compiler/parser/validator/preview cụ thể, nên `core/` không còn là contract thuần.
- `TsplValidator` import thẳng `../../../language/tspl/TsplParser` thay vì qua barrel.
- Code đổi chuỗi nhị phân ↔ byte lặp ở `ConversionRegistry.toBytes`, `EscPosValidator.bytesFromSource`,
  `PrinterConverter.bytesToBinaryString`.

## Ngoài phạm vi

- Đổi tên `TSPLCommand`/`TSPLParseResult` sang dạng `Tspl...`, tách `TsplParser.ts` — để R4.
- Tách file theo khái niệm ở ngoài `core/`, `registry/`, `convert/` và các file mới — để R5.
- Gộp code preview — để R3.
- Lỗi CP1258 không nằm trong `CODE_PAGE_LIST` — việc riêng, cần quyết định hành vi in.

## Thiết kế

### 1. Kết quả parse chung (`core/`)

```ts
// core/ParseResult.ts
/** Kết quả chung mà parser của mọi ngôn ngữ trả. */
export interface ParseResult<TCommand = unknown> {
  /** Lệnh đọc được theo thứ tự xuất hiện; cấu trúc từng lệnh riêng theo ngôn ngữ. */
  commands: TCommand[];

  /** Element dựng lại được từ lệnh. */
  elements: PrintElement[];

  /** Khổ ngang (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo khổ, để phân biệt với giá trị 0 thật. */
  widthDots?: number;

  /** Chiều dài tem (dots); bỏ trống khi ngôn ngữ không có lệnh khai báo, để phân biệt với giá trị 0 thật. */
  heightDots?: number;

  /** Lệnh không nhận diện được hoặc dữ liệu hỏng gặp khi parse. */
  warnings: string[];
}

// core/PrintParser.ts
/** Đọc ngược lệnh máy in thành cấu trúc để kiểm tra hoặc chuyển sang ngôn ngữ khác. */
export interface PrintParser<TCommand = unknown> {
  parse(source: string | Uint8Array): ParseResult<TCommand>;
}
```

- Bỏ `ParsedCommands`.
- `PrinterLanguageDefinition.parser` có kiểu `PrintParser` (tức `PrintParser<unknown>`).

### 2. Parser của TSPL và ESC/POS

- **TSPL:**
  - `TsplParser implements PrintParser<TSPLCommand>`.
  - `parse()` trả `TSPLParseResult`, là `ParseResult<TSPLCommand>` với `widthDots`/`heightDots` bắt buộc và thêm `dpi`.
  - Byte vào được giải mã UTF-8 như hiện nay.
- **ESC/POS:**
  - `EscPosParser implements PrintParser<EscPosParsedCommand>`.
  - `parse(source: string | Uint8Array)`: chuỗi đọc theo quy ước 1 ký tự = 1 byte qua `binaryStringToBytes`.
  - Trả `ParseResult<EscPosParsedCommand>`, không có `widthDots`/`heightDots`. Bỏ kiểu `EscPosParseResult`.
- **Đầu vào công khai duy nhất là class parser:** `parseTSPL` và `decodeEscPos` thành hàm nội bộ của file (bỏ `export`).
- **`TsplValidator`** parse bằng `new TsplParser()` import qua barrel `language`.

### 3. Chuỗi nhị phân ↔ byte (`encoding/`)

2 hàm, mỗi hàm 1 file, export qua barrel `encoding`:

- `binaryStringToBytes(source: string): Uint8Array` — mỗi ký tự thành 1 byte (`charCodeAt & 0xff`). Không giải mã
  UTF-8 vì sẽ làm hỏng mọi byte ≥ 0x80.
- `bytesToBinaryString(bytes: Uint8Array): string` — mỗi byte thành 1 ký tự.

Nơi dùng:
- `EscPosParser` và `EscPosValidator` (thay `bytesFromSource`) dùng `binaryStringToBytes`.
- `convert()` dùng `bytesToBinaryString`.

### 4. Thư mục `registry/`

| File | Nội dung |
|---|---|
| `LanguageRegistry.ts` | `LANGUAGE_REGISTRY`, chuyển nguyên từ `core/` (giữ mapped type buộc `language` trùng key) |
| `SupportedLanguages.ts` | `SUPPORTED_LANGUAGES: readonly PrinterLanguage[]`, lấy từ key của `LANGUAGE_REGISTRY` |
| `lookupLanguage.ts` | Tra 1 ngôn ngữ, ném `UnsupportedLanguageError(language, capability)` nếu không có. Chỉ dùng trong `registry/`, không export qua barrel |
| `compileTo.ts` | `compileTo(language, document, features?)`, chữ ký giữ nguyên |
| `parseFrom.ts` | `parseFrom(language, source): ParseResult` |
| `validateFor.ts` | `validateFor(language, source)`, chữ ký giữ nguyên |
| `previewFor.ts` | `previewFor(language, document)`, chữ ký giữ nguyên |
| `index.ts` | Barrel: `LANGUAGE_REGISTRY`, `SUPPORTED_LANGUAGES`, 4 hàm dispatch |

`src/index.ts` export thêm `./registry`. Chiều phụ thuộc: `core` ← `language`/`validation`/`preview` ← `registry` ←
`convert`.

### 5. `core/` sau đợt này

| File | Nội dung |
|---|---|
| `PrinterLanguage.ts` | Giữ nguyên |
| `CompileResult.ts` | Tách từ `PrintCompiler.ts` |
| `PrintCompiler.ts` | Chỉ còn `PrintCompiler` |
| `ParseResult.ts` | Mới (mục 1) |
| `PrintParser.ts` | `PrintParser<TCommand>` (mục 1) |
| `PrintValidation.ts`, `PrintPreview.ts` | Giữ nguyên |
| `PrinterFeatures.ts` | Giữ chung `CutterType`/`ImageMode` (ngoại lệ union nhỏ chỉ dùng cho nó) |
| `PrinterLanguageDefinition.ts` | `parser: PrintParser` |
| `UnsupportedLanguageError.ts` | Đổi tên từ `PrinterCoreError.ts` cho trùng tên export |

Xoá khỏi `core/`: `LanguageRegistry.ts`, `LanguageDispatch.ts` (chuyển sang `registry/`).

### 6. `convert/` sau đợt này

- `convert(source, from, to)`: `parseFrom(from, source)` → dựng `ResolvedPrintDocument` với thiết lập mặc định như
  hiện nay → `compileTo(to, document)` → output byte đổi bằng `bytesToBinaryString`.
- Xoá `ConversionRegistry.ts` (`ConversionRegistry`, `ParsedSource`, `ConversionRegistryEntry`) và `ConversionPath.ts`
  (`ConversionPath` không ai dùng; `SUPPORTED_SOURCES`/`SUPPORTED_TARGETS` thay bằng `SUPPORTED_LANGUAGES` vì mọi ngôn
  ngữ đều vừa làm nguồn vừa làm đích).
- Giữ `PrinterConverter.ts` (`convert` + hằng số mặc định) và `ConversionResult.ts`.
- Ngôn ngữ lạ vẫn ném `UnsupportedLanguageError`; thông báo đổi từ "conversion source/target" thành "parser"/"compiler".

### 7. `printer-preview`

`App.tsx` dùng `SUPPORTED_LANGUAGES` thay cho danh sách viết tay `['tspl', 'escpos']`.

## API đổi có chủ đích

1. Bỏ `ParsedCommands`; thêm `ParseResult<TCommand>`; `PrintParser<TResult>` thành `PrintParser<TCommand>`.
2. `parseFrom` trả `ParseResult` (thêm `elements`, `widthDots?`, `heightDots?`).
3. Không export `parseTSPL`, `decodeEscPos`, `EscPosParseResult`.
4. Bỏ `ConversionRegistry`, `ParsedSource`, `ConversionRegistryEntry`, `ConversionPath`, `SUPPORTED_SOURCES`,
   `SUPPORTED_TARGETS`; thêm `SUPPORTED_LANGUAGES`.
5. Thêm `binaryStringToBytes`, `bytesToBinaryString`.
6. `parseFrom('escpos', chuỗi)` đọc được lệnh (sửa lỗi).

Hành vi compile, preview, validate và `convert()` của TSPL/ESC-POS không đổi: cùng đầu vào → cùng output và cùng cảnh
báo. Chỉ thông báo lỗi ngôn ngữ lạ trong `convert` đổi chữ.

## Test

- **Chỉ sửa đường import:**
  - `core/__tests__/LanguageDispatch.test.ts` chuyển sang `registry/__tests__/LanguageDispatch.test.ts`.
  - `__tests__/phase2-integration.test.ts`, `convert/__tests__/PrinterConverter.test.ts` import từ `registry/` và
    `core/UnsupportedLanguageError`.
- **Sửa kỳ vọng vì API đổi:**
  - Test `SUPPORTED_SOURCES`/`SUPPORTED_TARGETS` đổi thành test `SUPPORTED_LANGUAGES` lấy từ `LANGUAGE_REGISTRY`.
  - `TsplParser.test.ts`: gọi `parseTSPL(x)` đổi thành `new TsplParser().parse(x)`.
- **Test mới:**
  - `parseFrom('escpos', chuỗi 1 ký tự = 1 byte)` cho cùng `commands`/`elements` như khi đưa byte.
  - `parseFrom('tspl', …)` trả `elements` và `widthDots`/`heightDots`.
  - `binaryStringToBytes`/`bytesToBinaryString` giữ đúng byte ≥ 0x80 và là nghịch đảo của nhau.
- Các test compile, convert, preview, validate hiện có giữ nguyên và phải xanh; `printer-preview` type-check + Vitest xanh.

## Tiêu chí hoàn thành

- `core/` không import `language/`, `validation/`, `preview/`, `registry/`, `convert/` (trừ import type `document`,
  `validation` cho contract).
- Không còn `ConversionRegistry`, `ParsedCommands`, `parseTSPL`/`decodeEscPos` export trong `printer-core/src`.
- tsc 0 lỗi, jest xanh, eslint 0 lỗi, `printer-preview` xanh, dòng ≤ 120 ký tự.
