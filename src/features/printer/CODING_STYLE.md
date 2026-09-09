# Printer Feature — Coding Style

Bổ sung cho [`docs/CODING_STANDARDS_TS.md`](../../../docs/CODING_STANDARDS_TS.md)
(áp dụng toàn app) — các rule dưới đây chỉ áp dụng cho `src/features/printer/`,
tập trung vào thiết kế class/interface/type/field/comment cho domain
printer. Nếu 1 rule ở đây mâu thuẫn với convention đã có trong codebase,
convention thật thắng — xem ghi chú "Điều chỉnh" ở mỗi rule có xung đột.

---

## 1. Responsibility

Mỗi class/interface/type chỉ có **một responsibility rõ ràng**.

```text
Printer
PrinterDriver
PrinterConnection
PrintPaperConfig
PrinterCapabilities
```

Không gom nhiều domain responsibility vào một abstraction (vd không có
`PrinterManager` làm cả discovery + connection + printing + storage —
xem `ARCHITECTURE.md` §2 cho cách tách hiện tại).

---

## 2. Naming

Tên phải thể hiện **domain meaning**, không mô tả implementation.

```ts
// Tránh
Data
Manager
Helper
Utils
ConfigData

// Ưu tiên
PrintPaperConfig
PrinterConnection
PrinterCapabilities
PrintRoutingService
PrinterConnectionLock
```

---

## 3. Interface

Interface định nghĩa **contract** — dùng khi có ranh giới cần implement
nhiều cách (native/library/vendor, mock cho test), không dùng cho object
shape đơn thuần không có behavior thay thế được.

```ts
export interface IPrinterAdapter {
  connect(target: PrinterConnectTarget): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
}
```

Không tạo `IPrinterManager`/`IPrinterHelper` chỉ để "trông SOLID" nếu chỉ
có đúng 1 implementation và không có kế hoạch thêm implementation thứ 2.

---

## 4. Type vs Interface

```text
interface → object contract / entity / service contract có thể có nhiều implementation
type      → union / composition / alias / function type
```

```ts
export interface Printer {
  id: string;
}

export type PrinterDriverType = (typeof PrinterDriverType)[keyof typeof PrinterDriverType];
```

---

## 5. Domain Constants — const-object pattern, KHÔNG dùng `enum`

**Điều chỉnh so với đề xuất ban đầu:** codebase dùng `enum` thật sẽ phá vỡ
nhất quán 100% domain constant hiện có, và TS `enum` có vấn đề tree-shaking/
erasure khác hẳn union-từ-const-object. Giữ đúng pattern đã dùng xuyên
suốt:

```ts
// Không hard-code rải rác
if (driver === 'escpos') { ... }

// Centralize đúng pattern đã dùng
export const PrinterDriverType = {
  escpos: 'escpos',
  tspl: 'tspl',
} as const;

export type PrinterDriverType = (typeof PrinterDriverType)[keyof typeof PrinterDriverType];
```

Sử dụng: `driver.type === PrinterDriverType.escpos` — không so sánh string
literal trực tiếp ở nơi gọi.

---

## 6. `readonly` — chỉ khi không xung đột với Redux Toolkit/Immer

**Điều chỉnh so với đề xuất ban đầu:** KHÔNG áp `readonly` lên field của
`Printer`/`PrinterDriver` — `store/printerSlice.ts` (Redux Toolkit
`createSlice`) mutate trực tiếp field này theo đúng cú pháp Immer bắt buộc
(`printer.enabled = ...`, `state.printers.push(...)`). Thêm `readonly` sẽ
lỗi compile ngay, không phải lỗi cần sửa ở phía reducer.

```ts
// KHÔNG áp readonly cho model đi qua Redux slice
export interface Printer {
  id: string;      // không readonly
  enabled: boolean; // không readonly — bị mutate trong printerSlice.ts
}
```

`readonly` vẫn dùng được bình thường cho type/interface **không** đi qua
Redux (vd config object truyền 1 lần cho constructor, DTO chỉ đọc).

---

## 7. Constructor / Factory Function

Codebase dùng **factory-function + closure** cho service (không dùng
class), đã hỗ trợ dependency injection đầy đủ qua default parameter:

```ts
export const createPrinterConfigService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
  repository: PrinterRepositoryLike = PrinterRepository,
) => {
  // ...
  return { installTsplFont, setTsplRenderMode };
};

export const PrinterConfigService = createPrinterConfigService(DriverRegistry, PrinterRepository);
```

**Không đổi sang class-based OOP** (`new PrinterConfigService(repository)`)
— pattern hiện tại đạt cùng lợi ích DI mà không cần class, đổi chỉ là style
rewrite không có lợi ích chức năng, chi phí rất cao (mọi service).

Factory function không nên chứa workflow phức tạp trong closure setup —
chỉ khởi tạo state/helper nội bộ, method thật nằm trong object trả về.

---

## 8. Validation ở domain boundary, không chỉ ở UI

```text
UI validation      → UX (required field, format lỗi hiển thị ngay)
Schema validation  → correctness (chạy ở service boundary, không chỉ UI)
```

Ví dụ: `columns > 0`, `itemWidthMm > 0`, ràng buộc die-cut không vượt khổ
giấy — nằm trong `forms/addPrinter/PrinterSchema.ts` (`printMediaSchema`),
chạy lại ở `PrinterRepository.addPrinter()`/`updatePrinter()` qua
`printerSchema.parse()`, không chỉ dựa vào form đã chặn trước đó.

---

## 9. Units — physical value phải explicit đơn vị

```ts
// Ưu tiên
itemWidthMm
verticalGapMm
timeoutMs
imageWidthPx

// Tránh nếu có khả năng gây nhầm
width
timeout
```

Đã áp dụng nhất quán trong `PrintPaperConfig`/`paperSpec.ts` — giữ khi thêm field mới.

---

## 10. Comment Rules

### 10.1 Không comment mô tả lại code (WHAT)

```ts
// Tránh
// Get printer name
const name = printer.name;
```

### 10.2 Comment giải thích WHY / constraint / non-obvious behavior

```ts
// USB dùng chung 1 native module singleton — 2 job USB phải serialize
// bất kể printerId khác nhau.
```

### 10.3 Class/interface-level comment cho abstraction dùng chung

```ts
/**
 * Giấy vật lý đang nạp trong máy in — thuộc Printer, KHÔNG thuộc driver.
 * Không mô tả behavior driver hay routing.
 */
export interface PrintPaperConfig { ... }
```

### 10.4 Field chỉ comment khi tên+type chưa đủ rõ

```ts
// Không cần — tên đã đủ rõ
name: string;

// Cần — constraint không thấy được từ tên+type
/** Bắt buộc khi type = 'die_cut'. Bỏ qua khi continuous. */
columns?: number;
```

### 10.5 Comment workaround / hardware quirk bắt buộc

```ts
// Firmware clone XP-420B đọc ngược ý nghĩa bit của lệnh BITMAP TSPL —
// đảo bit ở đây, KHÔNG lan sang MonochromeBitmap dùng chung.
```

### 10.6 TODO phải có lý do, không để trống

```ts
// Tránh
// TODO: fix

// Ưu tiên
// TODO: bỏ ngưỡng CONTINUOUS_HEIGHT_MM tạm sau khi verify phần cứng thật
// cho phép chiều cao lớn hơn (xem spec 2026-09-09 §9).
```

---

## 11. Condition Rules

Đặt tên cho business condition thay vì để boolean expression trần:

```ts
// Tránh
if (order.isPaid && !order.isCancelled) { ... }

// Ưu tiên
const canCheckout = order.isPaid && !order.isCancelled;
if (!canCheckout) return;
```

Kết hợp với guard clause đã có trong `docs/CODING_STANDARDS_TS.md` (nesting
tối đa 2 cấp, early return).

---

## 12. Abstraction Rules

Không tạo function/class trung gian không tạo boundary rõ ràng:

```ts
// Tránh — 3 lớp gọi nhau không thêm ý nghĩa
function execute() { return process(); }
function process() { return handle(); }
function handle() { return save(); }
```

Không tạo `Factory`/`Registry`/`Adapter` khi chỉ có `new X(...)` hoặc gọi
thẳng 1 implementation — chỉ dựng khi creation logic thật sự có nhiều
nhánh cấu hình (vd `resolvePrinterAdapter` — có thật 3 implementation,
resolve theo 2 điều kiện, xứng đáng có hàm riêng).

---

## 13. Side Effect Rules

Tên method phải phản ánh đúng có side effect hay không:

```text
Side effect rõ trong tên: save, delete, connect, disconnect, write, print
Pure/tính toán:            calculate, resolve, derive, validate, format, encode
```

`resolveEffectiveCutterMode(media)` (pure) không được âm thầm ghi log/side
effect; `PrinterConfigService.setDriverMedia()` (side effect) phải có tên
động từ rõ ràng, không đặt tên như `getDriverMedia`.
