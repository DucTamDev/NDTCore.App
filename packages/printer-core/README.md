# printer-core

Core thuần TypeScript cho feature máy in của NDTCorePOS: mô hình document/label,
compiler + parser + validator + preview cho 9 ngôn ngữ máy in, mã hoá
barcode/QR/ảnh (dithering), receipt layout, printer profile theo hãng.

Mirror lại đầy đủ chức năng của [portakal](https://github.com/productdevbook/portakal)
(SDK ngôn ngữ máy in mã nguồn mở, zero-dependency) — không trim bớt ngôn ngữ, để
giữ khả năng mở rộng sang các giao thức máy in khác ngoài ESC/POS + TSPL mà app
đang dùng hôm nay.

> **Trạng thái hiện tại: chỉ là khung thư mục (scaffold).** Toàn bộ file trong
> `src/` là placeholder (`export {}`) — logic thật (encoder ESC/POS/TSPL hiện có
> ở `src/features/printer/drivers/`, bitmap ở `utils/`, barcode ở `rendering/`...)
> sẽ được di dời/viết lại dần vào đây trong các task tiếp theo. Không có hành vi
> nào của `src/features/printer` bị thay đổi bởi package này.

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
├── document/          # PrintDocument, PrintDocumentOptions, PrintElement(Type), ResolvedPrintDocument
├── builder/          # PrintBuilder, LabelBuilder, ReceiptBuilder + content/, drawing/, layout/, printer/
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
