# Thiết Kế: Thiết Kế Lại Chức Năng & UI "Thêm Máy In"

> **Scope:** Chỉnh sửa `NDTCore.App` — thay `AddPrinterModal` (form nhập liệu) bằng wizard kết nối-trước-cấu hình-sau. Kế thừa kiến trúc Phase 1 (`docs` gốc: `2026-07-30-pos-app-phase1-printer-management-design.md` trong repo `NDTCore` chính).

---

## 1. Bối Cảnh & Mục Đích

Phase 1 đã implement `AddPrinterModal` dạng form: người dùng tự nhập `printerType` (Receipt/Label) rồi hệ thống suy ra `protocol` (escpos/tspl) theo mapping cứng `printerType → protocol`. Cách này bắt người dùng biết trước máy in của mình dùng protocol gì — không đúng thực tế sử dụng (người bán hàng không biết ESC/POS hay TSPL là gì).

Thiết kế lại theo chuẩn app POS thương mại: người dùng chỉ cần **chọn kiểu kết nối → chọn thiết bị → bấm kết nối**; hệ thống tự nhận diện Protocol từ thông tin thiết bị đọc được sau khi kết nối thành công. Chỉ hỏi người dùng khi không tự nhận diện được.

---

## 2. Phạm Vi

**Trong phạm vi:**
- Bỏ trường `printerType` khỏi `PrinterConfig` và toàn bộ UI liên quan.
- Thêm cơ chế tự nhận diện Protocol (ESC/POS, TSPL) sau khi kết nối, dựa trên bảng mapping vendor/model hardcode.
- Viết lại `AddPrinterModal` thành wizard nhiều bước (dùng chung cho Thêm và Sửa).
- Mở rộng `IPrinterDriver` (`identify()`), `PrinterService` (`discoverProtocol()`).
- Icon trong `PrinterListItem` suy ra từ `protocol` thay vì `printerType`.

**Ngoài phạm vi (tường minh):**
- ZPL protocol/driver — không làm lần này, kiến trúc chỉ cần không cản trở việc thêm sau này.
- Mapping table động (lưu MMKV, có UI quản trị chỉnh sửa) — Phase này hardcode trong code, cập nhật bằng sửa code + release bản mới.
- Auto-reconnect theo hardware event thật — không đổi so với Phase 1 (chỉ auto-reconnect lúc khởi động app / theo thao tác người dùng).
- Các thao tác trên `PrinterListItem` đã có (Kết nối/Ngắt/Kết nối lại/Đặt mặc định/Xóa) — giữ nguyên, dùng thẳng `protocol` đã lưu, không qua wizard.

---

## 3. Data Model

`PrinterConfig` bỏ `printerType`, thêm `protocolSource` và `deviceInfo`:

```ts
export interface PrinterDeviceInfo {
  deviceName?: string;
  vendor?: string;
  model?: string;
}

export type ProtocolSource = 'auto' | 'manual';

export interface PrinterConfig {
  id: string;
  printerName: string;           // Display Name — user sửa được
  protocol: Protocol;
  protocolSource: ProtocolSource; // hiện badge "Tự động nhận diện" / "Người dùng chọn"
  connectionType: ConnectionType;
  paperSize: PaperSize;
  autoReconnect: boolean;
  isDefault: boolean;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  deviceInfo?: PrinterDeviceInfo;  // MỚI — đọc được sau khi connect+identify
}
```

`PrinterType` bị xoá khỏi `printer.types.ts`. Icon trong `PrinterListItem` map trực tiếp từ `protocol`: `escpos → 'receipt'`, `tspl → 'label'` (dùng function `iconForProtocol(protocol)` thay cho việc đọc `printerType`).

---

## 4. Driver Contract & Protocol Detection

### 4.1 `IPrinterDriver` — thêm method mới

```ts
identify(printerId: string): Promise<PrinterDeviceInfo | null>;
```

Gọi ngay sau `connect()` thành công trong bước dò tìm. Trả về `null` hoặc field rỗng nếu driver/SDK không cung cấp được thông tin. **Xác nhận protocol tự thân từng driver** — `identify()` trả về thông tin thật (không `null`) nghĩa là driver đó xác nhận đúng protocol; bảng mapping (mục 4.3) **không** tham gia vào việc xác nhận, chỉ dùng để sắp thứ tự thử (mục 4.2).

**EscPosDriver.identify()**: dùng lệnh đọc ID máy in nếu `react-native-esc-pos-printer` hỗ trợ (cần verify API thực tế khi implement — xem Rủi ro mục 8).

**TsplDriver.identify()**: gửi lệnh trạng thái/tự nhận dạng nếu firmware phản hồi được; nhiều máy in TSPL giá rẻ **không phản hồi** — driver trả `null`, không coi là lỗi.

### 4.2 Thuật toán `PrinterService.discoverProtocol()`

```ts
type DiscoveryStage = 'connecting' | 'identifying' | 'identified' | 'unknown_protocol' | 'error';

interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: Protocol;
  deviceInfo?: PrinterDeviceInfo;
  error?: AppError;
}

discoverProtocol(
  input: { connectionType: ConnectionType; device?: PrinterDevice; lan?: PrinterLanConfig },
  onEvent: (event: DiscoveryEvent) => void,
): Unsubscribe
```

Thuật toán (event-driven, không polling — đúng Global Constraint Phase 1):

1. **Lấy danh sách candidate protocol theo thứ tự ưu tiên**: tra `PrinterDetectionRules` (mục 4.3) theo vendor/model đã biết từ OS (USB descriptor, tên thiết bị Bluetooth) — luật khớp đầu tiên (ưu tiên khớp cả vendor+model, sau đó vendor-only, cuối cùng luật fallback bắt-tất-cả luôn khớp) cho ra `candidates: Protocol[]`. Lọc `candidates` chỉ giữ những protocol **đã có driver đăng ký** trong `DriverRegistry` (loại bỏ ví dụ `'zpl'` nếu chưa có `ZplDriver` — xem mục 8).
2. Với từng protocol trong `candidates` theo đúng thứ tự: gọi `DriverRegistry[protocol].connect(config)`.
   - `connect()` thất bại → `disconnect` (best-effort) → thử protocol tiếp theo.
   - `connect()` thành công → gọi `identify(printerId)`.
     - Trả về thông tin thật (khác `null`) → driver tự xác nhận đúng protocol: emit `{ stage: 'identified', protocol, deviceInfo }`, **giữ nguyên connection đang mở**, dừng thuật toán. Mapping/hint chỉ quyết định *thử ai trước*, không quyết định *ai đúng* — đúng driver phải tự `identify()` thành công.
     - Trả `null`/rỗng → `disconnect`, thử protocol tiếp theo trong `candidates`.
3. Hết `candidates` mà không protocol nào tự xác nhận được → emit `{ stage: 'unknown_protocol' }`.
4. Nếu `connect()` thất bại ở **mọi** protocol trong `candidates` (không driver nào mở được kết nối vật lý) → emit `{ stage: 'error', error }` — lỗi kết nối thật (sai IP, thiết bị tắt, mất pairing…), khác với `unknown_protocol` (kết nối được nhưng không driver nào tự xác nhận).

### 4.3 Printer Detection Rules (hardcode)

```ts
// src/features/printer/constants/printerDetectionRules.ts
export interface PrinterDetectionRule {
  vendorMatch: RegExp;
  modelMatch?: RegExp;
  candidates: Protocol[];       // thứ tự ưu tiên thử, KHÔNG phải kết luận cuối cùng
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export const PRINTER_DETECTION_RULES: PrinterDetectionRule[] = [
  // TODO: điền danh sách máy in thực tế (vendor/model) khi có thông tin từ người dùng

  // Luật fallback bắt-tất-cả — LUÔN đặt cuối danh sách, đảm bảo discoverProtocol()
  // luôn có candidates để thử ngay cả khi không rule cụ thể nào khớp.
  { vendorMatch: /.*/, candidates: ['escpos', 'tspl'], confidence: 'low' },
];
```

Tên gọi phản ánh đúng vai trò: đây là **luật nhận diện thiết bị** (cho ra candidate driver để thử), không phải bảng "kết luận protocol" — tránh nhầm lẫn khi đọc code sau này.

Danh sách rule cụ thể (tên máy in, vendor, model thật) cần người dùng cung cấp khi viết implementation plan — hiện chưa có nên chỉ để luật fallback + TODO tường minh, **không** bịa dữ liệu.

---

## 5. UI/UX — Wizard

Thay `AddPrinterModal` (form 1 màn) bằng wizard nhiều bước, quản lý bằng state cục bộ trong component (không thêm navigation route mới):

```
Bước 1 — Chọn kiểu kết nối
  SegmentedButtons: USB / Bluetooth / LAN (giữ nguyên)

Bước 2 — Chọn/nhập thiết bị
  USB/BT → DeviceScanList (giữ nguyên component), chọn đúng 1 thiết bị
  LAN    → AppInput IP + Port
  → nút "Kết nối"

Bước 3 — Đang kết nối & nhận diện (loading)
  LoadingOverlay/inline spinner: "Đang kết nối..." → "Đang nhận diện máy in..."

Bước 4 — rẽ nhánh theo DiscoveryEvent:
  identified        → Info Card (mục 5.1), Protocol badge "Tự động nhận diện"
  unknown_protocol  → thông báo + chọn Protocol thủ công (ESC/POS/TSPL)
                       → connect thật bằng driver đã chọn → Info Card,
                         Protocol badge "Người dùng chọn"
  error             → hiện AppError + nút "Thử lại" (quay Bước 2)

Bước 5 — "In thử" (AppButton, disabled khi status !== 'connected')
Bước 6 — "Lưu" (AppButton, disabled tới khi In thử thành công lần gần nhất)
```

### 5.1 Info Card (sau khi Connected)

- Display Name — `AppInput`, mặc định = `deviceInfo.deviceName` hoặc tên thiết bị scan được, sửa được.
- Device Name, Manufacturer (Vendor), Model — text hiển thị, không sửa (từ `deviceInfo`).
- Connection Type — text hiển thị.
- Protocol — badge kèm nguồn (`Tự động nhận diện` / `Người dùng chọn`).
- Connection Status — `StatusDot`/badge xanh "Connected".
- Khổ giấy — `AppSelect` (58/80mm), luôn hiện vì cả ESC/POS và TSPL hiện tại đều hỗ trợ 2 khổ.
- Auto Connect — `AppSwitch`.

### 5.2 Quy tắc

- Test Print chỉ enable khi `status === 'connected'`.
- Save chỉ enable khi Connected **và** Test Print thành công ở lần gần nhất.
- Đổi Protocol thủ công hoặc quay lại đổi kết nối/thiết bị → reset `canTestPrint = false`, bắt test lại.
- Protocol tự nhận diện → không hiện bước chọn thủ công.
- Test Print thất bại → hiện lỗi qua `AppError`, giữ nguyên Info Card, không cho Save tới khi test lại thành công.

### 5.3 Luồng Sửa (Edit)

- Nếu người dùng chỉ đổi Display Name / Khổ giấy / Auto Connect (không đổi `connectionType`/thiết bị/IP/Port) → cho Save ngay, **không** bắt kết nối+test lại.
- Nếu đổi `connectionType`, thiết bị (USB/BT), hoặc IP/Port (LAN) → chạy lại toàn bộ wizard từ Bước 3 (`discoverProtocol` lại), bắt test lại trước khi Save.

### 5.4 Không đổi so với Phase 1

- Menu thao tác trên `PrinterListItem` (Kết nối/Ngắt kết nối/Kết nối lại/Đặt mặc định/Xóa) dùng thẳng `protocol` đã lưu trong `PrinterConfig`, không qua `discoverProtocol`.
- Xóa khi đang Connected vẫn qua `ConfirmDialog` trước khi disconnect + remove (Phase 1 §5).

---

## 6. Error Handling & Logging

Giữ nguyên nguyên tắc Phase 1: mọi lỗi driver/transport chuẩn hoá qua `AppError` trước khi lên UI, `LoggerService` cho log, không `console.log` trực tiếp.

`discoverProtocol` phân biệt rõ 2 loại thất bại (mục 4.2 bước 3-4): `unknown_protocol` (kết nối được, không rõ protocol — UI hỏi chọn thủ công) và `error` (không kết nối được — UI báo lỗi + Thử lại). Không gộp chung hai trường hợp này vì hướng xử lý UI khác nhau.

---

## 7. Kiểm Thử

- Logic thuần không cần hardware: thuật toán thử tuần tự trong `discoverProtocol` (mock driver `connect`/`identify`), `PRINTER_DETECTION_RULES` (matching vendor/model → candidates, thứ tự ưu tiên, luật fallback), Zod schema wizard mới, reducer `printerSlice` (field mới `deviceInfo`/`protocolSource`).
- Luồng cần hardware thật (kết nối, nhận diện, in thử qua USB/BT/LAN thật với máy in vật lý) đánh dấu rõ **"cần test trên thiết bị thật"** trong plan — không tự nhận đã hoạt động chỉ vì compile được, giữ nguyên nguyên tắc Phase 1 §7.

---

## 8. Rủi Ro & Giả Định Đã Biết

- **API `identify()` của `react-native-esc-pos-printer`**: chưa xác nhận SDK có hỗ trợ lệnh đọc ID/model máy in hay không — cần verify khi implement; nếu không hỗ trợ, `EscPosDriver.identify()` sẽ luôn trả `null` và protocol ESC/POS sẽ luôn rơi vào `unknown_protocol` (phải chọn thủ công) cho tới khi driver có cách xác nhận khác.
- **TSPL không có lệnh nhận diện chuẩn hoá**: nhiều máy in tem giá rẻ không phản hồi lệnh trạng thái/nhận diện — `TsplDriver.identify()` khả năng cao trả `null` với phần lớn thiết bị thực tế; đây là hạn chế đã biết, không phải thiếu sót code. Trong trường hợp này hệ thống sẽ rơi vào `unknown_protocol` và yêu cầu người dùng chọn thủ công — đúng theo rule đã thống nhất, không đoán bừa.
- **`PRINTER_DETECTION_RULES` còn chỉ có luật fallback** (mục 4.3) — cần danh sách rule thật (vendor/model) từ người dùng trước khi implement đầy đủ; không bịa dữ liệu.
- **`candidates` có thể liệt kê protocol chưa có driver** (vd. rule Godex ví dụ trong thảo luận thiết kế: `['tspl', 'zpl']` dù chưa có `ZplDriver` phase này) — `discoverProtocol` (mục 4.2 bước 1) lọc bỏ candidate không có driver đăng ký trước khi thử; viết rule với protocol chưa implement là hợp lệ (chuẩn bị sẵn cho tương lai), miễn không phá vỡ scope "chỉ ESC/POS + TSPL" của lần implement này (mục 2).
- Kế thừa toàn bộ rủi ro/giả định đã ghi ở Phase 1 §8 (USB chưa hỗ trợ TSPL, `react-native-esc-pos-printer` giả định hỗ trợ đủ USB/BT/LAN, auto-reconnect chỉ theo thao tác người dùng/khởi động app).
