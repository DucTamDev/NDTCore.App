# PrinterConnection Discriminated Union + `services/` Folder Reorg — Design Specification

## 0. Bối cảnh

Sau khi review 1 đề xuất rewrite toàn diện cho `src/features/printer/` (đổi
`domain/application/infrastructure`-style thành class-based OOP, `readonly`
khắp nơi, đổi tên `PrintMedia`, gom test về 1 cây `testing/`...), phần lớn đề
xuất đó **bị từ chối** vì xung đột với quyết định đã có hoặc chi phí không
tương xứng lợi ích (xem §5 "Đã cân nhắc và từ chối"). Spec này chỉ giữ lại
**2 phần thật sự có giá trị, rủi ro thấp, không xung đột gì**:

1. `PrinterConnection` → discriminated union thật (loại bỏ invalid state ở
   compile-time, hiện chỉ chặn được ở runtime qua Zod `superRefine`).
2. Xoá `services/` — di chuyển 12 file bên trong ra các folder top-level theo
   đúng responsibility (`discovery/`, `printing/`, `connection/`,
   `permissions/`, `management/`, `logging/`), tách `PrinterPrintService`
   khỏi `PrinterConnectionService` để mỗi service chỉ còn 1 trách nhiệm.

---

## 1. Phạm vi

**Trong phạm vi:**
1. `PrinterConnection` discriminated union (model + Zod schema + mọi call site đọc `.device`/`.lan`).
2. Xoá `services/`, di chuyển 12 file theo bảng §3.
3. Tách `print()`/`testPrint()` khỏi `PrinterConnectionService` → `PrinterPrintService` mới.
4. Đổi tên `services/permission/` → `permissions/` (top-level).
5. Cập nhật mọi import path bị ảnh hưởng (trong feature lẫn ngoài — `App.tsx`, `cart/services/OrderPrintTrigger.ts`).
6. Cập nhật `ARCHITECTURE.md` (file responsibility §111, dependency graph §141).

**Ngoài phạm vi (đã cân nhắc và từ chối — xem §5, không làm lại):**
- `readonly Printer`, class-based OOP thay factory-function, đổi `PrintMedia` → `PrinterPaperConfig`, gom test vào `testing/`, `RenderedPrint`/`PrintRenderer` generic, tạo `IPrinterManager`/interface thừa.

---

## 2. `PrinterConnection` Discriminated Union

### 2.1 Data model (`models/printer/Printer.ts`)

```ts
export interface UsbPrinterConnection {
  type: 'usb';
  device: PrinterDevice;
}

export interface BluetoothPrinterConnection {
  type: 'bluetooth';
  device: PrinterDevice;
}

export interface LanPrinterConnection {
  type: 'lan';
  lan: PrinterLanConfig;
}

export type PrinterConnection =
  | UsbPrinterConnection
  | BluetoothPrinterConnection
  | LanPrinterConnection;
```

Giữ nguyên `PrinterDevice`/`PrinterLanConfig` đã có (`models/printer/PrinterDevice.ts`)
— **không** tách thêm `UsbPrinterDevice`/`BluetoothPrinterDevice` riêng biệt
như bản đề xuất gốc, vì USB và Bluetooth hiện dùng chung đúng 1 shape
(`deviceId`/`displayName`/`rawDevice`), tách thêm không giải quyết invalid
state nào cả — chỉ có `PrinterConnection` (3 loại field khác nhau: device
usb / device bluetooth / lan) mới thật sự có invalid-state cần chặn. Field
LAN giữ tên `lan: PrinterLanConfig` (không đổi thành `host`/`port` phẳng như
bản đề xuất gốc) — để không phải sửa lại `PrinterLanConfig` đang dùng ở nhiều
chỗ khác (`buildLan()`, `resolveIdentityKey`, `printerLanConfigSchema`).

### 2.2 Schema (`forms/addPrinter/PrinterSchema.ts`)

```diff
- const printerConnectionSchema = z.object({
-   type: z.enum([ConnectionType.usb, ConnectionType.bluetooth, ConnectionType.lan]),
-   device: printerDeviceSchema.optional(),
-   lan: printerLanConfigSchema.optional(),
- });
+ const printerConnectionSchema = z.discriminatedUnion('type', [
+   z.object({ type: z.literal(ConnectionType.usb), device: printerDeviceSchema }),
+   z.object({ type: z.literal(ConnectionType.bluetooth), device: printerDeviceSchema }),
+   z.object({ type: z.literal(ConnectionType.lan), lan: printerLanConfigSchema }),
+ ]);
```

`z.discriminatedUnion` cần thiết dù TS đã enforce ở compile-time — dữ liệu
đọc từ MMKV (storage) không đi qua type-check, vẫn cần validate runtime cho
dữ liệu cũ/hỏng.

Xoá được **toàn bộ** khối `superRefine` connection invariant hiện có
(`PrinterSchema.ts:143-159` cũ — check "lan phải có connection.lan",
"không được có connection.device"...) vì discriminated union tự enforce
đủ, không cần check tay nữa.

### 2.3 Cutover — call site đọc `.device`/`.lan` không qua narrow trước

Đa số call site hiện tại đã `if (connection.type === 'lan') { ... connection.lan ... }`
— TS tự narrow đúng, **không cần sửa gì**. Chỉ các chỗ sau đọc `.device`/`.lan`
**không** narrow trước (dựa vào field optional) mới cần sửa:

| File | Việc cần làm |
|---|---|
| `services/connection/PrinterConnectionLock.ts:61` (`connectionResourceKey({ device: printer.connection.device, lan: printer.connection.lan })`) | Narrow theo `printer.connection.type` trước khi đọc từng field |
| `services/printing/PrintScheduler.ts:32` | Y hệt trên |
| `storage/PrinterRepository.ts:48` (`resolveIdentityKey({ device: ..., lan: ... })`) | Y hệt trên |
| `hooks/addPrinter/useConnectionSetup.ts:43,51-52` (`initialValues?.connection.device`, `.connection.lan?.ip`) | Narrow theo `initialValues?.connection.type` trước |

Các file chỉ đọc `printer.connection.type` (không đụng `.device`/`.lan`) —
`EscPosDriver.ts`, `TsplDriver.ts`, `PrinterListItem.tsx`, `usePrinterList.ts`,
`PrinterDiscoveryService.ts`, `PrinterConfigService.ts` — **không cần sửa**,
`.type` tồn tại trên cả 3 nhánh union.

`adapters/IPrinterAdapter.ts` (`toConnectTarget`) đã narrow đúng theo
`connection.type` sẵn — chỉ cần xác nhận compile sạch sau khi đổi type,
không cần sửa logic.

---

## 3. `services/` Folder Reorg

Xoá `services/` (12 file, đã audit đủ, không sót), di chuyển theo bảng:

| Từ | Đến | Ghi chú |
|---|---|---|
| `services/PrinterLogger.ts` | `logging/PrinterLogger.ts` | Tách riêng — không phải "quản lý printer", là support/infra logging |
| `services/PrinterConnectionService.ts` | `connection/PrinterConnectionService.ts` | Bỏ `print`/`testPrint` — xem §4 |
| `services/PrinterConfigService.ts` | `management/PrinterConfigService.ts` | Giữ nguyên nội dung |
| `services/connection/PrinterConnectionLock.ts` | `connection/PrinterConnectionLock.ts` | Giữ nguyên nội dung |
| `services/device/DeviceScanService.ts` | `discovery/DeviceScanService.ts` | Giữ nguyên nội dung |
| `services/device/NetworkInfoService.ts` | `discovery/NetworkInfoService.ts` | Giữ nguyên nội dung |
| `services/discovery/PrinterDiscoveryService.ts` | `discovery/PrinterDiscoveryService.ts` | Giữ nguyên nội dung |
| `services/discovery/PrinterResolver.ts` | `discovery/PrinterResolver.ts` | Giữ nguyên nội dung |
| `services/permission/PrinterPermissionService.ts` | `permissions/PrinterPermissionService.ts` | Đổi cả tên folder (số ít → số nhiều, nhất quán với `transports/`, `drivers/`) |
| `services/printing/PrintRoutingService.ts` | `printing/PrintRoutingService.ts` | Giữ nguyên nội dung |
| `services/printing/PrintScheduler.ts` | `printing/PrintScheduler.ts` | Đổi `PrintDispatchDeps.print` sang `PrinterPrintService.print` — xem §4 |
| `services/printing/PrintService.ts` | `printing/PrintService.ts` | Giữ nguyên nội dung |
| — (file mới) | `printing/PrinterPrintService.ts` | Mới — xem §4 |

Không tạo `native/` top-level (đã cân nhắc — dư thừa, xem §5). `errors/`,
`models/`, `adapters/`, `transports/`, `drivers/`, `storage/`, `media/`,
`components/`, `hooks/`, `forms/`, `store/`, `utils/`, `testing/` **giữ
nguyên vị trí hiện tại**, không đổi.

`__tests__/` colocate theo từng file di chuyển cùng (vd
`services/__tests__/PrinterConfigService.test.ts` → `management/__tests__/PrinterConfigService.test.ts`).

---

## 4. Tách `PrinterPrintService`

### 4.1 Vấn đề với thiết kế hiện tại

`PrinterConnectionService` hiện gánh 2 trách nhiệm khác nhau: **connection
lifecycle** (`connect`/`disconnect`/`reconnect`/`getStatus`/`onStatusChange`/
`connectDraft`/`disconnectForDriver`/`getStatusForDriver`/`onStatusChangeForDriver`)
và **print dispatch** (`print`/`testPrint`). `PrintScheduler` phải gọi
`PrinterConnectionService.print()` — 1 dependency chéo từ `printing/` sang
`connection/` không đúng bản chất (`print()` không quản lý connection state,
nó chỉ *dùng* driver đã/sắp connect để in).

### 4.2 Thiết kế sau tách

**Quan trọng — không dựng `PrinterPrintService` phụ thuộc `PrinterConnectionService`.**
Soi code thật của `print()`:

```ts
const print = async (printerId, documents, printType) => {
  const printer = repository.findOrThrow(printerId);
  const driverEntry = printer.drivers.find((d) => d.contentTypes.includes(printType));
  const driver = getDriver(driverEntry.type);              // registry[type] — KHÔNG gọi PrinterConnectionService
  if (driver.getStatus(printerId) !== PrinterStatus.connected) {
    await driver.connect(printer, driverEntry);            // driver.connect() TRỰC TIẾP, không qua PrinterConnectionService.connect()
  }
  await driver.print(printerId, documents, printType);
};
```

`print()` chỉ cần `registry` (`DriverRegistry`) và `repository`
(`PrinterRepository`) — đúng 2 dependency thô mà `PrinterConnectionService`
cũng nhận, không gọi qua bất kỳ method nào khác của nó. Vậy 2 service là
**anh em cùng cấp**, không phải quan hệ wrap:

```text
                DriverRegistry   PrinterRepository   PrinterConnectionLock
                      │                 │                    │
        ┌─────────────┼─────────────────┤          ┌─────────┤
        ▼             ▼                 ▼          ▼         ▼
   PrinterConnectionService (connection/)      PrinterPrintService (printing/)
   connect / disconnect / reconnect /          print / testPrint
   getStatus / onStatusChange / connectDraft /
   disconnectForDriver / getStatusForDriver /
   onStatusChangeForDriver
```

```ts
// printing/PrinterPrintService.ts
export const createPrinterPrintService = (
  registry: Record<PrinterDriverType, IPrinterDriver> = DriverRegistry,
  repository: PrinterRepositoryLike = PrinterRepository,
  lock: ResourceLockLike = PrinterConnectionLock,
) => {
  const getDriver = (type: PrinterDriverType): IPrinterDriver => registry[type];

  // print() KHÔNG tự lock.runExclusive — xem §4.3, đây là bất biến bắt buộc.
  const print = async (printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void> => {
    /* nguyên nội dung print() cũ, chỉ đổi chỗ ở */
  };

  const testPrint = async (printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void> => {
    await lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).testPrint(printer, driver, documents, printType, options));
  };

  return { print, testPrint };
};

export const PrinterPrintService = createPrinterPrintService(DriverRegistry, PrinterRepository, PrinterConnectionLock);
```

### 4.3 Bất biến bắt buộc — `print()` KHÔNG được tự lock

`print()` hiện tại **không** gọi `lock.runExclusive` — vì nó luôn được
`PrintScheduler.enqueue()` gọi từ **bên trong** 1 `lock.runExclusive` đã
acquire sẵn ở tầng scheduler cùng `resourceKey`. `testPrint()` thì có tự lock
vì được UI gọi thẳng, không qua scheduler.

`PrinterConnectionLock.runExclusive` **không reentrant** — task mới cùng
`resourceKey` bị xếp hàng chờ task đang chạy xong. Nếu sau này ai đó thêm
`lock.runExclusive(...)` vào trong `print()` "cho nhất quán với testPrint()",
sẽ **deadlock ngay lập tức** vì đang chạy lồng bên trong lock cùng key mà
`PrintScheduler` đã giữ.

**Bắt buộc:** giữ nguyên hành vi này khi di chuyển, thêm comment ngay tại
`print()` giải thích rõ WHY (tương tự comment workaround đã có trong
codebase) để không ai "sửa cho nhất quán" gây deadlock.

### 4.4 Call site cần cập nhật (đã rà, chỉ 2 chỗ)

- `printing/PrintScheduler.ts` — `PrintDispatchDeps.print: typeof PrinterConnectionService.print` → `typeof PrinterPrintService.print`; khởi tạo `PrintScheduler` đổi `print: PrinterConnectionService.print` → `print: PrinterPrintService.print`.
- `hooks/addPrinter/useTestPrint.ts` — `PrinterConnectionService.testPrint(...)` → `PrinterPrintService.testPrint(...)`.

Không còn nơi nào khác gọi `.print`/`.testPrint` trên `PrinterConnectionService`.

---

## 5. Đã cân nhắc và từ chối (không làm lại nếu không có lý do mới)

| Đề xuất | Quyết định | Lý do |
|---|---|---|
| `readonly Printer`/domain model | **Không làm** | Phá `printerSlice.ts` reducer (`printer.enabled = ...`, `state.printers.push(...)`) — cú pháp Immer bắt buộc trong Redux Toolkit `createSlice`, không phải lỗi cần sửa |
| `PrintMedia`/`media/` → `PrinterPaperConfig`/`paper/` | **Không làm** | Tên hiện tại nhất quán xuyên suốt model/validation/encoder/strategy/schema/UI + 2 spec vừa viết (`2026-09-09-printer-media-ownership-design.md`, `2026-09-09-escpos-bitmap-printing-design.md`). `PrintMedia` (job cần giấy gì) và `PrinterCapabilities` (máy in làm được gì) là 2 khái niệm khác nhau, tên hiện tại đã đúng semantic |
| Class-based OOP thay factory-function | **Không làm** | 100% service hiện tại dùng factory-function + closure (`createXService(deps) => ({methods})`), đã hỗ trợ dependency injection cho test đầy đủ qua default param — đổi sang class là rewrite thuần style, không có lợi ích chức năng, chi phí rất cao (mọi service) |
| Gom hết `.test.ts` vào `testing/` với subfolder | **Không làm** | Đi ngược quy ước đã ghi rõ trong `CLAUDE.md` áp dụng toàn app: `__tests__/` colocate cạnh file logic, Jest tự nhận diện không cần cấu hình. `testing/` hiện có nghĩa khác (fixture/mock cố tình không đuôi `.test.` để Jest bỏ qua) — không nên lẫn 2 mục đích |
| `RenderedPrint` + generic `PrintRenderer` | **Không làm** | Không có representation trung gian dùng chung thật giữa bitmap (`MonochromeBitmap`) và text (string) — encoder vẫn phải switch y hệt strategy hiện tại, không tạo giá trị tương xứng |
| `IPrinterManager`/interface cho mọi service | **Không làm** | SOLID không có nghĩa interface hoá mọi class — service hiện tại không có 2 implementation nào cần chung interface |
| `native/` top-level riêng | **Không làm** | Trùng lặp với `adapters/native/` đã có semantic rõ (external API → adapter → application contract) |
| `PrinterPrintService` phụ thuộc `PrinterConnectionService` | **Không làm — sửa lại** | Soi code thật cho thấy `print()` chỉ cần `registry`+`repository`, không gọi method nào của `PrinterConnectionService` — 2 service nên là anh em cùng cấp dùng chung 3 primitive (`registry`/`repository`/`lock`), không phải quan hệ wrap |

---

## 6. Testing

| Test | Kiểm |
|---|---|
| `PrinterSchema.test.ts` | `printerConnectionSchema` reject connection thiếu field bắt buộc theo type / có field thừa (case cũ vẫn phải fail đúng, giờ do discriminated union tự chặn thay vì `superRefine`) |
| `PrinterConnectionLock.test.ts` | `connectionResourceKey` vẫn đúng behavior sau khi narrow lại theo type trước khi đọc `.device`/`.lan` |
| `PrinterResolver.test.ts` | Y hệt trên cho `resolveIdentityKey` |
| `PrinterPrintService.test.ts` (mới) | `print()`/`testPrint()` behavior y hệt test cũ trong `PrinterConnectionService.test.ts` (di chuyển case, không viết lại) — đặc biệt: `print()` KHÔNG gọi `lock.runExclusive` (assert `lock.runExclusive` không được gọi trong test `print()`) |
| `PrinterConnectionService.test.ts` | Bỏ case `print`/`testPrint` (đã dời), giữ nguyên case connect/disconnect/reconnect/status |
| `PrintScheduler.test.ts` | Đổi mock từ `PrinterConnectionService.print` sang `PrinterPrintService.print` |
| `useTestPrint` test (trong `useAddPrinterFlow.test.tsx`) | Đổi mock tương ứng |
| Toàn bộ test file bị di chuyển theo `services/*` → top-level | Cập nhật import path, không đổi nội dung test |

Chạy `npm run verify` (type-check + lint + test) sau khi xong toàn bộ — vì
đổi `PrinterConnection` là breaking type change, TS sẽ tự bắt hết chỗ cần
sửa còn sót (không cần grep tay tuyệt đối).

---

## 7. Rủi ro / lưu ý

- **Không phải storage version bump** — `PrinterConnection` đổi ở tầng TS
  type/schema, không đổi shape JSON đã lưu (`{type, device?, lan?}` vẫn đọc
  được, chỉ validate chặt hơn qua `z.discriminatedUnion`). Printer cũ có
  shape đúng invariant vẫn load bình thường; printer cũ có shape SAI
  invariant (lẽ ra không tồn tại vì `superRefine` cũ đã chặn khi lưu) sẽ bị
  reject khi đọc lại — chấp nhận được vì đó là dữ liệu đã sai từ trước.
- **File ngoài feature printer cần cập nhật import** (đã grep xác nhận đủ 3 chỗ):
  - `App.tsx` — `PrinterConnectionService` từ `services/PrinterConnectionService` → `connection/PrinterConnectionService`.
  - `application/components/ApplicationSidebar.tsx` — cùng import trên (`getStatus()`), dễ sót vì không nằm trong feature `printer`.
  - `cart/services/OrderPrintTrigger.ts` — `PrintService` từ `services/printing/PrintService` → `printing/PrintService`.
- Thứ tự thực hiện khi viết plan: **Part A (discriminated union) trước**,
  chạy xanh, commit riêng — rồi mới **Part B (folder reorg + PrinterPrintService)**,
  để mỗi commit review độc lập, dễ revert nếu 1 phần có vấn đề.
