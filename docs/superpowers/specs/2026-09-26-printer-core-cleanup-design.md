# printer-core Cleanup (R1) — Design Spec

Đợt R1 của `2026-09-26-printer-core-restructure-overview.md`. Áp dụng các quy tắc chung ghi trong file tổng đó.

## Mục tiêu

`printer-core` chỉ còn những gì app dùng hoặc sắp dùng:

1. Chỉ giữ 2 ngôn ngữ máy in TSPL và ESC/POS.
2. Không còn code chết.
3. API công khai không lộ helper của test.
4. README và comment mô tả đúng hiện trạng, theo quy ước viết comment.

## Ngoài phạm vi

- **Đổi API của registry/dispatch/convert** — để R2. `compileTo`, `parseFrom`, `validateFor`, `previewFor`, `convert` giữ chữ ký; chỉ tập ngôn ngữ nhận vào hẹp lại.
- **Gộp code preview** — để R3.
- **Tách `TsplParser`** — để R4.
- **Tách file theo khái niệm, bỏ `export` của hàm chỉ dùng trong file** — để R5.
- **Xử lý ảnh chưa ai gọi** (`cropRgba`, `resizeNearestNeighbor`, `imageToMonochrome`, `toGrayscale`, `ImageSource`): giữ lại, sub-spec D cần để in logo.
- **Validator barcode/QR** (`validateBarcodeConfig`, `validateQrCodeConfig`, `QrCodeModel`): giữ lại, gắn vào validate ở đợt sau.

## Thiết kế

### 1. Xoá 7 ngôn ngữ (ZPL, EPL, CPCL, DPL, SBPL, Star PRNT, IPL)

**Xoá toàn bộ thư mục** của 7 ngôn ngữ, kể cả `__tests__` bên trong:
- `language/{zpl,epl,cpcl,dpl,sbpl,starprnt,ipl}/`
- `preview/languages/{zpl,epl,cpcl,dpl,sbpl,starprnt,ipl}/`
- `validation/languages/{zpl,epl,cpcl,dpl,sbpl,starprnt,ipl}/`

**Xoá preview SVG dùng chung** `preview/PreviewRenderer.ts` và test của nó. Chỉ preview DPL, SBPL, IPL dùng file này.

**Sửa chỗ tham chiếu:**

| Chỗ | Thay đổi |
|---|---|
| `core/PrinterLanguage.ts` | `PrinterLanguage = 'tspl' \| 'escpos'` |
| `core/LanguageRegistry.ts` | Chỉ còn mục `tspl`, `escpos` |
| `convert/ConversionRegistry.ts` | Chỉ còn mục `tspl`, `escpos`; bỏ comment so sánh với portakal |
| `convert/PrinterConverter.ts`, `convert/ConversionResult.ts` | Bỏ chỗ nhắc tên các ngôn ngữ đã xoá trong comment |
| `language/index.ts`, `preview/languages/index.ts`, `validation/index.ts`, `preview/index.ts` | Bỏ export của phần đã xoá |
| `packages/printer-preview/src/App.tsx` | Danh sách chọn ngôn ngữ chỉ còn `tspl`, `escpos` |

**Giữ nguyên** vì TSPL/ESC-POS còn dùng: `language/BitmapFont.ts` (TSPL), `language/MagnifiedFont.ts` (ESC/POS), `language/CompileWarnings.ts`.

**Test tham chiếu nhiều ngôn ngữ:**
- `__tests__/phase2-integration.test.ts`, `core/__tests__/LanguageDispatch.test.ts`, `convert/__tests__/PrinterConverter.test.ts`: bỏ các ca của ngôn ngữ đã xoá, giữ nguyên các ca TSPL/ESC-POS.
- `language/__tests__/CompileWarnings.test.ts` chỉ dùng tên ngôn ngữ làm chuỗi hiển thị → giữ nguyên.

### 2. Xoá code chết (kèm test của chúng)

| Chỗ | Xoá |
|---|---|
| `receipt/` | Cả thư mục (`ReceiptLayout`, `layoutToRow`) |
| `document/PrintDocument.ts` | File + export |
| `document/__tests__/PrintDocument.test.ts` | Giữ file (đang kiểm tra `PrintElement`/`ResolvedPrintDocument`); chỉ đổi tên `describe` nếu còn nhắc `PrintDocument` |
| `formatting/PairFormatter.ts`, `SeparatorFormatter.ts`, `WordWrapper.ts` | Cả 3 file (`formatPair`, `separator`, `wordWrap`) |
| `testing/PrintDataAssertion.ts`, `testing/HexDump.ts` | Cả 2 file |
| `language/tspl/TsplParser.ts` | Hàm `parseTsplSummary` |
| `encoding/CodePageEncoder.ts` | Hàm `isASCII` |
| `encoding/encoders/Tcvn3Encoder.ts` | Hàm `encodeTcvn3` (giữ phần encoder đang được dùng) |
| `types/FontStyle.ts`, `types/FontWeight.ts` | Cả 2 file |
| `document/elements/layout/PageBreakElement.ts` | Type `PageBreakOptions` (không có chỗ nào dùng) |
| `language/tspl/TsplCommand.ts` | Type `TsplCommandName` |

Trước khi xoá từng mục phải grep lại toàn repo, cả `printer-preview`. Mục nào hoá ra có người dùng thì giữ và ghi lại trong plan.

### 3. `testing/` không lộ ra API công khai

- Bỏ `export * from './testing'` trong `src/index.ts`.
- Test vẫn import `testing/` bằng đường dẫn tương đối như hiện nay.
- `testing/` chỉ còn `OrderTestCatalog.ts` (catalog đơn hàng + data mẫu dùng chung cho test).

### 4. README

- **Giới thiệu:** printer-core hỗ trợ TSPL + ESC/POS. Bỏ mục tiêu "mirror đầy đủ portakal", danh sách 9 ngôn ngữ, và phần kể lịch sử port.
- **Trạng thái / giới hạn đã biết:** chỉ nói về 2 ngôn ngữ.
- **Cây thư mục:** đúng với code sau R1. Bỏ `receipt/`, các ngôn ngữ đã xoá, `document/builder`/`markup`, `PreviewRenderer.ts` chung.
- **Bảng cảnh báo compile:** còn 2 dòng TSPL, ESC/POS.

### 5. Comment trong code còn lại

- **Phạm vi:** mọi file nguồn (không phải test) còn lại trong `packages/printer-core/src`.
- **Việc cần làm:**
  - Comment tiếng Anh → tiếng Việt.
  - Bỏ câu kể lịch sử: "port từ portakal", "trước đây…", "giống upstream…".
  - Bỏ câu mô tả lại code.
  - Chỉ giữ WHY: ràng buộc protocol, giới hạn phần cứng, hành vi không hiển nhiên.
- **Không đụng tới:**
  - JSDoc đã đúng quy ước.
  - Tên test (`it(...)`, `describe(...)`), vì test giữ nguyên như hiện tại.

## Kiểm chứng

- **Type-check `printer-core`:** `tsc --noEmit` sạch.
- **Test `printer-core`:** toàn bộ xanh. Số test giảm đúng bằng test của phần đã xoá; không test nào của phần còn lại bị xoá hay đổi kỳ vọng.
- **Không đổi hành vi TSPL/ESC-POS:** compile/parse/validate/preview của TSPL và ESC/POS cho kết quả như trước. Test hiện có của 2 ngôn ngữ giữ nguyên là bằng chứng.
- **`printer-preview`:** type-check sạch, Vitest xanh.
- **eslint** 0 lỗi; dòng mới/sửa ≤ 120 ký tự.
- **grep không còn tham chiếu:** không còn `zpl|epl|cpcl|dpl|sbpl|starprnt|ipl` (trừ chuỗi hiển thị trong test `CompileWarnings`), `PrintDocument`, `receipt`, `PrintDataAssertion`, `HexDump`, `portakal`.

## Rủi ro

- **Mất khả năng in ra 7 ngôn ngữ kia.** Muốn dùng lại thì phải khôi phục từ lịch sử git — chấp nhận, vì app chỉ dùng TSPL và ESC/POS.
- **Số test giảm mạnh:** khoảng 350 test bị xoá theo code (323 test trong thư mục 7 ngôn ngữ, 10 test preview dùng chung, cộng các ca của 7 ngôn ngữ trong test tích hợp/dispatch/convert).
