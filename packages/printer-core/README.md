# printer-core

Core thuần TypeScript cho feature máy in của NDTCorePOS: mô hình document/label,
compiler + parser + validator + preview cho các ngôn ngữ máy in, mã hoá
barcode/QR/ảnh (dithering), receipt layout, printer profile theo hãng.

Mục tiêu dài hạn là mirror đầy đủ chức năng của
[portakal](https://github.com/productdevbook/portakal) (SDK ngôn ngữ máy in mã
nguồn mở, zero-dependency) — không trim bớt ngôn ngữ, để giữ khả năng mở rộng
sang các giao thức máy in khác ngoài ESC/POS + TSPL mà app đang dùng hôm nay.

> **Trạng thái hiện tại: một phần thật, phần còn lại là placeholder.** 188/253
> file `.ts` trong `src/` đã có logic thật; phần còn lại vẫn là placeholder
> (`export {}`) chờ port tiếp. Cụ thể:
>
> **Đã có logic thật:**
> - Nền tảng: types, document model, core dispatch (`PrintCompiler`/`Parser`/
>   `Preview`/`Validation` theo ngôn ngữ)
> - Encoding: code page (Cp437/858/866/857, Windows1252/1258) + tiếng Việt
>   (TCVN3, CP1258)
> - `image/`: dithering ảnh (threshold, Floyd-Steinberg, Atkinson, ordered)
> - `barcode/`, `qrcode/`: lớp mô tả + validate (chưa render ảnh module thật)
> - `receipt/`: layout công thức in hoá đơn (pair/table/separator, word wrap)
> - `profile/`: một phần — Generic/Epson/TSC có dữ liệu thật, 6 file hãng còn
>   lại (Bixolon, Citizen, Honeywell, Sato, Star, Zebra) mới là stub rỗng
> - `builder/`: fluent builder API (PrintBuilder/LabelBuilder/ReceiptBuilder)
>   và `markup/`: markup DSL kiểu HTML (`<label>...</label>`)
> - **ESC/POS** và **TSC/TSPL**: đầy đủ pipeline compile → parse → validate →
>   preview (SVG) — 2/9 ngôn ngữ máy in
>
> **Vẫn là placeholder:**
> - 7 ngôn ngữ máy in còn lại (ZPL, EPL, CPCL, DPL, SBPL, Star PRNT, IPL):
>   compiler/parser/validator/preview đều chưa có logic
> - `convert/` (cross-compiler giữa các ngôn ngữ)
> - 6 file profile hãng nêu trên (dữ liệu thật chưa có)
> - `transport/` — **chỉ định nghĩa interface theo đúng thiết kế**, I/O thật
>   (USB/BT/LAN) vẫn thuộc về `src/features/printer/` của app, không phải nợ
>   kỹ thuật
> - `testing/` (MockPrinterTransport, PrintDataAssertion, HexDump...)
>
> Có một bài test tích hợp end-to-end thật chứng minh phần đã xong hoạt động
> đúng: `src/__tests__/phase1-integration.test.ts` — dựng một document thật,
> compile ra cả ESC/POS lẫn TSC, parse ngược, rồi validate.
>
> **Chưa có consumer nào dùng package này** — `src/features/printer/` của app
> hiện vẫn giữ logic trùng lặp của riêng nó. Việc chuyển app sang dùng
> `printer-core` thay vì logic riêng là việc khác, để sau.
>
> **Giới hạn đã biết:** chuỗi string mà `TscCompiler.compile()` trả về trộn
> lẫn hai kiểu encoding byte khác nhau (text UTF-8 và payload bitmap dạng
> latin-1 one-char-per-byte) khi document có element ảnh — xem JSDoc trên
> `TscCompiler.compile()` (`src/compiler/tsc/TscCompiler.ts`) để biết chi tiết
> trước khi dùng output TSC compile ra để gửi máy in thật.

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
├── core/             # PrinterLanguage, PrintCompiler/Parser/Preview/Validation — entrypoint theo ngôn ngữ
├── types/            # Point, Size, Rect, Unit, Alignment, Rotation, Direction, FontWeight, FontStyle, Bitmap
├── document/          # PrintDocument, PrintDocumentOptions, ResolvedPrintDocument
├── builder/          # PrintBuilder, LabelBuilder, ReceiptBuilder, PrintElement(Type) + content/, drawing/, layout/, printer/
├── markup/            # HTML-like markup DSL (<label>...</label>) parse thành LabelBuilder
├── receipt/           # ReceiptLayout, formatter (pair/table/separator), WordWrapper — receipt-mode layout
├── barcode/           # BarcodeType, BarcodeConfig, BarcodeValidator
├── qrcode/            # QrCodeModel, QrCodeErrorCorrection, QrCodeConfig, QrCodeValidator
├── image/             # MonochromeBitmap, Rgba/Resize/Crop/Transform/Threshold/Dither + dithering/ (4 thuật toán)
├── encoding/          # CodePage, CodePageEncoder + encoders/ (Utf8, Cp437/858/866/857, Windows1252/1258, Tcvn3)
├── compiler/          # PrinterCompiler + 1 thư mục/ngôn ngữ: tsc, zpl, epl, escpos, cpcl, dpl, sbpl, starprnt, ipl
├── parser/            # PrinterParser + 1 thư mục/ngôn ngữ (parse ngược lệnh máy in → structured data)
├── preview/           # PreviewRenderer (SVG) + languages/ (font metrics riêng từng ngôn ngữ)
├── validation/        # PrinterValidator + 1 thư mục/ngôn ngữ (validate lệnh trước khi gửi máy in)
├── convert/           # PrinterConverter — cross-compiler giữa các ngôn ngữ
├── profile/           # PrinterProfile, PrinterProfileResolver + profiles/ theo hãng (Epson, Star, Zebra, TSC...)
├── transport/         # PrinterTransport (interface), Usb/Bluetooth/NetworkTransport (interface only)
└── testing/           # MockPrinterTransport, PrintDataAssertion, HexDump — helper cho test
```

## Scripts

```bash
npm run type-check -w printer-core   # tsc --noEmit
```

## Quy ước

Theo quy ước chung của repo (xem `../../CLAUDE.md`, `../../docs/CODING_STANDARDS_TS.md`):
TypeScript strict, không dùng `any`, comment chỉ khi WHY không rõ, không import
theo alias — dùng relative path.
