# Thiết Kế: Refactor Add Printer Modal — Wizard → Modal Cuộn Một Màn Hình

> **Scope:** Chỉ đổi lớp trình bày (Presentation Layer) của `AddPrinterModal`/`PrinterInfoCard`/`DeviceScanList`. Không đổi bất kỳ business logic nào — `discoverProtocol()`, `PrinterService`, các quy tắc Test Print/Save/disconnect-khi-đóng-chưa-lưu giữ nguyên 100% như đã implement (`docs/superpowers/plans/2026-08-01-printer-connect-wizard.md`).

---

## 1. Bối Cảnh & Mục Đích

Wizard nhiều bước (`WizardStep`: `selectConnection → selectDevice → connecting → chooseProtocol/identified/error`) vừa implement xong hoạt động đúng nhưng có UX chưa tốt: người dùng bị chuyển hẳn màn hình giữa các bước, không nhìn thấy toàn bộ thông tin cùng lúc.

Refactor sang **một modal cố định, cuộn được**: mọi phần luôn hiển thị, phần chưa dùng được thì **Disable (khoá/mờ)** thay vì ẩn hẳn. Chỉ một vùng nhỏ (Status Panel, ngay dưới nút "Kết nối") đổi nội dung theo trạng thái — không còn chuyển cả màn hình.

---

## 2. Phạm Vi

**Trong phạm vi:**
- Bỏ hoàn toàn `WizardStep` (không còn khái niệm Step 1/2/3).
- Layout mới: Kiểu kết nối (luôn bật) → Thiết bị/IP+Port (luôn hiện theo kiểu kết nối) → nút Kết nối → Status Panel (vùng động) → Thông tin máy in (luôn render, khoá tới khi Connected) → In thử/Lưu.
- Tách state theo 2 trục độc lập: `ConnectionState` (`idle|connecting|connected|error`) và `ProtocolState` (`detecting|identified|unknown`) — thay cho `WizardStep` kết hợp.
- Quy tắc reset tự động: đổi bất kỳ thông tin kết nối (kiểu kết nối/thiết bị/IP/Port) sau khi đã kết nối thành công → tự huỷ kết quả cũ, không còn nút "Đổi kết nối" riêng.
- `PrinterInfoCard` thêm prop `locked: boolean`.
- Thêm timeout cho scan thiết bị USB/Bluetooth trong `DeviceScanList` (mục 7 dưới đây) — sửa một gap có sẵn (hiện tại scan có thể treo vô thời hạn nếu SDK không bao giờ emit 'empty').

**Ngoài phạm vi (tường minh):**
- Mọi thay đổi trong `discoverProtocol.ts`, `PrinterService.ts`, các driver (`TsplDriver`/`EscPosDriver`), `printerFormSchema.ts` — giữ nguyên y hệt.
- Quy tắc gate Save/Test Print, disconnect-khi-đóng-modal-chưa-lưu, edit-flow `connectionDirty` — giữ nguyên hành vi, chỉ đổi cách UI đọc/hiển thị.

---

## 3. Layout

```text
┌─ Thêm máy in ──────────────────────────────┐
│ Kiểu kết nối: [USB] [Bluetooth] [LAN]      │  ← ConnectionSection, luôn bật
│ (danh sách thiết bị / IP + Port)           │  ← theo kiểu kết nối đã chọn
│ [ Kết nối / Đang kết nối... / Kết nối lại ]│
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │  ← StatusPanel (vùng động, mục 5)
│ (Idle: rỗng / Connecting: spinner /        │
│  Detecting: "Đang nhận diện..." /          │
│  Unknown: chọn Protocol thủ công /         │
│  Error: thông báo + Thử lại)               │
│ ──────────────────────────────────────────  │
│ Tên hiển thị: [____] (khoá nếu chưa nối)   │  ← PrinterInfoCard, locked=?
│ Vendor · Model · Protocol                  │
│ Khổ giấy · Tự động kết nối lại             │
│ [In thử]              [Lưu máy in]         │
└──────────────────────────────────────────────┘
```

`ConnectionSection` và `PrinterInfoCard` luôn được render — không component nào bị unmount/remount khi trạng thái đổi (tránh layout nhảy).

---

## 4. State Model

Thay `WizardStep` bằng 2 state độc lập trong `AddPrinterModal`:

```ts
type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
type ProtocolState = 'idle' | 'detecting' | 'identified' | 'unknown';
```

Cộng với state đã có từ trước (giữ nguyên): `connectionType`, `selectedDevice`, `autoReconnect`, `canTestPrint`, `connectionDirty`, `printerId`, `protocol`/`protocolSource`/`deviceInfo` (khi đã identify), `errorMessage` (khi connectionState='error').

### Map từ `DiscoveryEvent.stage` (không đổi `discoverProtocol.ts`) sang 2 state trên:

| `DiscoveryEvent.stage` | `ConnectionState` | `ProtocolState` |
|---|---|---|
| `connecting` | `connecting` | `idle` |
| `identifying` | `connecting` | `detecting` |
| `identified` | `connected` | `identified` |
| `unknown_protocol` | `idle` | `unknown` |
| `error` | `error` | `idle` |

**Lý do `unknown_protocol → connectionState: 'idle'` (không phải `'connected'`):** theo đúng code hiện tại của `discoverProtocol()` (không đổi), mọi candidate connect được nhưng `identify()` thất bại đều bị `disconnect()` trước khi thử candidate tiếp theo — nên khi `unknown_protocol` được emit, **không còn kết nối thật nào đang mở**. Sau khi người dùng chọn Protocol thủ công (`SegmentedButtons` trong Status Panel), bấm xác nhận sẽ gọi `PrinterService.connectDraft()` (giữ nguyên, không đổi) — lúc đó mới chuyển `connectionState: 'connecting' → 'connected'`, `protocolState: 'unknown' → 'identified'` (với `protocolSource: 'manual'`).

---

## 5. Status Panel (vùng động duy nhất)

Component riêng `StatusPanel`, nhận `connectionState`/`protocolState`/`errorMessage`/`onRetry`/`onChooseProtocol` qua props (thuần presentational, không gọi `PrinterService` trực tiếp).

| Điều kiện | Nội dung |
|---|---|
| `connectionState==='idle' && protocolState==='idle'` | Rỗng (chưa làm gì) |
| `connectionState==='connecting' && protocolState==='idle'` | Spinner + "Đang kết nối..." |
| `connectionState==='connecting' && protocolState==='detecting'` | Spinner + "Đang nhận diện giao thức..." (chưa gắn nhãn "Đã kết nối" — `connectionState` vẫn là `'connecting'` cho tới khi protocol được xác nhận, để `PrinterInfoCard` không unlock sớm khi còn chưa biết protocol) |
| `protocolState==='unknown'` | "Không thể nhận diện giao thức. Vui lòng chọn thủ công:" + `SegmentedButtons` ESC/POS · TSPL |
| `connectionState==='error'` | Thông báo lỗi (đỏ) + nút "Thử lại" |
| `connectionState==='connected' && protocolState==='identified'` | "✓ Đã kết nối" + tóm tắt Vendor/Model/Protocol (dữ liệu giống hệt sẽ hiển thị lặp lại ở `PrinterInfoCard` bên dưới — chấp nhận trùng lặp nhỏ này để không phải cuộn lên xem, đúng theo mô tả gốc) |

---

## 6. Nút "Kết nối"

Label đổi theo `connectionState` (không đổi hành vi bấm — luôn gọi lại `startDiscovery`, tương đương gọi lại `PrinterService.discoverProtocol` với draft config hiện tại):

- `idle` / `error` → **"Kết nối"**
- `connecting` → **"Đang kết nối..."** (disabled)
- `connected` → **"Kết nối lại"** (vẫn bấm được — cho phép chủ động kết nối lại dù đang connected, ví dụ sau khi máy in mất kết nối vật lý mà `liveStatus` local trong app chưa kịp cập nhật)

---

## 7. Quy Tắc Reset Tự Động

Khi người dùng đổi **bất kỳ** giá trị nào trong nhóm: `connectionType`, `selectedDevice` (USB/BT), `lanIp`/`lanPort` (LAN) — **sau khi** đã từng `connectionState==='connected'` hoặc đang `'connecting'`/`'error'` — tự động:

```ts
setConnectionState('idle');
setProtocolState('idle');
setProtocolInfo(undefined); // protocol/protocolSource/deviceInfo hiện tại
setCanTestPrint(false);
setConnectionDirty(true); // giữ nguyên logic Task 13 — Save cần connect lại
// KHÔNG reset: printerName, paperSize, autoReconnect (displayForm giữ nguyên)
```

Việc reset gắn vào `onChangeText`/`onValueChange`/`onSelect` của `ConnectionSection` (SegmentedButtons kiểu kết nối, `AppInput` IP/Port, `DeviceScanList.onSelect`) — không còn nút "Đổi kết nối" riêng, vì đổi trực tiếp là đủ kích hoạt reset.

Nếu người dùng dismiss modal ở giữa lúc `connectionState==='connected'` mà chưa lưu, hành vi disconnect-khi-đóng-chưa-lưu (`savedRef`, `disconnectForProtocol`, Task 13 + emergency fix) **giữ nguyên không đổi** — chỉ đọc từ `connectionState`/protocol hiện tại thay vì đọc từ `step.name`.

---

## 8. `PrinterInfoCard` — thêm `locked`

```ts
export interface PrinterInfoCardProps {
  // ...props hiện có (control, errors, connectionType, protocol, protocolSource,
  //   deviceInfo, status, autoReconnect, onAutoReconnectChange, canTestPrint,
  //   testPrintPending, onTestPrint, onSave, saveDisabled)
  locked: boolean; // MỚI
}
```

`locked = connectionState !== 'connected'`. Khi `locked`:
- `AppInput` (Tên hiển thị), `AppSelect` (Khổ giấy), `AppSwitch` (Auto Connect) đều nhận thêm `disabled={locked}` (3 component này đã tồn tại — cần thêm prop `disabled` nếu chưa có, xem mục 9).
- "In thử"/"Lưu máy in" tiếp tục theo đúng logic gate hiện có (`status !== 'connected'`, `saveDisabled || !canTestPrint`) — `locked` chỉ ảnh hưởng phần input phía trên, không thay layout hay logic 2 nút này.
- Layout/vị trí các trường **không đổi** khi `locked` chuyển `true → false` — chỉ đổi màu/opacity + `disabled`, tránh nhảy layout (đúng nguyên tắc mục "Nguyên tắc UI" gốc).

---

## 9. Kiểm tra `AppInput`/`AppSelect`/`AppSwitch` có sẵn `disabled` chưa

Cần đọc lại 3 file này khi viết plan — nếu component chưa nhận prop `disabled`/`editable={false}`, thêm vào (thay đổi nhỏ, tương thích ngược, không ảnh hưởng chỗ dùng khác).

---

## 10. `DeviceScanList` — Thêm Timeout Scan (30 giây)

**Vấn đề có sẵn (không phải do refactor này gây ra):** hiện tại `DeviceScanList` không có giới hạn thời gian — nếu driver's `scan()` không bao giờ emit `'found'`/`'empty'`/`'error'` (có thể xảy ra với `EscPosDriver.scan()` nếu SDK Epson không tự phát tín hiệu "hết thiết bị"), `loading` treo `true` vĩnh viễn.

**Fix:** thêm timeout 30 giây. Hết 30 giây mà chưa có `'found'`/`'empty'`/`'error'`, tự động dừng scan (gọi `unsubscribe()` — dừng driver thật, không chỉ tắt spinner) và hiển thị `EmptyState` "Không tìm thấy thiết bị nào" (coi như empty), y hệt trải nghiệm nhận được sự kiện `'empty'` thật.

Nếu người dùng bấm nút refresh (🔄) trong lúc scan đang chạy, timeout cũ phải huỷ và một chu kỳ 30 giây mới bắt đầu (đã tự nhiên đúng vì `scanTrigger` đổi → `useEffect` chạy lại → cleanup timer cũ, tạo timer mới).

---

## 11. Testing

- Không đổi test coverage của `discoverProtocol.ts`/`PrinterService.ts`/driver `identify()` — các file này không bị sửa.
- `DeviceScanList`'s scan timeout là logic thuần (setTimeout + cleanup) nhưng nằm trong 1 UI component — theo đúng convention đã thống nhất từ Phase 1 (component dưới `src/features/printer/components/` không có test riêng), **không** thêm test file mới cho `DeviceScanList.tsx`.
- `AddPrinterModal.tsx`/`PrinterInfoCard.tsx`/`StatusPanel.tsx` (mới) — không có test riêng, verify bằng `tsc`/`lint` + xác nhận thủ công trên thiết bị thật (giữ nguyên caveat "cần test trên thiết bị thật" đã có từ Phase 1).

---

## 12. Rủi Ro & Giả Định

- Việc "Kết nối lại" khi đã `connected` gọi lại `startDiscovery()` (tức chạy lại toàn bộ `discoverProtocol()` từ đầu, không phải chỉ gọi `PrinterService.reconnect`) — chấp nhận vì đơn giản, nhất quán với luồng hiện có; không tối ưu riêng cho trường hợp này.
- `StatusPanel` khi `connected` hiển thị tóm tắt Vendor/Model/Protocol trùng với `PrinterInfoCard` bên dưới — trùng lặp nhỏ có chủ đích theo đúng mô tả gốc, không coi là lỗi.
- Kế thừa toàn bộ rủi ro đã ghi ở spec gốc (`2026-08-01-printer-connect-wizard-design.md`) — không đổi gì về `identify()`/detection rules/business logic.
