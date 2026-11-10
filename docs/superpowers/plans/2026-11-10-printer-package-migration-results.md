# Printer Package Migration — Kết quả kiểm trên máy ảo

Ngày 2026-11-10. Máy ảo `Small_Tablet` (1920×1200), APK debug build từ commit `67ffeec`, JS qua Metro qua
`adb reverse tcp:8081`, máy in LAN giả `NDTCore.Package.Printer.Native/example/scripts/fake-lan-printer.js` cổng 9100.
Máy đã lưu ở bản cũ không còn (khoá MMKV mới `printerRecords`), danh sách bắt đầu trống.

| Bước | Kịch bản | Kết quả |
|---|---|---|
| 2 | Thêm máy hoá đơn LAN `10.0.2.2:9100` | Đạt. Kết nối, dò ra ESC/POS (tự nhận diện). In thử gửi 58 301 byte. Lưu xong danh sách hiện `Đã kết nối`, `LAN · ESC/POS · Khổ 80mm`. |
| 3a | Thanh toán đơn khi có máy hoá đơn, không có máy tem | Đạt. Máy giả nhận 32 227 byte. Chỉ có snackbar "Đã tạo đơn", không cảnh báo thiếu máy tem. |
| 4 | Tắt máy giả rồi thanh toán | Đạt. Sau 30 giây chờ máy (DEVICE_WAIT_TIMEOUT_MS) snackbar báo "Hoá đơn in không thành công trên 10.0.2.2:9100: Không kết nối được máy in. In lại trong Lịch sử đơn." Danh sách hiện `Không kết nối được máy in` kèm nút `Kết nối lại`. Bật lại máy giả, bấm `Kết nối lại` → `Đã kết nối`. |
| 5 | Sửa máy: đổi khổ 58 mm, in thử, huỷ | Đạt. In thử theo cấu hình đang chỉnh gửi 38 882 byte (khổ hẹp hơn). Bấm `Quay lại` → danh sách vẫn `Khổ 80mm`. |
| 3b | Xoá máy hoá đơn rồi thanh toán | Đạt. Hộp xác nhận "đang kết nối", xoá xong thanh toán báo "Chưa thiết lập máy in cho Hoá đơn". |
| 6 | `npm run web` | Một phần. Trang mở không crash sau khi sửa `__DEV__` (xem dưới). Trang dừng ở màn đăng nhập, cần tài khoản API thật nên chưa kiểm được màn máy in và thanh toán trên web. |

## Phát hiện

- **Lỗi đã sửa (`be9a9bf`):** webpack không định nghĩa `__DEV__`, nên lời gọi `LoggerService` đầu tiên trên web ném
  `ReferenceError` và phủ overlay lỗi. Trước đây không lộ vì lõi máy in cũ không ghi log lúc khởi động; giờ
  `printerManager.initAsync()` trên web reject ("Nền tảng này không có TurboModule PrinterNative") và App ghi log lỗi.
  Đã thêm `DefinePlugin` cho `__DEV__`.
- Trên web, mỗi lần mở app ghi một dòng log `[ERROR] Khởi động máy in lỗi` vì không có native. Đúng hành vi, chỉ là log.
- LAN chỉ mở kết nối khi có việc: sau khi lưu, máy giả thấy kết nối đóng nhưng danh sách vẫn `Đã kết nối`. Đúng thiết
  kế package (USB/Bluetooth mới giữ kết nối thường trực).
- Lỗi in chỉ hiện sau 30 giây chờ máy kết nối lại; snackbar hiện 6 giây rồi tắt.

## Chưa kiểm

- Màn máy in, thêm máy và thanh toán trên web (cần đăng nhập).
- Máy tem, USB, Bluetooth, máy in thật.
