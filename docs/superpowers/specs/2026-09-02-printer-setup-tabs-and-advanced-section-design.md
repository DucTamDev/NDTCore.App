# Thiết lập máy in — Tách tab Hoá đơn/Tem + Cài đặt nâng cao — Design Specification

## 0. Bối cảnh

Người dùng nhận xét màn "Thiết lập máy in" (trước đổi tên là "Quản lý máy in") phức tạp hơn hẳn các app POS thương mại (KiotViet) khi cấu hình 1 máy in TSPL die-cut: ~20 field/control hiện **cùng lúc** trên 1 màn cuộn — Kết nối, Trạng thái, Tên hiển thị, Auto-reconnect, Khổ giấy, Loại giấy, 5 field die-cut (Rộng/Cao tem, Số cột, Khoảng cách ngang/dọc), loại nội dung nhận in, Chế độ render TSPL, Codepage/Tên font, Số hàng in thử, 2 nút In thử, Lưu.

App thương mại (KiotViet...) thường: chọn máy từ danh sách → đặt tên (auto-fill) → chọn loại chứng từ in → Lưu. Cấu hình ít dùng (khổ giấy, codepage...) được auto-detect/mặc định hoặc giấu sau "Cài đặt nâng cao".

2 cải tiến độc lập nhưng bổ trợ nhau, gộp 1 spec:

- **Phần A** — tách màn "Thiết lập máy in" thành 2 tab **Hoá đơn** / **Tem** ngay từ danh sách, giảm quyết định "mình đang cấu hình cho mục đích gì" trước khi vào form.
- **Phần B** — thu gọn field ít dùng vào "Cài đặt nâng cao" (đóng mặc định) trong form Thêm/Sửa, giảm số field hiện cùng lúc.

Phát hiện quan trọng khi đọc code (`DriverCapabilities.ts`): driver **ESC/POS chỉ nhận được Hoá đơn** (`escpos: [Receipt]`) — switch "In Hoá đơn" hiện tại luôn bật sẵn cho ESC/POS, không có lựa chọn thật. Chỉ **TSPL** (`tspl: [Receipt, Label]`) mới thật sự linh hoạt — đây là driver duy nhất cần hỏi "dùng cho mục đích gì".

Không đổi kiến trúc printer/driver hiện có (Strategy Pattern, `PrinterDriver.contentTypes`, state machine `useAddPrinterFlow`) — đây là 2 cải tiến UI/UX, không phải refactor domain.

---

## 1. Phạm vi

**Trong phạm vi:**

1. Đổi tên "Quản lý máy in" → "Thiết lập máy in" (đã làm — `applicationConfig.ts`, `PrinterManagementPanel.tsx`, README, test liên quan).
2. `PrinterManagementPanel`: thêm tab **Hoá đơn** / **Tem**, lọc danh sách theo `printer.drivers[].contentTypes` — máy in nhận CẢ 2 loại hiện ở CẢ 2 tab (không ép về 1 tab chính).
3. Nút "Thêm máy in" đổi label theo tab active: `+ Thêm máy in Hoá đơn` / `+ Thêm máy in Tem`, truyền `purpose: PrintType` vào Add flow.
4. `useAddPrinterFlow`/`useProtocolDiscovery`: nhận thêm `purpose?: PrintType` — CHỈ áp dụng khi thêm mới (`!initialValues`); dùng để prefill content type mặc định khi driver mới được thêm vào (`addDriverToList`).
5. Cảnh báo (không chặn) khi driver được thêm KHÔNG hỗ trợ `purpose` đã chọn (vd ESC/POS ở tab Tem) — vẫn cho kết nối, vẫn cho Lưu.
6. `PrinterInfoCard`: thêm section "Cài đặt nâng cao" — thu gọn (collapsed) mặc định, liệt kê field cụ thể ở §3.
7. 2 nút In thử: **luôn hiện**, đặt ngay TRÊN nút Lưu (ngoài phần nâng cao).
8. Cập nhật test liên quan (`useAddPrinterFlow.test.tsx`, `PrinterManagementPanel` nếu có test, `useApplication.test.ts` đã cập nhật).
9. Sync `ARCHITECTURE.md` nếu có mô tả liên quan đến các phần đổi.

**Ngoài phạm vi:**

- KHÔNG đổi data model (`Printer`, `PrinterDriver.contentTypes`, storage version) — thuần UI.
- KHÔNG khoá cứng content type theo tab đã vào — chỉ prefill mặc định + cảnh báo, user vẫn tự do bật/tắt switch content type như hiện tại.
- KHÔNG đổi flow dò driver thứ 2 ("Kết nối lại" để thêm protocol khác) — giữ nguyên state machine `useProtocolDiscovery`.
- KHÔNG đổi sang wizard nhiều bước — vẫn 1 màn cuộn (quyết định trước đó giữ nguyên).
- KHÔNG đổi hành vi Sửa máy in (`initialValues` có giá trị) — `purpose` chỉ ảnh hưởng luồng Thêm mới.

---

## 2. Phần A — Tab Hoá đơn / Tem

### 2.1 UI danh sách (`PrinterManagementPanel.tsx`)

```
Thiết lập máy in
┌─ Hoá đơn ─┬─ Tem ─┐
│                    │
│ [+ Thêm máy in Hoá đơn]
│ - Máy in A (kết nối)
│ - Máy in C (mất kết nối)
└────────────────────┘
```

State mới: `activeTab: PrintType` (mặc định `PrintType.Receipt`). Filter làm ngay ở component, KHÔNG đổi `usePrinterList` (vẫn trả về toàn bộ danh sách — giữ nguyên contract, các nơi khác dùng `usePrinterList` không bị ảnh hưởng):

```ts
const printersForTab = (printType: PrintType): Printer[] =>
  printers.filter((p) => p.drivers.some((d) => d.contentTypes.includes(printType)));
```

Máy in không có driver nào (vừa thêm nhưng save lỗi giữa chừng — không nên xảy ra thực tế) sẽ không hiện ở tab nào; chấp nhận được, không phải trường hợp cần xử lý riêng.

### 2.2 Nút "Thêm máy in" theo tab

```ts
const openAdd = (purpose: PrintType): void => {
  setAddPurpose(purpose);
  setAddSessionId((n) => n + 1);
  setEditingPrinter(undefined);
  setMode('form');
};
```

Label nút theo `activeTab`: `+ Thêm máy in Hoá đơn` (tab Hoá đơn) / `+ Thêm máy in Tem` (tab Tem).

### 2.3 `purpose` trong Add flow

`useAddPrinterFlow` nhận thêm `purpose?: PrintType` trong `UseAddPrinterFlowInput`. Trong `addDriverToList` (hiện tại tự động gán MỌI content type driver hỗ trợ mà chưa bị driver khác claim):

```ts
const addDriverToList = (type: PrinterDriverType, source: DriverSource): void => {
  const alreadyClaimed = new Set(drivers.flatMap((d) => d.contentTypes));
  const capable = getDriverCapabilities(type).contentTypes.filter((ct) => !alreadyClaimed.has(ct));
  // MỚI: nếu có purpose và driver hỗ trợ được purpose đó → chỉ prefill đúng purpose
  // (không tự động bật thêm loại khác mà user không hỏi tới). Không hỗ trợ →
  // giữ hành vi cũ (mọi content type chưa bị claim) + cờ cảnh báo (§2.4).
  const contentTypes = purpose && capable.includes(purpose) ? [purpose] : capable;
  const purposeMismatch = purpose != null && !capable.includes(purpose);
  ...
};
```

Editing (`initialValues` có giá trị): `purpose` luôn `undefined` khi gọi `useAddPrinterFlow` từ `openEdit` — không đổi hành vi Sửa.

### 2.4 Cảnh báo driver không hợp mục đích

Khi `purposeMismatch` true cho 1 driver, hiện dưới driver card (giống `showAddDriverHint`/`hasEmptyContentTypeDriver` hiện có):

> "Driver ESC/POS không hỗ trợ in Tem — vẫn dùng được cho Hoá đơn."

Không chặn Save, không đổi `saveDisabled`. User có thể bấm switch content type thủ công như bình thường.

---

## 3. Phần B — Cài đặt nâng cao thu gọn

### 3.1 Nhóm field (`PrinterInfoCard.tsx`)

**Luôn hiện:**
- Tên hiển thị
- Thông tin thiết bị (tên thiết bị, hãng, model — readonly text)
- Loại kết nối + trạng thái badge
- Chip driver (protocol, nguồn tự động/thủ công) — mỗi driver
- Loại nội dung nhận in (switch Hoá đơn/Tem) — mỗi driver, kèm cảnh báo §2.4 nếu có
- 2 nút In thử (In bill thử / In tem thử) — ngay trên nút Lưu
- Nút Lưu máy in

**"Cài đặt nâng cao" (đóng mặc định, mỗi driver 1 khối riêng nếu ≥2 driver):**
- Tự động kết nối lại (switch — hiện đang ở cấp printer, không phải per-driver, giữ nguyên vị trí logic nhưng chuyển vào nâng cao)
- Khổ giấy / Loại giấy / die-cut fields (Rộng tem, Cao tem, Số cột, Khoảng cách ngang, Khoảng cách dọc)
- Chế độ render TSPL + Codepage/Tên font (khi Mặc định máy in)
- Số hàng in thử (die-cut)

### 3.2 Cơ chế thu gọn

Dùng component thu gọn có sẵn của React Native Paper (`List.Accordion` hoặc tương đương đã dùng trong app — kiểm tra lúc viết plan) thay vì tự chế toggle — giữ nhất quán style, tránh viết lại animation/chevron. Mặc định `expanded={false}`. KHÔNG unmount nội dung bên trong khi đóng nếu field có RHF/state cần giữ giá trị khi mở lại (dùng ẩn bằng style thay vì `{expanded && <...>}` — theo đúng nguyên tắc "Disable/Hide" đã có trong `CLAUDE.md`: "Disable, không Hide... `{condition && <X/>}` là anti-pattern"). Vì đây là accordion hiển thị/ẩn thuần UI (không phải điều kiện theo trạng thái xử lý), có thể cân nhắc ngoại lệ — quyết định cụ thể để ở bước viết plan sau khi khảo sát API `List.Accordion` (nó tự quản lý mount/unmount nội dung).

---

## 4. Testing

- `useAddPrinterFlow.test.tsx`: thêm case `purpose` prefill đúng content type; case driver không hỗ trợ purpose → cảnh báo, không chặn save.
- `PrinterManagementPanel`: hiện KHÔNG có test riêng (component UI thuần theo quy ước `CLAUDE.md` — verify qua type-check/lint + test thủ công). Nếu thêm logic filter phức tạp đáng kể, cân nhắc tách hàm `printersForTab` ra utils/hook riêng để test được (quyết định ở bước plan).
- `npm run verify` (type-check + lint + test) trước mỗi commit theo quy ước repo.

---

## 5. Rủi ro / điểm mở

- RN Paper's `List.Accordion` behavior với nested `Controller` (react-hook-form) bên trong — cần xác minh không mất giá trị field khi đóng/mở lại (lúc viết plan, task đầu nên là 1 smoke-test nhỏ).
- Copy chính xác cho label 2 nút "Thêm máy in Hoá đơn/Tem" và text cảnh báo purpose-mismatch — có thể tinh chỉnh khi implement, không phải quyết định kiến trúc.
