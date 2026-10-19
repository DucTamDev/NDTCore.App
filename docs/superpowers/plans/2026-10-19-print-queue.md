# Print Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lệnh in đi qua hàng đợi theo từng máy vật lý: trả về ngay, in đúng thứ tự, tự in lại lỗi trước khi gửi, báo lỗi
một lần rồi bỏ lệnh; "In lại" trong Lịch sử đơn in cả bill lẫn tem.

**Architecture:** `PrintQueue` (class + `printQueue`) giữ `Map<deviceId, PrintTask[]>`, mỗi máy một worker; mỗi lần gửi
chạy trong `PrinterConnectionLock`, chờ thử lại nằm ngoài khoá. `PrintService.print()` chụp ảnh rồi enqueue và trả
`PrintEnqueueResult`. Lỗi in đến sau qua `printQueue.onTaskFinished`, hiện bằng `PrintFailureSnackbar` ở gốc app.

**Tech Stack:** React Native 0.86, TypeScript strict, Jest + react-test-renderer, react-native-paper.

**Spec:** `docs/superpowers/specs/2026-10-14-print-queue-design.md` (D1–D11)

## Global Constraints

- Repo `C:\NDTCORE\NDTCore\NDTCore.App`, branch `feat/print-queue`; không dùng worktree.
- Theo `src/features/printer/CODING_STYLE.md`: domain constant là const-object (không `enum`); service là class + instance
  camelCase, phụ thuộc truyền qua constructor với mặc định là instance dùng chung; test giả bằng `mockOf<Class>()`.
- Comment tiếng Việt, chỉ giải thích WHY, 1–3 dòng; không kể lịch sử, không tham chiếu số mục spec.
- Type/interface export: mỗi field một dòng JSDoc tiếng Việt (bỏ qua khi tên đã hiển nhiên), một dòng trống giữa các field.
- Dòng ≤ 120 ký tự, đo bằng Node (`line.length`); nesting ≤ 3; không hàm lồng trong hàm (trừ lambda ngắn).
- Thời gian chờ thử lại: `PRINT_RETRY_DELAYS_MS = [2000, 5000]` (2 lần thử lại sau lần đầu).
- Commit: không `git add -A`/`git add .`; kết thúc message bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mỗi task xong phải: `npx tsc --noEmit` 0 lỗi, `npx eslint src` sạch, jest của phần liên quan pass.

## Review Focus

1. Cùng máy vật lý có hai máy in đã lưu (máy hoá đơn + máy tem cùng `deviceId`) → chung một hàng, đúng thứ tự; D10 bỏ cả
   lệnh của máy in đã lưu kia. (Task 2, test `hai máy in đã lưu cùng deviceId dùng chung một hàng`)
2. Listener `onTaskFinished` ném lỗi → hàng đợi vẫn in tiếp lệnh sau. (Task 2, test `listener ném lỗi không làm dừng hàng đợi`)
3. Máy bị xoá khi lệnh đang chờ → `PRINTER_NOT_FOUND` là lỗi vĩnh viễn, chỉ bỏ lệnh đó, lệnh sau vẫn chạy (không áp D10).
   (Task 2, test `lỗi vĩnh viễn không bỏ các lệnh sau`)
4. Lỗi mới đến khi snackbar đang hiện → không mất, hiện ở thông báo kế tiếp. (Task 4, test `lỗi đến khi đang hiện thì
   chờ thông báo sau`)
5. Hai lần thanh toán liên tiếp → hàng đợi giữ thứ tự bill1, tem1…, bill2, tem2… (Task 2, test FIFO `in đúng thứ tự
   enqueue`, enqueue xen giữa hai đơn).

---

### Task 1: Phân loại lỗi in và `PrintTask.title`

**Files:**
- Create: `src/features/printer/models/printing/PrintFailureKind.ts`
- Modify: `src/features/printer/models/printing/PrintTask.ts`
- Test: `src/features/printer/models/printing/__tests__/PrintFailureKind.test.ts`
- Modify (bổ sung `title` cho chỗ tạo `PrintTask`): `src/features/printer/printing/PrintService.ts` (`createTask` nhận
  `title`), các fixture/test đang dựng `PrintTask` (tìm bằng `grep -rn "connectionType: ConnectionType" src/**/__tests__`)

**Interfaces:**
- Produces:
  - `PrintFailureKind = { BeforeSend: 'BeforeSend', DuringSend: 'DuringSend', Permanent: 'Permanent' }` (const-object +
    type cùng tên)
  - `printFailureKindOf(code: ErrorCode): PrintFailureKind` (cùng file)
  - `PrintTask.title: string` — mô tả nội dung để báo lỗi/log, vd `Hoá đơn #A1024`, `Tem #A1024 · ly 2/3`

- [ ] **Step 1: Viết test phân loại**

```ts
describe('printFailureKindOf', () => {
  it.each(['NOT_CONNECTED', 'CONNECTION_FAILED', 'DEVICE_NOT_FOUND', 'BLUETOOTH_DISABLED', 'SERVICE_CLOSED'])(
    '%s là lỗi trước khi gửi', (code) => expect(printFailureKindOf(code as ErrorCode)).toBe(PrintFailureKind.BeforeSend));
  it.each(['WRITE_FAILED', 'WRITE_TIMEOUT', 'CONNECTION_LOST'])(
    '%s là lỗi trong lúc gửi', (code) => expect(printFailureKindOf(code as ErrorCode)).toBe(PrintFailureKind.DuringSend));
  it.each(['INVALID_IMAGE', 'IMAGE_TOO_LARGE', 'ENCODE_FAILED', 'PERMISSION_DENIED', 'PRINTER_NOT_FOUND', 'UNKNOWN_ERROR'])(
    '%s là lỗi vĩnh viễn', (code) => expect(printFailureKindOf(code as ErrorCode)).toBe(PrintFailureKind.Permanent));
});
```

- [ ] **Step 2: Chạy, thấy fail** — `npx jest src/features/printer/models/printing` → FAIL (module chưa có).

- [ ] **Step 3: Viết `PrintFailureKind.ts`** — hai `Set<ErrorCode>` cho BeforeSend/DuringSend (dùng hằng của
  `DeviceErrorCode`), còn lại là Permanent. Comment WHY: `NOT_CONNECTED` từ `send()` vẫn là trước khi gửi vì native từ
  chối trước khi ghi; nhóm DuringSend có thể đã in một phần nên không tự in lại.

- [ ] **Step 4: Thêm `title` vào `PrintTask`** (JSDoc như ở Interfaces); `PrintService.createTask(printer, data, title)`
  — tạm truyền `PRINT_KIND_LABELS[kind]` từ `print()` để Task này tự build được (Task 3 thay bằng tham số thật). Sửa
  fixture/test còn thiếu `title`.

- [ ] **Step 5: Kiểm tra** — `npx tsc --noEmit` 0 lỗi; `npx jest src/features/printer` PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/models/printing/PrintFailureKind.ts src/features/printer/models/printing/PrintTask.ts \
  src/features/printer/models/printing/__tests__/PrintFailureKind.test.ts src/features/printer/printing/PrintService.ts
# + các file test/fixture đã sửa, liệt kê từng file
git commit -m "feat(printer): classify print failures; PrintTask carries a title"
```

---

### Task 2: `PrintQueue`

**Files:**
- Create: `src/features/printer/printing/PrintQueue.ts`
- Modify: `src/features/printer/logging/PrinterLogger.ts` (thêm `printRetryScheduled`)
- Test: `src/features/printer/printing/__tests__/PrintQueue.test.ts`

**Interfaces:**
- Consumes: `PrintFailureKind`, `printFailureKindOf` (Task 1); `PrinterService.print(printerId, image)`;
  `PrinterConnectionLock.runExclusive(key, task)`; `PrintTaskResult`, `PrintTaskStatus`; `toPrinterFeatureException`,
  `errorCodeOf` từ `../exceptions`.
- Produces:
  - `PRINT_RETRY_DELAYS_MS: readonly number[] = [2000, 5000]` (export từ `PrintQueue.ts`)
  - `class PrintQueue`:
    - `constructor(printing: PrinterService = printerService, lock: PrinterConnectionLock = printerConnectionLock)`
      — thời gian chờ dùng thẳng `PRINT_RETRY_DELAYS_MS`, không truyền qua constructor
    - `enqueue(task: PrintTask): void`
    - `onTaskFinished(listener: (result: PrintTaskResult) => void): () => void` — trả hàm huỷ đăng ký
  - `export const printQueue = new PrintQueue()`
  - `PrinterLogger.printRetryScheduled(params: { printerId: string; attempt: number; delayMs: number; errorCode: ErrorCode })`

Hành vi (spec §4.1, §5.1, §5.3, §5.4):
- `Map<deviceId, PrintTask[]>`; enqueue vào máy chưa có worker thì khởi động worker; worker lấy lệnh đầu, in, emit, xoá,
  lặp; hết lệnh thì xoá key khỏi `Map` và dừng.
- Mỗi lần gửi: `lock.runExclusive(task.deviceId, () => printing.print(task.printerId, task.data))`.
- Lỗi BeforeSend và còn lượt → `printerLogger.printRetryScheduled(...)`, chờ `PRINT_RETRY_DELAYS_MS[attempt]` bằng `setTimeout` **ngoài
  khoá**, thử lại. Hết lượt → emit `Failed` cho lệnh đó **và mọi lệnh còn trong hàng của máy** (cùng lỗi), xoá hàng (D10).
- Lỗi DuringSend / Permanent → emit `Failed` chỉ lệnh đó; lệnh sau chạy tiếp.
- `PrintTaskResult.startedAt` = lúc bắt đầu lần thử đầu tiên; với lệnh bị bỏ theo D10, `startedAt = completedAt` = lúc bỏ.
- Listener ném lỗi: bắt, ghi `LoggerService.warning`, gọi listener kế và in tiếp.

- [ ] **Step 1: Viết test** — dùng `mockOf<PrinterService>({ print: jest.fn(...) })`, `new PrinterConnectionLock()`,
  `jest.useFakeTimers()` + `jest.advanceTimersByTimeAsync(ms)` để đi qua thời gian chờ,
  và helper `drain()` chờ tới khi `onTaskFinished` nhận đủ N kết quả. Các test:
  - `in đúng thứ tự enqueue trên cùng máy, không chạy chồng` — enqueue a1,b1,a2 (cùng deviceId) → thứ tự gọi `print`
    a1,b1,a2; số lệnh đang chạy tối đa 1.
  - `máy khác nhau in song song` — hai deviceId, `print` chờ 5ms → đang chạy tối đa 2.
  - `hai máy in đã lưu cùng deviceId dùng chung một hàng` — printerId khác, deviceId giống → tuần tự.
  - `thành công: emit Success một lần rồi xoá khỏi hàng`.
  - `lỗi trước khi gửi rồi thành công ở lần 2` — `print` ném `DeviceErrorException(NOT_CONNECTED)` lần đầu → 1 kết quả
    `Success`, `print` gọi 2 lần; sau 1999ms `print` mới gọi 1 lần, tới 2000ms gọi lần 2.
  - `lỗi trước khi gửi cả 3 lần thì Failed và bỏ cả hàng của máy` — task a1 luôn `CONNECTION_FAILED`, a2/a3 đã enqueue →
    `print` gọi đúng 3 lần (chỉ cho a1) ở các mốc 0 / 2000 / 7000ms, 3 kết quả `Failed` cùng mã lỗi, a2/a3 không
    gọi `print`.
  - `lỗi trong lúc gửi không thử lại, lệnh sau vẫn in` — a1 `WRITE_TIMEOUT` → `Failed`, `print` 1 lần cho a1, a2 `Success`.
  - `lỗi vĩnh viễn không bỏ các lệnh sau` — a1 ném `PrinterErrorException(PRINTER_NOT_FOUND)` → `Failed`, a2 `Success`,
    không có timer chờ (`jest.getTimerCount()` = 0 sau khi a1 lỗi).
  - `trong lúc chờ thử lại, khoá của máy được nhả` — a1 lỗi `NOT_CONNECTED`, chưa tiến timer; trong lúc chờ đó,
    `lock.runExclusive(deviceId, async () => 'ok')` resolve.
  - `listener ném lỗi không làm dừng hàng đợi` — listener đầu ném, listener sau vẫn nhận; lệnh sau vẫn in.
  - `huỷ đăng ký thì không nhận kết quả nữa`.

- [ ] **Step 2: Chạy, thấy fail** — `npx jest src/features/printer/printing/__tests__/PrintQueue.test.ts` → FAIL.

- [ ] **Step 3: Viết `PrintQueue.ts`** theo Interfaces + Hành vi; thêm `printRetryScheduled` vào `PrinterLogger`. Tách
  hàm private (vd `runWorker(deviceId)`, `printWithRetry(task)`, `failRemaining(deviceId, result)`, `emit(result)`) để
  nesting ≤ 3. Comment WHY: chờ ngoài khoá để "In thử"/ngắt kết nối không bị chặn; bỏ cả hàng vì lỗi kết nối áp cho mọi
  lệnh của máy.

- [ ] **Step 4: Chạy lại** → PASS; `npx tsc --noEmit`, `npx eslint src/features/printer` sạch.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/printing/PrintQueue.ts src/features/printer/printing/__tests__/PrintQueue.test.ts \
  src/features/printer/logging/PrinterLogger.ts
git commit -m "feat(printer): per-device print queue with pre-send retry"
```

---

### Task 3: `PrintService` đưa lệnh vào hàng đợi; cart enqueue bill/tem, in lại cả hai

**Files:**
- Create: `src/features/printer/models/printing/PrintEnqueueStatus.ts`, `src/features/printer/models/printing/PrintEnqueueResult.ts`
- Modify: `src/features/printer/printing/PrintService.ts`
- Delete: `src/features/printer/models/printing/PrintResult.ts`, `src/features/printer/models/printing/PrintStatus.ts`
- Test: `src/features/printer/printing/__tests__/PrintService.test.ts` (viết lại phần chạy lệnh),
  `src/features/printer/models/printing/__tests__/PrintTask.test.ts` (bỏ test `PrintResult`)
- Modify: `src/features/printer/ARCHITECTURE.md` (§3 cây thư mục: `PrintQueue`, `PrintEnqueueResult`, `PrintFailureKind`;
  §22–24: hàng đợi, phân loại lỗi, chính sách lỗi mới)

**Interfaces:**
- Consumes: `PrintQueue.enqueue` (Task 2); `PrintTask.title` (Task 1).
- Produces:
  - `PrintEnqueueStatus = { Queued, NoAvailablePrinter, CaptureFailed }` (const-object, giá trị = tên)
  - `interface PrintEnqueueResult { status: PrintEnqueueStatus; tasks: PrintTask[]; error?: PrinterFeatureException }`
  - `PrintService.constructor(repository = printerRepository, queue: PrintQueue = printQueue)`
  - `PrintService.print(kind: PrintKind, render: RenderPrintImage, title: string): Promise<PrintEnqueueResult>`

Hành vi: giữ chọn máy + chụp mỗi khổ giấy một lần (`createTasks`); không có máy → `NoAvailablePrinter` +
`NO_AVAILABLE_PRINTER`, không chụp; chụp hỏng/ném → `CaptureFailed` + `INVALID_IMAGE`, không enqueue gì; còn lại
enqueue từng task theo thứ tự máy, trả `Queued` ngay (không chờ in). Bỏ `run()`, `resolvePrintStatus`, phụ thuộc
`PrinterService`/`PrinterConnectionLock`.

- [ ] **Step 1: Viết lại test `PrintService`** với `queue = mockOf<PrintQueue>({ enqueue: jest.fn() })`:
  - `không có máy nhận loại nội dung → NoAvailablePrinter, không chụp, không enqueue`.
  - `chụp hỏng → CaptureFailed với INVALID_IMAGE, không enqueue`; `hàm chụp ném lỗi → CaptureFailed, print không reject`.
  - `enqueue mỗi máy một lệnh mang title, máy, ảnh đúng giấy` — kiểm `enqueue` nhận `{ printerId, deviceId, kind, data,
    title: 'Hoá đơn #A1' }`, status `Queued`, `tasks` có độ dài bằng số máy.
  - `trả về Queued trước khi in xong` — giữ nguyên `enqueue` mock không làm gì; `await print()` resolve.
  - Giữ các test chọn máy (tắt, đúng loại) và chụp theo khổ giấy (cùng giấy chụp một lần).
  - Bỏ các test chạy/khoá/PartialFailure (đã chuyển sang `PrintQueue.test.ts`).

- [ ] **Step 2: Chạy, thấy fail** — `npx jest src/features/printer/printing` → FAIL.

- [ ] **Step 3: Sửa `PrintService.ts`**, thêm hai model, xoá `PrintResult.ts`/`PrintStatus.ts`; cập nhật
  `ARCHITECTURE.md`.

- [ ] **Step 4: Chạy** `npx jest src/features/printer` → PASS. Cart chưa compile cho tới hết task này; không commit ở đây.

**Phần cart** — cùng task vì API `print()` đổi, tách ra thì commit giữa chừng không compile.

**Files (cart):**
- Modify: `src/features/cart/services/OrderPrintTrigger.ts`
- Modify: `src/features/cart/hooks/useCheckout.ts`, `src/features/cart/hooks/useOrderHistory.ts`
- Modify: `src/features/cart/components/CartPanel.tsx`, `src/features/cart/components/OrderHistoryPanel.tsx`
- Test: `src/features/cart/services/__tests__/OrderPrintTrigger.test.ts`

**Interfaces (cart):**
- Consumes: `PrintService.print(kind, render, title): Promise<PrintEnqueueResult>`, `PrintEnqueueStatus` (phần trên).
- Produces (trong `OrderPrintTrigger.ts`):
  - `type PrintOutcome = 'queued' | 'no-printer' | 'failed'` — `failed` = chụp hỏng hoặc ném lỗi trước khi enqueue
  - `printReceipt(content, captureImage): Promise<PrintOutcome>` — title `` `Hoá đơn #${content.orderNumber}` ``
  - `printLabels(content, captureImage): Promise<PrintOutcome>` — mỗi trang một `print(Label, …)`, title
    `` `Tem #${orderNumber} · ly ${cupNumber}/${cupCount}` `` thêm `` ` · tem ${partNumber}/${partCount}` `` khi
    `partCount > 1`; trang đầu `NoAvailablePrinter` → trả `'no-printer'` ngay; trang nào `CaptureFailed` → `'failed'`
    ngay (không enqueue các trang sau)
  - `printOrder(receipt, labels, captureImage): Promise<OrderPrintOutcome>` — giữ nguyên hình dạng `{ receipt, labels }`
  - `buildReprintLabels(order: OrderDetail, store: StoreViewModel | null): LabelContent` — món bằng `toReprintItem`,
    `time: formatTime(order.CreatedAt)`, `customerName: null`, `orderNumber: order.OrderNumber` (không "(In lại)")
  - `printWarningOf(outcome: OrderPrintOutcome): string | null` — chuyển từ `useCheckout.ts` sang đây, dùng chung:
    receipt `no-printer` → `'Chưa thiết lập máy in cho Hoá đơn'`; receipt `failed` → `'Không chụp được hoá đơn để in'`;
    labels `failed` → `'Không chụp được tem để in'`; còn lại `null`

Hành vi: lỗi in thật (máy) không còn đi qua đây — đến sau qua `PrintFailureSnackbar` (Task 4). `useCheckout` và
`useOrderHistory` cùng dùng `printOrder` + `printWarningOf`; `useOrderHistory` đổi `receiptPrintWarning`/
`dismissReceiptPrintWarning` thành `printWarning: string | null`/`dismissPrintWarning`; `reprint` gọi
`printOrder(buildReprintReceipt(order, store), buildReprintLabels(order, store), captureImage)`. Hai panel hiện
`{printWarning}` như `CartPanel` đang làm.

- [ ] **Step 5: Sửa/viết test `OrderPrintTrigger`** (mock `PrintService` như hiện tại, `print` trả
  `{ status: PrintEnqueueStatus.Queued, tasks: [] }`):
  - `printReceipt` truyền title `'Hoá đơn #ORD-001'`; `Queued` → `'queued'`; `NoAvailablePrinter` → `'no-printer'`;
    `CaptureFailed` → `'failed'`; `print` reject → `'failed'`.
  - `printLabels`: 3 trang → 3 lần `print(PrintKind.Label, …)` với title `'Tem #ORD-001 · ly 1/3'`…; ly tách tem có
    title kết thúc `' · tem 1/2'`; trang đầu `NoAvailablePrinter` → `'no-printer'`, gọi đúng 1 lần; trang 2
    `CaptureFailed` → `'failed'`, không gọi trang 3.
  - `printOrder`: thứ tự kind gọi `print` là Receipt rồi các Label.
  - `buildReprintLabels`: món/topping từ đơn đã lưu, `orderNumber` = `'ORD-001'`, `time` dạng `HH:mm`, `customerName` null.
  - `printWarningOf`: 4 trường hợp ở Interfaces + labels `no-printer` → `null`.
  - Bỏ các test cũ dựa trên `PrintStatus.Failed/PartialFailure`.

- [ ] **Step 6: Chạy, thấy fail** — `npx jest src/features/cart` → FAIL.

- [ ] **Step 7: Sửa `OrderPrintTrigger.ts`, hai hook, hai panel** theo Interfaces (cart).

- [ ] **Step 8: Kiểm tra toàn repo** — `npx tsc --noEmit` 0 lỗi; `npx eslint src` sạch; `npx jest src/features` PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/printer/printing/PrintService.ts src/features/printer/printing/__tests__/PrintService.test.ts \
  src/features/printer/models/printing/PrintEnqueueStatus.ts src/features/printer/models/printing/PrintEnqueueResult.ts \
  src/features/printer/models/printing/__tests__/PrintTask.test.ts src/features/printer/ARCHITECTURE.md
git rm src/features/printer/models/printing/PrintResult.ts src/features/printer/models/printing/PrintStatus.ts
git add src/features/cart/services/OrderPrintTrigger.ts src/features/cart/services/__tests__/OrderPrintTrigger.test.ts \
  src/features/cart/hooks/useCheckout.ts src/features/cart/hooks/useOrderHistory.ts \
  src/features/cart/components/CartPanel.tsx src/features/cart/components/OrderHistoryPanel.tsx
git commit -m "feat(printer): PrintService enqueues tasks; cart enqueues receipt/labels and reprints both"
```

---

### Task 4: `PrintFailureSnackbar` ở gốc app

**Files:**
- Create: `src/features/printer/components/PrintFailureSnackbar.tsx`
- Modify: `App.tsx` (mount bên trong `PaperProvider`, cạnh `RootNavigator`)
- Test: `src/features/printer/components/__tests__/PrintFailureSnackbar.test.tsx`

**Interfaces:**
- Consumes: `PrintQueue.onTaskFinished` (Task 2), `printFailureKindOf`/`PrintFailureKind` (Task 1), `errorCodeOf`.
- Produces:
  - `PrintFailureSnackbar: React.FC<{ queue?: PrintQueue }>` (mặc định `printQueue`)
  - `printFailureNoticeOf(results: PrintTaskResult[]): string` (export từ cùng file, hàm thuần)
  - `FAILURE_BATCH_WINDOW_MS = 1000`

Nội dung thông báo (gộp theo `printerName`, mỗi máy một dòng, nối bằng `\n`):
- máy có 1 lệnh lỗi: `` `${title} in không thành công trên ${printerName}: ${error.message}.` ``
- máy có n > 1 lệnh lỗi: `` `Máy ${printerName}: ${n} lệnh in không thành công (${error.message của lệnh đầu}).` ``
- có lệnh lỗi DuringSend: thêm dòng `'Có thể đã in một phần, kiểm tra máy trước khi in lại.'`
- luôn kết thúc bằng dòng `'In lại trong Lịch sử đơn.'`

Hành vi: chỉ xử lý `Failed`; gom kết quả đến trong `FAILURE_BATCH_WINDOW_MS` kể từ lỗi đầu của đợt rồi hiện; lỗi đến
khi snackbar đang hiện được giữ lại và hiện ở thông báo kế tiếp sau khi đóng; huỷ đăng ký khi unmount.

- [ ] **Step 1: Viết test**
  - `printFailureNoticeOf`: 1 lệnh; 3 lệnh cùng máy → `'Máy Tem quầy: 3 lệnh in không thành công (…).'`; hai máy → hai
    dòng; có `WRITE_TIMEOUT` → có dòng "Có thể đã in một phần…"; luôn có dòng cuối "In lại trong Lịch sử đơn.".
  - Component (fake timers, `queue = mockOf<PrintQueue>({ onTaskFinished: jest.fn((l) => { listener = l; return unsubscribe; }) })`,
    bọc `PaperProvider`): `Success không hiện gì`; `hai lỗi trong 1 giây gộp thành một thông báo`;
    `lỗi đến khi đang hiện thì chờ thông báo sau`; `unmount thì huỷ đăng ký`.

- [ ] **Step 2: Chạy, thấy fail** — `npx jest src/features/printer/components` → FAIL.

- [ ] **Step 3: Viết component** (Snackbar của react-native-paper trong `Portal`, `duration` 6000) và mount trong `App.tsx`.

- [ ] **Step 4: Kiểm tra toàn repo** — `npx tsc --noEmit` 0 lỗi; `npx eslint src` sạch; `npx jest` toàn bộ PASS; đo
  dòng > 120 ký tự trên các file đã đổi bằng Node (không có dòng nào mới vượt).

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/components/PrintFailureSnackbar.tsx \
  src/features/printer/components/__tests__/PrintFailureSnackbar.test.tsx App.tsx
git commit -m "feat(printer): app-level snackbar for failed print tasks"
```
