# Hàng đợi in (Print Queue) — Design

**Ngày:** 2026-10-14
**Repo:** NDTCore.App, feature `src/features/printer`
**Branch:** `feat/print-queue`

## 1. Mục tiêu

Hiện `PrintService.print()` chạy lệnh in ngay, lỗi là `Failed` luôn, không thử lại, và người gọi phải chờ in xong.
Thanh toán vì vậy chờ in từng con tem, và một lần mất kết nối chớp nhoáng là mất bill.

Hàng đợi in cần:

- Nhận lệnh rồi trả về ngay; in chạy nền.
- Giữ đúng thứ tự in trên từng máy.
- Tự in lại khi chắc chắn chưa có gì được in ra, để không bao giờ in trùng bill.
- Báo lỗi một lần cho thu ngân, rồi bỏ lệnh.

## 2. Quyết định đã chốt

| # | Quyết định |
|---|---|
| D1 | Mỗi máy vật lý (`deviceId`) một hàng đợi, in đúng thứ tự vào trước ra trước; máy khác nhau in song song. |
| D2 | Chỉ tự in lại lỗi xảy ra **trước khi gửi dữ liệu**; tối đa 3 lần, chờ 2s → 5s → 15s. |
| D3 | Lỗi trong lúc gửi và lỗi vĩnh viễn: không tự in lại. |
| D4 | Lệnh in xong (thành công hoặc lỗi hẳn) là **xoá khỏi hàng đợi ngay**; không giữ lệnh lỗi. |
| D5 | Lỗi chỉ báo một lần qua snackbar; in lại bằng "Lịch sử đơn". |
| D6 | Kết nối lại máy (thu ngân tự bấm) **không** tự in gì. |
| D7 | Hàng đợi chỉ nằm trong bộ nhớ; tắt app là mất lệnh đang chờ. |
| D8 | `print()` trả về ngay sau khi đưa lệnh vào hàng đợi. |
| D9 | Nút "In thử" in thẳng, không qua hàng đợi, báo lỗi ngay trên form. |
| D10 | Lệnh đầu hàng lỗi hẳn vì lỗi trước khi gửi thì **bỏ luôn các lệnh còn lại của máy đó**, báo gộp một lần (xem §5.3). |
| D11 | "In lại" trong Lịch sử đơn in **cả bill lẫn tem**, cùng đường với lúc thanh toán (xem §5.5). |

## 3. Phân loại lỗi

Phân loại theo mã lỗi (`errorCodeOf(error)`), quyết định có tự in lại không.

| Nhóm | Mã lỗi | Ý nghĩa | Xử lý |
|---|---|---|---|
| Trước khi gửi | `NOT_CONNECTED`, `CONNECTION_FAILED`, `DEVICE_NOT_FOUND`, `BLUETOOTH_DISABLED`, `SERVICE_CLOSED` | Chưa byte nào tới máy | Tự in lại (D2) |
| Trong lúc gửi | `WRITE_FAILED`, `WRITE_TIMEOUT`, `CONNECTION_LOST` | Có thể đã in một phần | Lỗi hẳn, báo "có thể đã in một phần" |
| Vĩnh viễn | mọi mã còn lại (`INVALID_IMAGE`, `IMAGE_TOO_LARGE`, `ENCODE_FAILED`, `PERMISSION_DENIED`, `PRINTER_NOT_FOUND`, `CANCELLED`, `UNKNOWN_ERROR`…) | In lại cũng lỗi y vậy | Lỗi hẳn |

`NOT_CONNECTED` có thể đến từ `send()` khi phiên vừa rớt giữa `ensureConnected` và `send`; native từ chối trước khi
ghi nên vẫn là "trước khi gửi".

Thử lại tự động gọi lại `PrinterService.print()`, trong đó có `ensureConnected` mở lại kết nối. Đây là một phần của
lần thử lại, không mâu thuẫn với D6: D6 nói về việc thu ngân tự kết nối lại máy sau khi lệnh đã bị bỏ.

## 4. Kiến trúc

### 4.1 `PrintQueue` (mới, `printing/PrintQueue.ts`)

Class + instance dùng chung `printQueue`, theo quy ước service của feature.

```ts
export class PrintQueue {
  constructor(
    private readonly printing: PrinterService = printerService,
    private readonly lock: PrinterConnectionLock = printerConnectionLock,
  ) {}

  /** Đưa lệnh vào cuối hàng đợi của máy; không chờ in. */
  enqueue(task: PrintTask): void;

  /** Nghe kết quả cuối của mỗi lệnh (thành công hoặc lỗi hẳn); trả hàm huỷ đăng ký. */
  onTaskFinished(listener: (result: PrintTaskResult) => void): () => void;
}

export const printQueue = new PrintQueue();
```

- Bên trong: `Map<deviceId, PrintTask[]>` và một vòng xử lý (worker) cho mỗi máy đang có lệnh. Worker lấy lệnh đầu
  hàng, in, xoá, rồi sang lệnh kế; hết lệnh thì worker dừng và xoá khoá khỏi `Map`.
- **Mỗi lần gửi chạy trong `lock.runExclusive(deviceId)`**, vì khoá này còn dùng cho ngắt kết nối
  (`PrinterConnectionService`) và "In thử". **Thời gian chờ giữa các lần thử lại nằm ngoài khoá**, để trong lúc chờ
  thu ngân vẫn in thử hoặc ngắt kết nối được.
- Trong lúc lệnh đầu hàng chờ thử lại, các lệnh sau của cùng máy chờ phía sau (giữ thứ tự, D1).
- Không lưu xuống máy (D7); không có trạng thái `Failed` lưu lại (D4).

### 4.2 `PrintService.print()` (sửa)

```ts
print(kind: PrintKind, render: RenderPrintImage, title: string): Promise<PrintEnqueueResult>;
```

- Giữ nguyên phần chọn máy và chụp ảnh theo khổ giấy (mỗi khổ một lần).
- Thay `Promise.all(tasks.map(run))` bằng `tasks.forEach(task => this.queue.enqueue(task))`, rồi trả về ngay.
- `PrintService` không còn phụ thuộc `PrinterService` và `PrinterConnectionLock`, chỉ phụ thuộc `PrintQueue`.
- `title` mô tả nội dung để báo lỗi, vd `Hoá đơn #A1024`, `Tem #A1024 · ly 2/3`.

`PrintEnqueueResult` thay `PrintResult` ở điểm vào này:

| Trường | Ý nghĩa |
|---|---|
| `status` | `Queued` / `NoAvailablePrinter` / `CaptureFailed` |
| `tasks` | Các lệnh đã đưa vào hàng đợi (rỗng nếu không `Queued`) |
| `error?` | `NO_AVAILABLE_PRINTER` hoặc `INVALID_IMAGE` khi không `Queued` |

`PrintStatus` cũ (`Success`/`PartialFailure`/`Failed`) không còn nơi dùng thì bỏ.

### 4.3 `PrintTask` (sửa)

Thêm `title: string` (dùng cho snackbar và log). Các trường khác giữ nguyên.

### 4.4 `PrinterService` (giữ nguyên)

`print()` vẫn không tự khoá (hàng đợi khoá ngoài); `testPrint()` vẫn tự khoá (D9).

## 5. Luồng

### 5.1 Một lệnh

```
enqueue(task) → cuối hàng của task.deviceId → (worker tới lượt)
  attempt = 0
  loop:
    runExclusive(deviceId) { printing.print(printerId, data) }
      ├─ OK → emit Success, xoá lệnh, sang lệnh kế
      └─ lỗi:
           ├─ nhóm "trước khi gửi" và attempt < PRINT_RETRY_DELAYS_MS.length
           │     → chờ PRINT_RETRY_DELAYS_MS[attempt] (ngoài khoá), attempt++, lặp
           └─ còn lại → emit Failed, xoá lệnh (§5.3 nếu là "trước khi gửi")
```

### 5.2 Thanh toán (cart)

```
printOrder(receipt, labels, captureImage)
  1. printService.print(Receipt, capture bill, "Hoá đơn #…")     ← chụp xong là trả về
  2. với mỗi trang tem: printService.print(Label, capture tem, "Tem #… · ly n/N")
```

- Chụp vẫn tuần tự (một khung chụp), nhưng không còn chờ in: thanh toán xong chỉ mất thời gian chụp.
- Các tem vào hàng đợi đúng thứ tự trang nên in đúng thứ tự trên máy tem.
- `printOrder` chỉ còn báo các lỗi biết ngay: không có máy in hoá đơn, chụp hỏng. Lỗi in đến sau qua §6.
- Không có máy in tem vẫn im lặng như hiện tại.

### 5.3 Máy lỗi thì bỏ cả hàng của máy (D10)

Máy tắt hoặc mất kết nối thì lệnh đầu hàng thử 3 lần (~22s) rồi lỗi. Nếu các lệnh sau cũng thử lại từng lệnh, 5 con tem
mất gần 2 phút và hiện 5 snackbar. Vì vậy:

- Lệnh đầu hàng lỗi hẳn với nhóm "trước khi gửi" → bỏ luôn mọi lệnh còn trong hàng của máy đó, emit `Failed` cho
  từng lệnh với cùng lỗi.
- Snackbar gộp theo máy: "Máy *Tem quầy*: 5 lệnh in không thành công (không kết nối được)".
- Lỗi "trong lúc gửi" hoặc "vĩnh viễn" chỉ bỏ đúng lệnh đó; lệnh sau vẫn in bình thường.

### 5.4 Máy bị xoá hoặc tắt khi lệnh còn chờ

Lúc tới lượt, `PrinterService.print()` không tìm thấy máy sẽ ném `PRINTER_NOT_FOUND` → lỗi vĩnh viễn, bỏ lệnh.
Máy bị tắt (`enabled = false`) nhưng còn lưu: lệnh đã vào hàng vẫn in (người dùng tắt để không nhận lệnh *mới*).

### 5.5 In lại từ "Lịch sử đơn" (D11)

```
reprint(orderId)
  order = orderApi.getOrderByIdAsync(orderId)
  printOrder(buildReprintReceipt(order, store), buildReprintLabels(order, store), captureImage)
```

- `buildReprintLabels(order, store)` (mới, `OrderPrintTrigger.ts`): như `buildLabels` nhưng lấy từ `OrderDetail`; món
  dựng bằng `toReprintItem` sẵn có (option có giá là topping), giờ lấy từ `order.CreatedAt`, tên khách `null`.
- Bill in lại vẫn ghi "(In lại)" sau mã đơn như hiện tại. Tem in lại **không** ghi thêm: dòng trên của tem hẹp, thêm
  chữ sẽ đẩy số thứ tự ly xuống dòng.
- Cảnh báo giống lúc thanh toán: chưa có máy in hoá đơn thì báo ngay; chưa có máy in tem thì im lặng; lỗi in đến sau
  qua §6.
- In lại tạo lệnh mới hoàn toàn từ dữ liệu đơn trên server; không dùng lại ảnh cũ (D4).

## 6. Báo lỗi cho thu ngân

- Component mới `PrintFailureSnackbar` (`printer/components/`), mount một lần trong `App.tsx` bên trong
  `PaperProvider`; nghe `printQueue.onTaskFinished`, chỉ xử lý `Failed`.
- Lỗi đến trong vòng ~1s được gộp theo máy thành một thông báo (§5.3).
- Nội dung:
  - một lệnh: "*{title}* in không thành công trên *{printerName}* — {lý do}. In lại trong Lịch sử đơn."
  - lỗi trong lúc gửi thêm: "Có thể đã in một phần, kiểm tra máy trước khi in lại."
- Mount ở gốc app vì in xong có thể sau khi `CartPanel` đã đóng; snackbar "Chưa thiết lập máy in" và "Chụp hỏng" vẫn
  hiện tại chỗ như bây giờ vì biết ngay khi gọi.

## 7. File thay đổi

| File | Thay đổi |
|---|---|
| `printing/PrintQueue.ts` | Mới |
| `printing/PrintService.ts` | Enqueue thay vì chạy; trả `PrintEnqueueResult` |
| `models/printing/PrintTask.ts` | Thêm `title` |
| `models/printing/PrintEnqueueResult.ts` | Mới (thay `PrintResult` ở điểm vào) |
| `models/printing/PrintResult.ts`, `PrintStatus.ts` | Bỏ nếu không còn nơi dùng |
| `models/printing/printFailure.ts` hoặc trong `PrintQueue.ts` | Phân loại lỗi §3 |
| `components/PrintFailureSnackbar.tsx` | Mới |
| `App.tsx` | Mount snackbar |
| `cart/services/OrderPrintTrigger.ts` | Truyền `title`; `printLabels` không chờ in; kết quả chỉ còn no-printer/capture; thêm `buildReprintLabels` |
| `cart/hooks/useOrderHistory.ts` | `reprint` gọi `printOrder` (bill + tem) thay vì chỉ `printReceipt` |
| `cart/hooks/useCheckout.ts`, `useOrderHistory.ts`, `CartPanel`, `OrderHistoryPanel` | Bỏ cảnh báo "in không thành công" (đã chuyển sang §6) |
| `ARCHITECTURE.md` | §22–24: hàng đợi, phân loại lỗi, chính sách lỗi |

## 8. Kiểm thử

`PrintQueue` dùng `PrinterService` giả và fake timers của Jest:

- Cùng máy: in đúng thứ tự enqueue, không chạy chồng; khác máy: song song.
- Thành công: emit `Success` một lần, hàng đợi rỗng sau đó.
- Lỗi "trước khi gửi" rồi thành công ở lần 2: chỉ một `Success`, `print` được gọi 2 lần.
- Lỗi "trước khi gửi" cả 4 lần: `print` gọi đúng 4 lần, chờ đúng 2s/5s/15s, emit `Failed`; các lệnh sau cùng máy cũng
  `Failed` mà không gọi `print` (D10).
- Lỗi `WRITE_TIMEOUT`: không thử lại, emit `Failed` với cờ "có thể đã in một phần"; lệnh sau vẫn in.
- Lỗi vĩnh viễn: không thử lại.
- Trong lúc chờ thử lại, `testPrint` cùng máy chạy được (khoá không bị giữ khi chờ).
- `PrintService.print`: trả `Queued` ngay khi chưa in xong; `NoAvailablePrinter`/`CaptureFailed` không enqueue gì.
- `printOrder`: bill enqueue trước các tem; tem theo đúng thứ tự trang.
- `buildReprintLabels`: món, topping (option có giá), giờ lấy từ đơn đã lưu; mã đơn không có "(In lại)".
- `useOrderHistory.reprint`: in cả bill lẫn tem; chưa có máy in tem thì không cảnh báo.
- `PrintFailureSnackbar`: gộp nhiều lỗi cùng máy thành một thông báo.

## 9. Ngoài phạm vi

- Lưu hàng đợi xuống máy (D7).
- Màn hình xem hàng đợi / huỷ lệnh đang chờ.
- In lại riêng bill hoặc riêng tem (D11 in cả hai).
