# adapters/vendor/

`IPrinterAdapter` chạy qua **SDK do hãng máy in cung cấp** (binary blob / SDK
đóng — vd XPrinter `PrinterSDK`, `libPrinterSDK.a`).

`VendorAdapter` hiện là **skeleton** — mọi I/O ném `PRINTER_UNSUPPORTED_CONNECTION`.
Khi tích hợp SDK: implement từng method + thêm nhánh `VendorAdapter` vào
[`../resolvePrinterAdapter.ts`](../resolvePrinterAdapter.ts) cho model tương ứng.

Xem [`../native/`](../native/) cho native module tự viết,
[`../library/`](../library/) cho thư viện npm.
