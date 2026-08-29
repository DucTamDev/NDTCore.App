# adapters/library/

`IPrinterAdapter` chạy qua **thư viện npm generic** — không riêng máy in:

- `react-native-tcp-socket` (LAN)
- `react-native-bluetooth-classic` (Bluetooth)

`LibraryAdapter` bọc `transports/LanTransport` + `transports/BluetoothTransport`.
Đọc được phản hồi (`read`) → TSPL dùng adapter này cho BLE/LAN (cần cho
`identify` `~!T`). KHÔNG hỗ trợ USB.

Xem [`../native/`](../native/) cho native module tự viết,
[`../vendor/`](../vendor/) cho SDK hãng.
