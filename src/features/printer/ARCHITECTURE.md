# NDTCore POS — Printer Feature

Feature `printer` của App chỉ giữ **màn hình và mẫu in**. Mọi việc với máy in (tìm thiết bị, kết nối, dò ngôn ngữ, lưu
máy, hàng đợi in, chụp mẫu thành ảnh, encode, gửi byte, theo dõi trạng thái) do package `@ndtcore/printer` làm, native
nằm ở `@ndtcore/printer-native`. App không có code Java/Kotlin nào cho máy in.

---

## 1. Ranh giới

```text
App (feature printer)                         @ndtcore/printer
─────────────────────                         ────────────────
components/, hooks/, forms/   ── gọi ──▶      printerManager   (danh sách máy, sửa, xoá, kết nối lại, USB)
templates/, models/templates/                 printerSetup     (tìm thiết bị, kết nối bản nháp, lưu máy mới)
errors/PrinterErrorMessages                   printService     (Job in, in thử, sự kiện kết quả)
                               ◀── sự kiện ── PrintCaptureHost (chụp renderer của App thành ảnh)
```

- App chỉ import từ `@ndtcore/printer`; không import file con của package, không gọi `NativeModules`.
- Package không làm UI: chữ hiển thị, câu lỗi, bố cục form đều ở App.
- Trạng thái máy in không vào Redux. Hook đọc thẳng từ package (`getPrinters()` + `subscribe`).
- Dữ liệu máy đã lưu do package giữ trong MMKV (khoá `printerRecords`). App không đọc khoá này.

---

## 2. Cấu trúc

```text
src/features/printer/
├── components/        # màn hình quản lý máy in, modal thêm/sửa, snackbar lỗi in, mẫu in thử
├── hooks/
│   ├── usePrinterList.ts          # danh sách máy, xoá, kết nối lại, gắn lại USB
│   ├── useAddPrinterFlow.ts       # toàn bộ luồng form thêm/sửa
│   └── addPrinter/
│       ├── usePrinterSetupSession.ts  # tìm thiết bị và kết nối bản nháp theo kind
│       └── useTestPrint.ts            # in thử bằng mẫu thật của App
├── forms/addPrinter/PrinterConfigForm.ts  # giá trị form ↔ PrinterConfig/PrinterConfigUpdate, gắn lỗi theo trường
├── templates/         # ReceiptTemplate, LabelTemplate, PrintLayout, PrintCodes (React, đo bằng toDp)
├── models/templates/  # nội dung đơn hàng cho mẫu (ReceiptContent, LabelContent, PrintItem...)
├── errors/PrinterErrorMessages.ts  # câu tiếng Việt cho từng mã lỗi của package
├── discovery/NetworkDiscoveryService.ts  # IP Wi-Fi của máy để gợi ý dải LAN
└── utils/printKindLabels.ts        # nhãn "Hoá đơn"/"Tem" theo PrinterKind
```

In đơn hàng nằm ở feature `cart`: `cart/services/OrderPrintTrigger.ts`.

---

## 3. Thêm và sửa máy in

```text
AddPrinterForm ─ useAddPrinterFlow(kind, initialPrinter?)
  ├─ usePrinterSetupSession ── printerSetup.start / listUsbDevices / listBluetoothDevicesAsync / connectAsync
  │                              └─ trả bản nháp Printer (deviceInfo, config dò được: lang, capabilities)
  ├─ react-hook-form ◀─ formValuesOf(draft.config) | formValuesOf(initialPrinter.config)
  ├─ In thử: basePrinter.withConfig(configUpdateOf(values)) ─ useTestPrint ─ printService.testPrintAsync
  └─ Lưu:
       thêm  → printerSetup.saveAsync(draft.copyWith(...))
       sửa   → (LAN đổi địa chỉ) printerManager.updateLanAddressAsync
               → printerManager.updateAsync(printer.withConfig(...))
```

- Form giữ số dạng chữ để ô trống được khi đang gõ; `configUpdateOf` đổi sang số, sai dạng thành `NaN` để validator
  của package báo đúng ô.
- Lỗi có `fieldErrors` từ package → `applyFieldErrors` gắn vào ô; lỗi không có ô hiện dưới nút Lưu.
- Package không dò được ngôn ngữ thì `lang` rỗng, form bắt người dùng chọn; không gửi `lang` thì package báo `REQUIRED`.
- Modal chỉ mount form khi mở, đóng là huỷ phiên kết nối bản nháp (`usePrinterSetupSession` huỷ khi unmount).

---

## 4. In đơn hàng

```text
useCheckout / useOrderHistory
  └─ printOrderAsync(receipt, labels)        (cart/services/OrderPrintTrigger)
       └─ printService: một Job "Đơn #<số>", phần hoá đơn + phần tem (bỏ phần rỗng)
            └─ package chọn máy theo kind, chụp renderer qua PrintCaptureHost, đưa vào hàng đợi từng máy
PrintFailureSnackbar ◀─ sự kiện SUB_JOB_FINISHED khác PRINTED
```

- Thanh toán không chờ in xong. Không có máy cho kind (`PRINTER_NOT_ASSIGNED`) thì không báo lỗi in, chỉ báo chưa
  cài máy.
- Kết quả `UNCERTAIN` (đã gửi một phần) báo "có thể chưa in xong" để thu ngân tự kiểm tra, không in lại tự động.
- Logo hoá đơn được `Image.prefetch` trước khi tạo Job để ảnh chụp không thiếu logo.

---

## 5. Mẫu in

- Mẫu là component React nhận nội dung và hàm `toDp`; mọi kích thước (cỡ chữ, khoảng cách, nét kẻ, mã QR/vạch) đo
  bằng dot qua `toDp` để ra đúng mm trên mọi máy.
- Hoá đơn rộng bằng vùng in package suy từ khổ giấy; tem chiếm đủ một ô tem (`flex: 1`), package lo khổ và cột.
- In thử dùng chính `SampleReceipt`/`SampleLabel` của App, cùng đường chụp ảnh với in thật.

---

## 6. Ghép package vào App

Package cài bằng `file:../NDTCore.Package/...` nên có `node_modules` riêng. Các thư viện phải chỉ có một bản (react,
react-native, react-native-mmkv, react-native-view-shot, `@ndtcore/printer-native`) được ép về `node_modules` của App
ở cả ba nơi: `metro.config.js` (`resolveRequest`), `webpack.config.js` (alias đường dẫn tuyệt đối), `jest.config.js`
(`moduleNameMapper`). `tsconfig.json` có `paths` cho `@ndtcore/printer-native`.

Trên web, package build được nhưng không in; webpack cảnh báo `PermissionsAndroid` không có trong react-native-web,
đoạn đó chỉ chạy trên Android.

---

## 7. Kiểm thử

- Hook và form test bằng package thật với dịch vụ truyền vào (tham số `manager`, `setup`, `service` có mặc định là
  instance dùng chung của package).
- Mẫu in test bằng `templates/__testing__/renderTemplate.tsx` (`toDp` cố định) và so kích thước dot.
- `__tests__/PrinterPackage.test.tsx` smoke: hook và dịch vụ của package chạy được trong cây React của App.
