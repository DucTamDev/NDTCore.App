# Thiết kế: chuyển `features/printer` của App sang package máy in

## Bối cảnh

App đang tự làm toàn bộ việc in: native Java (`com.ndtcorepos.bridge`, `device`), kết nối, dò ngôn ngữ, hàng đợi,
chụp ảnh, dựng lệnh ESC/POS/TSPL, lưu máy in. Package `NDTCore.Package` (repo riêng, cùng thư mục cha) đã làm lại phần
này: `@ndtcore/printer-native` (TurboModule Java) và `@ndtcore/printer` (JS). Nguồn chính của package là
`NDTCore.Package/docs/05-technical/tsd.md` (TSD 1.10).

Mục tiêu: App chỉ còn UI, mẫu in và dữ liệu đơn; mọi việc với máy in đi qua package.

## Quyết định

| # | Quyết định | Lý do |
|---|---|---|
| D1 | App phụ thuộc package bằng `file:../NDTCore.Package/NDTCore.Package.Printer` và `file:../NDTCore.Package/NDTCore.Package.Printer.Native` | Hai repo cùng thư mục cha, package chưa phát hành npm |
| D2 | Bỏ toàn bộ phần App đã có trong package: native Java máy in, `adapters/`, `connection/`, `detection/`, `discovery/DeviceDiscoveryService`, `permissions/`, `printing/`, `storage/`, `languages/`, `rendering/`, `usePrintImageCapture`, `printerSlice`, model kết nối, thiết bị, giấy, lệnh in | Package làm thay; giữ hai bản là hai nơi sửa lỗi |
| D3 | Giữ ở App: UI quản lý máy in, mẫu `ReceiptTemplate`/`LabelTemplate`, `TemplateDefaults`, dữ liệu đơn (`OrderPrintTrigger` dựng nội dung), gợi ý IP Wi-Fi (`NetworkDiscoveryService`) | Package không làm UI và không biết nội dung đơn |
| D4 | Mẫu in đo bằng dot chuẩn (1/8 mm) qua `usePrintRenderContext().toDp`; số trong mẫu và `TemplateDefaults` giữ nguyên | Mẫu App vốn viết theo 8 dot/mm (TSD 9.6) |
| D5 | Bỏ công tắc bật/tắt máy in (`enabled`) | Package không có; user chốt bỏ |
| D6 | Không chuyển dữ liệu máy in đã lưu; người dùng thêm lại sau khi cập nhật | Cấu hình package khác khuôn dạng; user chốt |
| D7 | Không đưa vào package: tem trên giấy cuộn cao theo nội dung, cắt theo job (`PerJob`/`PerRow`), ngắt kết nối thủ công, ngăn kéo tiền, `color`/`image`. App bỏ khỏi form và danh sách | Tem giấy cuộn dùng `rowGapMm = 0` (tem cao cố định); package cắt sau mỗi tờ hoá đơn; package tự quản kết nối, App dùng `reconnectAsync`; ngăn kéo tiền chưa nơi nào dùng |
| D8 | Thêm vào package: vùng in khổ 100 mm = 96 mm, 104 mm = 104 mm | Không có thì máy khổ 104 mm in hẹp hơn hiện tại 8 mm |
| D9 | Bản web: package không có native; `@ndtcore/printer-native` có `NativePrinterNative.web.ts` trả `null`, mọi hàm máy in báo `PLATFORM_UNSUPPORTED`; App web vẫn build và chạy được, màn máy in báo không hỗ trợ | App đang có bản web |
| D10 | Package xuất `renderWithContext` ra API công khai | App cần dựng mẫu trong context khi test và khi xem trước |
| D11 | Mỗi đơn là một Job: `printService.printAsync({ title, parts: [hoá đơn, tem] })`; package tự chụp tuần tự, App bỏ chuỗi `printOrderChain` | Package giữ thứ tự Job và một khung chụp (`PrintCaptureHost`) |
| D12 | Cảnh báo "Chưa thiết lập máy in cho Hoá đơn" tính ngay lúc bấm in từ `printerManager.getPrinters()`; lỗi in đến sau qua `printService.subscribe` và snackbar | `printAsync` trả về khi Job vào hàng, kết quả đến sau |
| D13 | Lỗi package hiện cho người dùng bằng một bảng mã → câu tiếng Việt ở App, đủ 26 mã public (TSD 12.3) | Package trả mã, không trả câu cho người dùng |
| D14 | Package đổi `printerManager.testPrintAsync(printerId, renderers, printer?)` thành `(printerId, renderers, changes?: PrinterChanges)` | App không tạo được `Printer` cho cấu hình đang chỉnh của máy đã lưu (`Printer.createUnsaved` không công khai); `changes` cùng kiểu với `updateAsync` |

## Ánh xạ tính năng

| App hiện tại | Sau khi chuyển |
|---|---|
| Danh sách máy, trạng thái `ConnectionStatus` | `printerManager.getPrinters()`, `subscribe`; trạng thái `Printer.status` (`ConnectionState`, `errorCode`, `actions`) |
| Nút kết nối / ngắt / kết nối lại | Chỉ "Kết nối lại" khi `actions` có `PrinterAction.Reconnect`; thêm "Chọn lại máy USB" khi có `PrinterAction.RebindUsb` |
| Xoá máy | `printerManager.removeAsync` |
| Thêm máy: tìm USB/Bluetooth, nhập LAN, kết nối, dò ngôn ngữ | `printerSetup.start(kind)`, `listUsbDevices`, `listBluetoothDevicesAsync`, `checkLanAddress`, `connectAsync` (trả `lang` dò được) |
| Cấu hình giấy, tên, ngôn ngữ, dao cắt | `getDefaultPrinter()` rồi `saveAsync(printer)`; sửa máy đã lưu bằng `printerManager.updateAsync(printerId, changes)` |
| In thử `SampleReceipt` / `SampleLabel` | `printerSetup.testPrintAsync(printer, renderers)`, `printerManager.testPrintAsync(printerId, renderers, changes?)` |
| In đơn, in lại | `printService.printAsync` |
| Snackbar lỗi in | `printService.subscribe`, sự kiện `SUB_JOB_FINISHED` có `outcome` khác `PRINTED` |
| Khung chụp ở `CartPanel`, `OrderHistoryPanel` | Một `PrintCaptureHost` ở gốc app |

## Ngoài phạm vi

- Sự kiện phần cứng (hết giấy, mở nắp) trên UI App: package đã phát, App chưa hiện.
- iOS: package chỉ Android, App iOS không in được như hiện tại.
- Thử trên máy in thật: theo danh sách máy của package (G7).
