# Printer Feature Model/Forms/Services Reorg Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xoá `types/`/`schemas/` catch-all trong `src/features/printer/`, tổ chức lại theo `models/`/`forms/`/`errors/`/`drivers/`/`storage/`/`services/{device,connection,permission,discovery,printing}/`, đổi `Printer.connectionType/device/lan` (phẳng) thành `Printer.connection: PrinterConnection` (lồng), thêm `PrinterWriteInput` cho luồng Add/Edit.

**Architecture:** Refactor có 1 phần **behavior-preserving** (di chuyển/đổi tên file, mechanical) và 1 phần **data-shape change thật** (`Printer.connection`) buộc cập nhật mọi nơi đọc/ghi field đó, kể cả Zod schema và mọi test fixture dựng `Printer`. Phần shape-change dùng phương pháp "trình biên dịch dẫn đường": đổi type trước, chạy `tsc --noEmit`, sửa từng lỗi tới khi sạch — đáng tin hơn liệt kê tay vì TypeScript báo CHÍNH XÁC mọi chỗ còn sót.

**Tech Stack:** React Native CLI 0.86, TypeScript strict, Jest, Zod, MMKV (`react-native-mmkv`).

**Spec:** `docs/superpowers/specs/2026-08-31-printer-feature-model-reorg.md`

## Global Constraints

- **Behavior-preserving** trừ 1 thay đổi shape duy nhất đã chốt: `Printer.connectionType`/`device`/`lan` → `Printer.connection.{type,device,lan}`. Không đổi hành vi nào khác (không đổi throw→Result, không bọc thêm Input object ngoài `PrinterWriteInput`, không đổi chữ ký `PrintService.print`).
- `PrinterStorage.ts`: bump `CURRENT_STORAGE_VERSION` từ `4` → `5` (destructive reset đã chốt, không migrate — spec §11/§12).
- Không tạo `types/`/`interfaces/`/`contracts/`/`definitions/` catch-all mới. Không 1-file-1-type máy móc — gộp theo concern (spec §4).
- Quy tắc đặt tên (spec §13): `*Props`=input component, `*Input`=tham số hàm/hook, `*Values`=RHF form state, không hậu tố trong `models/`=domain model, `*WriteInput`=input ghi gắn với 1 model, `*Result`=giá trị trả về thật, `*Event`=event/stream, `I*`=contract để implement.
- `git mv` cho mọi file di chuyển (giữ history). Không tạo `index.ts` barrel.
- `npm run verify` (type-check + lint + test) xanh trước **mỗi** commit. Lint hiện có 2 warning pre-existing (`BluetoothTransport.test.ts`, `LanTransport.test.ts`) — không phát sinh thêm.
- Vietnamese cho text hiển thị người dùng (không đổi trong plan này). JSDoc di chuyển cùng code nó mô tả, không viết lại trừ khi tên đổi (vd `PrinterDriverDefinition`→`DriverCapabilities` cần sửa comment nhắc tên cũ).
- Nhánh làm việc: `fix/printer-post-merge`, không tạo nhánh mới. 1 task = 1 commit.
- **Không đổi `components/`** ngoài những chỗ compiler bắt buộc (đọc `printer.connectionType`/`device`/`lan` trực tiếp) — không phải 1 đợt dọn UI riêng (spec §16).

---

### Task 1: `errors/PrinterError.ts` + `models/printing/PrintType.ts` (leaf, zero shape change)

**Files:**
- `git mv src/features/printer/types/PrinterError.ts src/features/printer/errors/PrinterError.ts`
- `git mv src/features/printer/types/__tests__/PrinterError.test.ts src/features/printer/errors/__tests__/PrinterError.test.ts`
- `git mv src/features/printer/types/printConfiguration.types.ts src/features/printer/models/printing/PrintType.ts`
- Test: không có test riêng cho `printConfiguration.types.ts` — kiểm tra `types/__tests__/` có file nào tên khác không (nếu có, move theo).
- Modify: mọi importer của 2 file trên (rất nhiều — `PrinterError` gần như mọi driver/service/hook/test; `PrintType`/`PRINT_TYPE_LABELS` cũng nhiều).

**Interfaces:**
- Consumes: không (task đầu, không phụ thuộc gì đã đổi hôm nay).
- Produces: `errors/PrinterError.ts` → `PrinterErrorCode`, `PrinterError`, `PrinterErrorException`, `errorCodeOf` (tên export **không đổi**). `models/printing/PrintType.ts` → `PrintType`, `PRINT_TYPE_LABELS` (tên export không đổi).

- [ ] **Step 1:** `git mv` 2 file chính + test đi kèm (nếu có) như trên. Nội dung **không đổi 1 dòng nào** — chỉ đổi vị trí.
- [ ] **Step 2:** Chạy `git grep -rn "from '.*types/PrinterError'" src/ App.tsx` và `git grep -rn "from '.*types/printConfiguration.types'" src/ App.tsx` — với MỖI kết quả, tính lại relative path đúng bằng cách so độ sâu file nguồn với `errors/PrinterError.ts` (con trực tiếp của `printer/`, cùng cấp `types/` cũ — nếu import cũ là `../types/PrinterError` thì giữ nguyên số `../`, chỉ đổi `types` → `errors`; áp dụng tương tự cho `models/printing/PrintType.ts` nhưng đây đi SÂU HƠN 1 cấp so với `types/` cũ — mọi import cần THÊM 1 `../`, trừ nơi đã cùng ở trong `models/printing/` thì đường dẫn ngắn hơn).
- [ ] **Step 3:** Sửa từng import theo tính toán ở Step 2. Đặc biệt chú ý các file test dùng `jest.mock('...PrinterError')`/`jest.requireMock(...)` — sửa cả chuỗi trong `jest.mock()`, không chỉ dòng `import`.
- [ ] **Step 4:** `npx tsc --noEmit` — sửa tới khi sạch (mọi lỗi còn lại là import path sai theo Step 2/3).
- [ ] **Step 5:** `npm run verify` xanh.
- [ ] **Step 6:** Commit: `refactor: PrinterError -> errors/, PrintType -> models/printing/`

---

### Task 2: `models/media/PrintMedia.ts` + `models/printing/{PrintDocument,PrintJob}.ts` (leaf, zero shape change)

**Files:**
- Create `src/features/printer/models/media/PrintMedia.ts` — cắt `PrintMedia`, `PrintMediaType`, `CutterMode`, `PaperSize` ra khỏi `types/printer.types.ts` (nội dung y hệt, chỉ đổi nơi ở — xem nội dung hiện tại của các export này trong `types/printer.types.ts` dòng 19, 47-80). **KHÔNG xoá** `types/printer.types.ts` ở task này — nó vẫn còn nhiều export khác dùng tới Task 5. Chỉ **thêm** file mới, để 2 nơi cùng tồn tại tạm — Task 5 mới xoá file gốc.
- `git mv src/features/printer/types/printDocument.types.ts src/features/printer/models/printing/PrintDocument.ts`
- `git mv src/features/printer/types/printJob.types.ts src/features/printer/models/printing/PrintJob.ts`
- Modify: mọi importer của `PrintMedia`/`PrintMediaType`/`CutterMode`/`PaperSize` (từ `types/printer.types`) → trỏ sang `models/media/PrintMedia`; mọi importer `printDocument.types`/`printJob.types` → `models/printing/{PrintDocument,PrintJob}`.

**Interfaces:**
- Consumes: `errors/PrinterError.ts` (Task 1, dùng trong `PrintJob.ts`).
- Produces: `models/media/PrintMedia.ts` → `PrintMedia`, `PrintMediaType`, `CutterMode`, `PaperSize`. `models/printing/PrintDocument.ts` → `PrintElement` (+ 7 variant), `PrintDocument`. `models/printing/PrintJob.ts` → `PrintJobStatus`, `PrintJob`, `PrintResultStatus`, `PrintResult`.

- [ ] **Step 1:** Tạo `models/media/PrintMedia.ts` với nội dung copy nguyên văn `PrintMediaType`, `CutterMode`, `PaperSize`, interface `PrintMedia` từ `types/printer.types.ts` (giữ JSDoc). `types/printer.types.ts` **giữ nguyên các export này** (trùng lặp tạm thời — chấp nhận, giống pattern Task 4 của đợt reorg `PrinterService` hôm trước).
- [ ] **Step 2:** `git mv` `printDocument.types.ts` → `models/printing/PrintDocument.ts`, `printJob.types.ts` → `models/printing/PrintJob.ts`. Sửa import nội bộ trong `PrintJob.ts` (`from './PrinterError'` → `from '../../errors/PrinterError'`, `from './driver.types'` → tạm giữ `from '../../types/driver.types'` — Task 3 mới xử lý — hoặc trỏ thẳng luôn nếu Task 3 làm trước; **thứ tự task này giả định làm tuần tự 1→2→3→…**, nên tại đây `driver.types.ts` CHƯA di chuyển, giữ `from '../../types/driver.types'`; `from './printConfiguration.types'` → `from './PrintType'` (đã move ở Task 1, cùng thư mục `models/printing/`)).
- [ ] **Step 3:** Sửa MỌI import `PrintMedia`/`PrintMediaType`/`CutterMode`/`PaperSize` từ `../types/printer.types` (hoặc biến thể độ sâu khác) sang `models/media/PrintMedia` — dùng `git grep -rn "PrintMediaType\|CutterMode\b" src/ App.tsx` để tìm, kèm mọi nơi `import type { PrintMedia }`.
- [ ] **Step 4:** Sửa MỌI import `printDocument.types`/`printJob.types` sang path mới.
- [ ] **Step 5:** `npx tsc --noEmit` → sửa tới sạch.
- [ ] **Step 6:** `npm run verify` xanh.
- [ ] **Step 7:** Commit: `refactor: PrintMedia -> models/media/, PrintDocument+PrintJob -> models/printing/`

---

### Task 3: `drivers/IPrinterDriver.ts` + `drivers/DriverCapabilities.ts` (rename)

**Files:**
- `git mv src/features/printer/types/driver.types.ts src/features/printer/drivers/IPrinterDriver.ts`
- `git mv src/features/printer/drivers/driverDefinitions.ts src/features/printer/drivers/DriverCapabilities.ts`
- `git mv src/features/printer/drivers/__tests__/driverDefinitions.test.ts src/features/printer/drivers/__tests__/DriverCapabilities.test.ts` (tên file test hiện tại là `driverDefinitions.test.ts` theo lần reorg trước — xác nhận bằng `ls drivers/__tests__/` trước khi mv).
- Modify: `drivers/DriverCapabilities.ts` bên trong đổi export `PRINTER_DRIVER_DEFINITIONS` → `DRIVER_CAPABILITIES`, `getDriverDefinition` → `getDriverCapabilities`, interface `PrinterDriverDefinition` → `DriverCapabilities`. Sửa JSDoc nhắc "definitions"/"Definition" thành "capabilities"/"Capabilities" cho khớp.
- Modify: mọi importer `types/driver.types` (→ `drivers/IPrinterDriver`) và mọi importer `getDriverDefinition`/`PRINTER_DRIVER_DEFINITIONS`/`PrinterDriverDefinition` (→ tên mới, path `drivers/DriverCapabilities`).

**Interfaces:**
- Consumes: `models/printer/PrinterConnection`... **CHƯA CÓ** (Task 5 mới tạo) — `driver.types.ts` hiện tại import `ConnectionType`/`DeviceScanEvent`/`Printer`/`PrinterDeviceInfo`/`PrinterDriver`/`PrinterStatus` từ `types/printer.types` — TẠI TASK NÀY file đó **vẫn còn** (Task 5 mới xoá), giữ nguyên import trỏ `../types/printer.types` cho tới Task 5 rồi sửa lại 1 lần.
- Produces: `drivers/IPrinterDriver.ts` → `Unsubscribe`, `PrintDocuments`, `PrintOptions`, `IPrinterDriver` (tên export không đổi, chỉ path đổi). `drivers/DriverCapabilities.ts` → `DRIVER_CAPABILITIES`, `getDriverCapabilities`, interface `DriverCapabilities`.

- [ ] **Step 1:** `git mv` `types/driver.types.ts` → `drivers/IPrinterDriver.ts`. Sửa import nội bộ: `from './printer.types'` → `from '../types/printer.types'` (đổi vì file chuyển từ `types/` sang `drivers/`, cùng cấp với `types/` nên `../types/printer.types`); `from './printDocument.types'` → `from '../models/printing/PrintDocument'` (đã move ở Task 2).
- [ ] **Step 2:** `git mv` `drivers/driverDefinitions.ts` → `drivers/DriverCapabilities.ts` (cùng thư mục, chỉ đổi tên file). Sửa nội dung: đổi 3 tên export như trên, giữ nguyên logic (`DEFAULT_MEDIA`, cấu trúc record theo `PrinterDriverType`).
- [ ] **Step 3:** `git mv` file test tương ứng, sửa import + tên gọi trong assertion (`PRINTER_DRIVER_DEFINITIONS.escpos...` → `DRIVER_CAPABILITIES.escpos...`, `getDriverDefinition(...)` → `getDriverCapabilities(...)`). Không đổi test case, chỉ đổi tên gọi theo rename.
- [ ] **Step 4:** Sửa mọi importer 2 file trên trong toàn repo (`git grep -rn "driver.types'\|getDriverDefinition\|PRINTER_DRIVER_DEFINITIONS\|PrinterDriverDefinition\b" src/ App.tsx`).
- [ ] **Step 5:** `npx tsc --noEmit` → sửa tới sạch.
- [ ] **Step 6:** `npm run verify` xanh.
- [ ] **Step 7:** Commit: `refactor: driver.types.ts -> drivers/IPrinterDriver.ts, driverDefinitions -> DriverCapabilities`

---

### Task 4: `models/printer/{PrinterCapabilities,PrinterDriver,PrinterDevice,PrinterStatus}.ts` (pure move, KHÔNG đổi shape `Printer` — đó là Task 5)

**Files:**
- Create `models/printer/PrinterCapabilities.ts` — cắt `PrinterCapabilities` từ `types/printer.types.ts` (dòng 82-85).
- Create `models/printer/PrinterDriver.ts` — cắt `PrinterDriverType`, `DriverSource`, `TsplRenderMode`, `TsplCodepage`, `TsplFontConfig`, `TsplInternalFontConfig`, `TsplDriverConfig`, `EscPosDriverConfig`, `PrinterDriverConfig`, `PrinterDriver` (dòng 4-9, 21-37, 133-180 của `types/printer.types.ts`).
- Create `models/printer/PrinterDevice.ts` — cắt `ConnectionType`, `PrinterDevice`, `UsbRawDevice`, `PrinterLanConfig`, `PrinterDeviceInfo`, `DeviceScanEventType`, `DeviceScanEvent` (dòng 11-17, 99-131, 201-214).
- Create `models/printer/PrinterStatus.ts` — cắt `PrinterStatus` (dòng 87-97).
- **KHÔNG xoá `types/printer.types.ts` ở task này** — nó vẫn export `Printer` (Task 5 mới xử lý field đó). Xoá hẳn `types/printer.types.ts` xảy ra cuối Task 5.
- Modify: mọi importer của các type/enum trên (rất nhiều — `PrinterDriverType`, `ConnectionType`, `PrinterStatus`, `DriverSource`, `TsplRenderMode` v.v. dùng khắp `drivers/`, `services/`, `hooks/`, `components/`, test).

**Interfaces:**
- Consumes: `models/media/PrintMedia.ts` (Task 2, `PrinterDriverConfig` variant cần `media: PrintMedia`), `errors/PrinterError.ts` (Task 1, `DeviceScanEvent.error?: PrinterError`).
- Produces: 4 file trên, export y hệt tên cũ (không đổi tên type/enum nào ở task này).

- [ ] **Step 1:** Tạo 4 file, copy nguyên văn nội dung + JSDoc theo nhóm đã liệt kê ở Files. `PrinterDriver.ts` import `PrintMedia` từ `../media/PrintMedia`, import `PrintType` từ `../printing/PrintType` (`PrinterDriver.contentTypes: PrintType[]`). `PrinterDevice.ts` import `PrinterError` từ `../../errors/PrinterError`.
- [ ] **Step 2:** `npx tsc --noEmit` — sẽ báo lỗi trùng export (`Printer.types.ts` VÀ file mới cùng export `PrinterDriverType` chẳng hạn) CHỈ KHI có chỗ import cả 2 — bình thường sẽ không lỗi vì đây là 2 module riêng biệt, TypeScript không cấm 2 file cùng tên type. Bỏ qua bước lo ngại này, tiếp tục.
- [ ] **Step 3:** Sửa từng importer theo nhóm — dùng `git grep` cho từng tên: `PrinterDriverType`, `DriverSource`, `TsplRenderMode`, `TsplCodepage`, `TsplFontConfig`, `TsplInternalFontConfig`, `TsplDriverConfig`, `EscPosDriverConfig`, `PrinterDriverConfig`, `ConnectionType`, `PrinterDevice`, `UsbRawDevice`, `PrinterLanConfig`, `PrinterDeviceInfo`, `DeviceScanEvent`, `DeviceScanEventType`, `PrinterStatus`, `PrinterCapabilities` — đổi import path sang file mới tương ứng. Nhiều file sẽ cần import từ 2-3 file mới cùng lúc (gộp thành 1 dòng `import { X, Y } from '../models/printer/PrinterDriver'` nếu cùng file).
- [ ] **Step 4:** `npx tsc --noEmit` → sửa tới sạch (mọi lỗi còn lại chỉ là import path).
- [ ] **Step 5:** `npm run verify` xanh — chú ý: `Printer` interface (còn ở `types/printer.types.ts`) vẫn tham chiếu `PrinterDriver`/`PrinterCapabilities` — nó tự resolve qua import mới nếu Step 3 đã sửa file đó; nếu `types/printer.types.ts` báo lỗi thiếu định nghĩa cục bộ, thêm `import` từ 4 file mới NGAY TRONG `types/printer.types.ts` (file này sẽ bị xoá hẳn ở Task 5, chấp nhận sửa tạm).
- [ ] **Step 6:** Commit: `refactor: PrinterCapabilities/PrinterDriver/PrinterDevice/PrinterStatus -> models/printer/`

---

### Task 5: `models/printer/Printer.ts` (Printer + PrinterConnection, **ĐỔI SHAPE**) + `forms/addPrinter/*` + storage version bump — TASK LỚN NHẤT, RỦI RO NHẤT

**Files:**
- Create `src/features/printer/models/printer/Printer.ts` — `Printer` (shape mới, `connection: PrinterConnection`), `PrinterConnection` (mới).
- `git mv src/features/printer/schemas/printerFormSchema.ts` → tách 3: `forms/addPrinter/LanConnectionSchema.ts`, `forms/addPrinter/PrinterDisplaySchema.ts`, `forms/addPrinter/PrinterSchema.ts`.
- `git mv src/features/printer/schemas/__tests__/printerFormSchema.test.ts` → tách theo 3 file trên (đọc nội dung test hiện tại trước khi tách, giữ mọi `it(...)` — chia theo describe block đang có, thường tương ứng `lanConnectionSchema`/`printerDisplaySchema`/`printerSchema`).
- Delete: `src/features/printer/types/printer.types.ts`, `src/features/printer/types/__tests__/printer.types.test.ts` (sau khi đã tách hết ở Task 4 + tại task này).
- Modify: `storage/PrinterStorage.ts` (`CURRENT_STORAGE_VERSION = 4` → `5`).
- Modify (nội dung, không chỉ import): mọi nơi đọc/ghi `printer.connectionType`/`printer.device`/`printer.lan` trực tiếp trên 1 giá trị kiểu `Printer` — danh sách đã biết (KHÔNG đầy đủ, dùng `tsc` để tìm nốt):
  - `services/PrinterRepository.ts` (`withRecomputedIdentity` đọc 3 field này để gọi `resolveIdentityKey`)
  - `services/PrinterConnectionLock.ts` (`resourceKeyFor(printer, driverType)` đọc 3 field)
  - `adapters/IPrinterAdapter.ts` (`toConnectTarget(printer)` đọc `printer.connectionType`/`.device`/`.lan` — xem nội dung hiện tại dòng 66-78)
  - `hooks/useAddPrinterFlow.ts` (`buildDraftPrinter()` build object literal có `connectionType`/`device`/`lan` phẳng)
  - `hooks/addPrinter/useConnectionSetup.ts` (đọc `initialValues?.connectionType`, `initialValues?.device` để init state — **state cục bộ `connectionType`/`selectedDevice` bên trong hook giữ tên KHÔNG đổi**, chỉ chỗ đọc từ `initialValues` (kiểu `Printer`) đổi thành `initialValues?.connection.type`/`.device`)
  - `forms/addPrinter/PrinterSchema.ts` (chính schema, xem Step 3)
  - `testing/printerFixtures.ts`, `testing/printerServiceTestKit.ts` (fixture dùng chung — sửa 1 lần, cascade fix hầu hết test khác dùng chúng)
  - Mọi `*.test.ts`/`*.test.tsx` tự dựng object literal `Printer`/`basePrinter` override `connectionType`/`device`/`lan` KHÔNG qua fixture chung (tìm qua `tsc`).

**Interfaces:**
- Consumes: `models/printer/{PrinterCapabilities,PrinterDriver,PrinterDevice,PrinterStatus}.ts` (Task 4), `models/media/PrintMedia.ts` (Task 2), `drivers/DriverCapabilities.ts` (Task 3, dùng trong `PrinterSchema.ts` qua `getDriverCapabilities`).
- Produces: `Printer` (shape mới), `PrinterConnection` — mọi task sau (6, 7, 8, 9) và mọi phần còn lại của codebase build trên shape này.

- [ ] **Step 1: Tạo `models/printer/Printer.ts`**

```ts
import type { PrinterDriver } from './PrinterDriver';
import type { PrinterCapabilities } from './PrinterCapabilities';
import type { ConnectionType, PrinterDevice, PrinterLanConfig } from './PrinterDevice';

export interface PrinterConnection {
  type: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;
  /** `1..2` phần tử (escpos + tspl) — enforce ở schema. */
  drivers: PrinterDriver[];
  connection: PrinterConnection;
  /** Chỉ phụ thuộc connection, không phụ thuộc driver — xem `services/discovery/PrinterResolver.ts`. */
  identityKey: string;
  capabilities: PrinterCapabilities;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Xoá `types/printer.types.ts` + test của nó**

```bash
git rm src/features/printer/types/printer.types.ts
git rm src/features/printer/types/__tests__/printer.types.test.ts
```
(Nếu Task 4 để lại import tạm trong file này — không còn quan trọng, file bị xoá.) Viết 1 test mới `models/printer/__tests__/Printer.test.ts` giữ lại 2-3 case ý nghĩa nhất từ file cũ (kiểm tra 1 `Printer` hợp lệ dựng được, `CutterMode` đủ 3 giá trị — case này thật ra thuộc `PrintMedia`, chuyển sang `models/media/__tests__/PrintMedia.test.ts` nếu chưa có) — không bắt buộc giữ y nguyên toàn bộ, đây là test cho shape mới.

- [ ] **Step 3: Tách + sửa shape `forms/addPrinter/`**

`LanConnectionSchema.ts`, `PrinterDisplaySchema.ts` — copy nguyên văn `lanConnectionSchema`/`printerDisplaySchema` + type, KHÔNG đổi (không liên quan shape `Printer`).

`PrinterSchema.ts` — copy `printMediaSchema`, `printerCapabilitiesSchema`, `printContentTypeSchema`, `tsplFontConfigSchema`, `tsplInternalFontConfigSchema`, `tsplDriverConfigSchema`, `escPosDriverConfigSchema`, `printerDriverConfigSchema`, `printerDriverSchema`, `printerDeviceSchema`, `printerLanConfigSchema`, `printerSchema`, `PrinterValidated` — SỬA phần `printerSchema`:

```ts
const printerConnectionSchema = z.object({
  type: z.enum([ConnectionType.usb, ConnectionType.bluetooth, ConnectionType.lan]),
  device: printerDeviceSchema.optional(),
  lan: printerLanConfigSchema.optional(),
});

export const printerSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    vendor: z.string().optional(),
    model: z.string().optional(),
    drivers: z.array(printerDriverSchema).min(1).max(2),
    connection: printerConnectionSchema,
    identityKey: z.string().min(1),
    capabilities: printerCapabilitiesSchema,
    autoReconnect: z.boolean(),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((printer, ctx) => {
    if (printer.connection.type === ConnectionType.lan) {
      if (!printer.connection.lan) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'connection.type lan bắt buộc phải có connection.lan' });
      if (printer.connection.device) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'connection.type lan không được có connection.device' });
    } else {
      if (!printer.connection.device) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `connection.type ${printer.connection.type} bắt buộc phải có connection.device` });
      }
      if (printer.connection.lan) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `connection.type ${printer.connection.type} không được có connection.lan` });
      }
    }
    // ... phần content-type + driver-type dedup GIỮ NGUYÊN, không liên quan connection
  });
```
Import `getDriverCapabilities` (Task 3), `PrintMedia` từ `models/media/PrintMedia`, `ConnectionType`/`DriverSource`/`TsplRenderMode`/`TsplCodepage`/`PrinterDriverType` từ `models/printer/PrinterDriver`+`PrinterDevice`, `PrintType` từ `models/printing/PrintType`.

- [ ] **Step 4: Bump storage version**

`storage/PrinterStorage.ts`: `const CURRENT_STORAGE_VERSION = 4;` → `= 5;`.

- [ ] **Step 5: `npx tsc --noEmit` — vòng lặp sửa lỗi (đây là core của task)**

Chạy lệnh, lấy TOÀN BỘ danh sách lỗi. Với mỗi lỗi kiểu "Property 'connectionType' does not exist on type 'Printer'" (hoặc `.device`/`.lan`):
- Nếu code ĐỌC field trên 1 biến `Printer` đã có → đổi thành `.connection.type`/`.connection.device`/`.connection.lan`.
- Nếu code XÂY DỰNG 1 object literal `Printer`/`{ ...basePrinter, connectionType: X, device: Y, lan: Z }` → đổi thành `{ ...basePrinter, connection: { type: X, device: Y, lan: Z } }` (hoặc merge đúng field đang override — xem ví dụ Step 6).
- Nếu lỗi là import path cũ `types/printer.types` còn sót → trỏ sang `models/printer/Printer` (hoặc file Task 4 tương ứng nếu là driver/device/status/capabilities).

Lặp lại `tsc --noEmit` → sửa → tới khi **0 lỗi**. Đây LÀ danh sách file cần sửa — không cần liệt kê tay trước, để trình biên dịch dẫn đường.

- [ ] **Step 6: Ví dụ cụ thể cho 2 chỗ chắc chắn có (đã đọc code, không phải đoán)**

`adapters/IPrinterAdapter.ts` (`toConnectTarget`):
```ts
export const toConnectTarget = (printer: Printer): PrinterConnectTarget => {
  if (printer.connection.type === 'lan') {
    if (!printer.connection.lan) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
    return { connectionType: printer.connection.type, lan: { ip: printer.connection.lan.ip, port: printer.connection.lan.port } };
  }
  if (printer.connection.type === 'bluetooth') {
    if (!printer.connection.device) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
    return { connectionType: printer.connection.type, bluetooth: { deviceId: printer.connection.device.deviceId } };
  }
  const raw = printer.connection.device?.rawDevice as unknown as UsbRawDevice | undefined;
  if (!raw) throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
  return { connectionType: printer.connection.type, usb: { vendorId: Number(raw.vendor_id), productId: Number(raw.product_id) } };
};
```
(`PrinterConnectTarget.connectionType` — field của type KHÁC (`PrinterConnectTarget`, không phải `Printer`) — **KHÔNG đổi tên field đó**, nó không thuộc phạm vi shape change.)

`testing/printerFixtures.ts` (`makePrinter` — tìm factory hiện tại, base có `connectionType: ConnectionType.lan` phẳng ở dòng ~40):
```ts
// trước
{ connectionType: ConnectionType.lan, lan: { ip: '...', port: 9100 }, ... }
// sau
{ connection: { type: ConnectionType.lan, lan: { ip: '...', port: 9100 } }, ... }
```
Áp dụng đúng pattern này cho MỌI factory override (`makePrinter({ connectionType: ... })` — nếu factory nhận override rời qua tham số, cân nhắc đổi chữ ký factory nhận `connection` object thay vì field rời, miễn giữ được mọi call site build đúng — xem nội dung thật của `printerFixtures.ts`/`printerServiceTestKit.ts` trước khi sửa để không đoán sai chữ ký).

- [ ] **Step 7: `npm run verify` xanh — 0 lỗi biên dịch, 0 test đỏ.**

Lưu ý: số lượng test suite/test case **không đổi** (đây không phải thêm/bớt hành vi, chỉ đổi shape) — nếu 1 test đỏ vì assertion cũ đọc `.connectionType` trên KẾT QUẢ trả về (không phải input dựng), sửa assertion sang `.connection.type` — đây là sửa hợp lệ (theo shape mới), không phải "đổi hành vi".

- [ ] **Step 8:** Commit: `refactor!: Printer.connectionType/device/lan -> Printer.connection; forms/ tách từ schemas/; bump storage v5`

  (dấu `!` báo breaking change trong message, đúng quy ước — đây là thay đổi phá vỡ dữ liệu đã lưu, xem Global Constraints.)

---

### Task 6: `storage/PrinterRepository.ts` + `storage/PrinterWriteInput.ts`

**Files:**
- `git mv src/features/printer/services/PrinterRepository.ts src/features/printer/storage/PrinterRepository.ts`
- `git mv src/features/printer/services/__tests__/PrinterRepository.test.ts src/features/printer/storage/__tests__/PrinterRepository.test.ts`
- Create `src/features/printer/storage/PrinterWriteInput.ts`.
- Modify: `PrinterRepository.ts` đổi tham số `addPrinter`/`updatePrinter` từ `Printer` → `PrinterWriteInput`.
- Modify: `hooks/useAddPrinterFlow.ts` (`buildDraftPrinter()` đổi kiểu trả về `Printer` → `PrinterWriteInput`, bỏ `identityKey: ''`/giá trị giả — dùng `identityKey: currentIdentityKey() ?? undefined` thay vì ép `?? ''`).
- Modify: mọi importer `PrinterRepository` (đường dẫn đổi từ `services/PrinterRepository` → `storage/PrinterRepository`).

**Interfaces:**
- Consumes: `models/printer/Printer.ts` (Task 5).
- Produces: `storage/PrinterWriteInput.ts` → `PrinterWriteInput`. `storage/PrinterRepository.ts` → cùng API cũ (`getPrinters`, `savePrinters`, `findOrThrow`, `addPrinter`, `updatePrinter`, `removePrinter`, `setEnabled`, singleton `PrinterRepository`) nhưng `addPrinter`/`updatePrinter` nhận `PrinterWriteInput`.

- [ ] **Step 1:** Tạo `storage/PrinterWriteInput.ts`:
```ts
import type { Printer } from '../models/printer/Printer';

/** Input để tạo/sửa 1 printer — giống Printer nhưng identityKey là GIÁ TRỊ ĐỀ XUẤT, PrinterRepository tự tính lại (không tin caller). */
export type PrinterWriteInput = Omit<Printer, 'identityKey'> & { identityKey?: string };
```
- [ ] **Step 2:** `git mv` `PrinterRepository.ts` + test sang `storage/`. Sửa import nội bộ (đổi độ sâu — `services/` và `storage/` đều là con trực tiếp `printer/`, CÙNG cấp, nên `../types/...`/`../discovery/...` giữ nguyên số `../`; chỉ path cũ trỏ `../discovery/PrinterResolver` cần đổi vì `discovery/` đã nest vào `services/` từ đợt trước — kiểm tra `git grep -n "from '\.\./discovery" src/features/printer/services/PrinterRepository.ts` để lấy path hiện tại chính xác trước khi sửa).
- [ ] **Step 3:** Sửa `addPrinter(printer: Printer)` → `addPrinter(printer: PrinterWriteInput)`, tương tự `updatePrinter`. Bên trong hàm, `withRecomputedIdentity` nhận `PrinterWriteInput`, trả về `Printer` (gán `identityKey` đã tính) — đổi kiểu trả về của `withRecomputedIdentity` từ `Printer` → `Printer` (không đổi, nó LUÔN trả đủ `identityKey` sau khi tính) nhưng tham số đầu vào đổi `Printer` → `PrinterWriteInput`.
- [ ] **Step 4:** Sửa `useAddPrinterFlow.ts`: `buildDraftPrinter(): Printer` → `buildDraftPrinter(): PrinterWriteInput`, xoá gán `identityKey: currentIdentityKey() ?? ''` → `identityKey: currentIdentityKey() ?? undefined`. Import `PrinterWriteInput` từ `../storage/PrinterWriteInput`.
- [ ] **Step 5:** Sửa mọi importer path `services/PrinterRepository` → `storage/PrinterRepository` (`git grep -rn "services/PrinterRepository" src/ App.tsx`).
- [ ] **Step 6:** `npx tsc --noEmit` → sửa tới sạch (chú ý test dựng `Printer` đầy đủ rồi gọi `repository.addPrinter(printer)` — vẫn hợp lệ vì `Printer` là subtype hợp lệ của `PrinterWriteInput`, KHÔNG cần sửa test chỉ vì đổi tham số kiểu — chỉ sửa nếu test cố tình thiếu `identityKey`).
- [ ] **Step 7:** `npm run verify` xanh.
- [ ] **Step 8:** Commit: `refactor: PrinterRepository -> storage/, thêm PrinterWriteInput`

---

### Task 7: `services/` tách `device/`, `connection/`, `permission/`

**Files:**
- `git mv src/features/printer/services/PrinterConnectionLock.ts src/features/printer/services/connection/PrinterConnectionLock.ts`
- `git mv src/features/printer/services/__tests__/PrinterConnectionLock.test.ts src/features/printer/services/connection/__tests__/PrinterConnectionLock.test.ts`
- `git mv src/features/printer/services/PrinterPermissionService.ts src/features/printer/services/permission/PrinterPermissionService.ts`
- `git mv src/features/printer/services/__tests__/PrinterPermissionService.test.ts src/features/printer/services/permission/__tests__/PrinterPermissionService.test.ts`
- `git mv src/features/printer/services/DeviceScanService.ts src/features/printer/services/device/DeviceScanService.ts`
- `git mv src/features/printer/services/__tests__/DeviceScanService.test.ts src/features/printer/services/device/__tests__/DeviceScanService.test.ts`
- `git mv src/features/printer/services/NetworkInfoService.ts src/features/printer/services/device/NetworkInfoService.ts`
- `git mv src/features/printer/services/__tests__/NetworkInfoService.test.ts src/features/printer/services/device/__tests__/NetworkInfoService.test.ts`
- Modify: mọi importer 4 file trên (`PrinterConnectionService.ts`, `PrinterConfigService.ts`, `PrintScheduler.ts` (services/printing/) dùng `PrinterConnectionLock`+`resourceKeyFor`+`connectionResourceKey`; `EscPosDriver.ts`+`TsplDriver.ts` dùng `PrinterPermissionService`; `DeviceScanList.tsx`, `useProtocolDiscovery.ts`, `useAddPrinterFlow.ts`/test dùng `DeviceScanService`; `useConnectionSetup.ts` dùng `NetworkInfoService`).

**Interfaces:**
- Consumes: không phụ thuộc Task 5/6 shape change (các file này không xây `Printer` literal trực tiếp — `PrinterConnectionLock.resourceKeyFor(printer, driverType)` NHẬN `printer: Printer` làm tham số, đọc `.connection.type`/`.device`/`.lan` — **shape change ĐÃ áp dụng ở Task 5** cho nội dung hàm; task này chỉ đổi VỊ TRÍ file, không đổi nội dung logic).
- Produces: cùng API cũ, path mới `services/{connection,permission,device}/*`.

- [ ] **Step 1-4:** `git mv` 8 file (4 chính + 4 test) như trên. Sửa import nội bộ mỗi file theo độ sâu mới (từ `services/X.ts` 1 cấp → `services/connection/X.ts`/`services/permission/X.ts`/`services/device/X.ts` 2 cấp — mọi `../types/...`, `../drivers/...` cần thêm 1 `../`; import app-level `LoggerService` từ `'../../../services/LoggerService'` cần thêm 1 `../` → `'../../../../services/LoggerService'`).
- [ ] **Step 5:** Sửa mọi importer bên ngoài `services/{connection,permission,device}/` — dùng `git grep -rn "services/PrinterConnectionLock\|services/PrinterPermissionService\|services/DeviceScanService\|services/NetworkInfoService" src/ App.tsx` (loại trừ kết quả đã nằm trong `services/connection|permission|device` — đó là các dòng vừa sửa ở Step 1-4).
- [ ] **Step 6:** `npx tsc --noEmit` → sửa tới sạch.
- [ ] **Step 7:** `npm run verify` xanh.
- [ ] **Step 8:** Commit: `refactor: services/ tách device/ connection/ permission/`

---

### Task 8: `models/printing/PrintTarget.ts` + `DiscoveryInput` → `DiscoverPrinterInput`

**Files:**
- Create `src/features/printer/models/printing/PrintTarget.ts` — cắt interface `PrintTarget` khỏi `services/printing/PrintRoutingService.ts`.
- Modify: `services/printing/PrintRoutingService.ts` (xoá định nghĩa `PrintTarget` cục bộ, import từ file mới, export lại `type { PrintTarget }` để không phá import cũ — HOẶC sửa mọi importer trỏ thẳng `models/printing/PrintTarget` nếu số lượng consumer ít; kiểm tra `git grep -rn "PrintTarget" src/` trước khi quyết định).
- Modify: `services/discovery/PrinterDiscoveryService.ts` — đổi tên interface `DiscoveryInput` → `DiscoverPrinterInput` (giữ nguyên vị trí, không tách file — interface 3 dòng).
- Modify: mọi importer `DiscoveryInput` (`useProtocolDiscovery.ts`, test liên quan).

**Interfaces:**
- Consumes: `models/printer/Printer.ts` (Task 5, `PrintTarget.printer: Printer`), `models/printer/PrinterDriver.ts` (`PrintTarget.driver: PrinterDriver`).
- Produces: `models/printing/PrintTarget.ts` → `PrintTarget`. `DiscoverPrinterInput` (rename, cùng file `PrinterDiscoveryService.ts`).

- [ ] **Step 1:** Đọc `services/printing/PrintRoutingService.ts` hiện tại, xác nhận nội dung `PrintTarget` (`{ printer: Printer; driver: PrinterDriver }`). Tạo `models/printing/PrintTarget.ts` với nội dung đó.
- [ ] **Step 2:** Sửa `PrintRoutingService.ts` xoá định nghĩa cục bộ, `import type { PrintTarget } from '../../models/printing/PrintTarget';`, `export type { PrintTarget };` (re-export để `OrderPrintTrigger.ts` hay nơi khác đang `import type { PrintTarget } from '.../PrintRoutingService'` không phải sửa — kiểm tra `git grep -rn "import.*PrintTarget" src/` để xác nhận có bao nhiêu importer thật sự cần path mới trực tiếp).
- [ ] **Step 3:** Sửa `DiscoveryInput` → `DiscoverPrinterInput` trong `PrinterDiscoveryService.ts` + mọi importer.
- [ ] **Step 4:** `npx tsc --noEmit` → sửa tới sạch.
- [ ] **Step 5:** `npm run verify` xanh.
- [ ] **Step 6:** Commit: `refactor: PrintTarget -> models/printing/, DiscoveryInput -> DiscoverPrinterInput`

---

### Task 9: Sweep cuối — xoá `types/`/`schemas/`, sync `ARCHITECTURE.md`, quét sót toàn repo

**Files:**
- Xoá folder `src/features/printer/types/` nếu còn sót file nào (mọi nội dung đã move ở Task 1-5 — xác nhận rỗng rồi `rmdir`, không `rm -rf` mù).
- Xoá folder `src/features/printer/schemas/` (đã tách hết sang `forms/` ở Task 5).
- Modify: `src/features/printer/ARCHITECTURE.md` — sync toàn bộ đường dẫn file được nhắc (`types/*` → path mới, `PrinterService` mentions cũ nếu còn sót, `services/PrinterRepository` → `storage/PrinterRepository`, thêm đoạn mô tả `models/`/`forms/`/`errors/` theo cấu trúc mới). Thêm 1 section mới "Quy ước đặt tên" theo bảng ở spec §13.
- Modify: root `CLAUDE.md` / `NDTCore.App/CLAUDE.md` NẾU chúng liệt kê cấu trúc `printer/` cũ theo tên file cụ thể (kiểm tra trước khi sửa — có thể đã lỗi thời từ trước, không bắt buộc sửa hết, chỉ sửa nếu trực tiếp mâu thuẫn với thay đổi hôm nay).

**Interfaces:**
- Consumes: kết quả cuối cùng của Task 1-8 (toàn bộ cấu trúc mới đã tồn tại và xanh).
- Produces: repo sạch, không còn `types/`/`schemas/`/`definitions/`/`printing/`(top-level)/`discovery/`(top-level) ở gốc `printer/`.

- [ ] **Step 1:** `git grep -rln "from '.*types/\|from '.*schemas/printerFormSchema" src/ App.tsx` — PHẢI rỗng. Nếu còn, đó là sót từ Task 1-5, quay lại sửa task tương ứng (không patch tạm ở đây).
- [ ] **Step 2:** `ls src/features/printer/types src/features/printer/schemas 2>&1` — xác nhận rỗng hoặc không tồn tại; nếu còn file, dừng lại điều tra (không xoá file chưa biết nội dung).
- [ ] **Step 3:** `rmdir` 2 folder nếu rỗng.
- [ ] **Step 4:** Đọc toàn bộ `ARCHITECTURE.md`, sửa mọi đường dẫn/tên đã đổi trong 8 task trước (danh sách tên đổi: `PrinterError`→`errors/`, `PrintType`→`models/printing/`, `PrintMedia`→`models/media/`, `PrintDocument`/`PrintJob`→`models/printing/`, `driver.types.ts`→`drivers/IPrinterDriver.ts`, `driverDefinitions`→`DriverCapabilities` + rename export, `Printer`+4 model khác→`models/printer/`, `printerFormSchema.ts`→`forms/addPrinter/*`, `PrinterRepository`→`storage/`, `services/{connection,permission,device}/`, `PrintTarget`→`models/printing/`, `DiscoveryInput`→`DiscoverPrinterInput`). Thêm section "Quy ước đặt tên" (bảng spec §13).
- [ ] **Step 5:** Full sweep: `git grep -rn "connectionType\b" src/features/printer src/App.tsx App.tsx` — mọi kết quả còn lại PHẢI là biến cục bộ độc lập (vd `const [connectionType, setConnectionType]` trong hook UI state, hoặc field của `PrinterConnectTarget`/`ConnectionResourceKeyInput` — các type KHÁC `Printer`, không đổi) — KHÔNG được còn truy cập `.connectionType` trên biến kiểu `Printer`. Xác nhận thủ công từng kết quả.
- [ ] **Step 6:** `npm run verify` xanh — chạy đầy đủ, ghi lại số suite/test cuối cùng.
- [ ] **Step 7:** Commit: `docs: sync ARCHITECTURE.md sau reorg models/forms/services; xoá types/ schemas/`

---

## Self-Review

**1. Phủ spec:** §0-1 (mục tiêu, non-goals) → Global Constraints. §2-4 (PrinterIdentity bỏ, IPrinterDriver, gộp concern) → Task 3-4. §5 (errors/) → Task 1. §6 (drivers/) → Task 3. §7-8 (forms/, PrinterWriteInput) → Task 5-6. §9 (DiscoverPrinterInput) → Task 8. §10 (PrintTarget) → Task 8. §11 (Printer.connection + storage version) → Task 5. §17 (services/ subfolder + PrinterRepository→storage/) → Task 6-7. §13 (naming convention doc) → Task 9.

**2. Placeholder scan:** Không có "TBD/TODO". Các chỗ nói "xem nội dung hiện tại của X trước khi sửa" là hướng dẫn đọc-trước-khi-viết (bắt buộc vì file thật dài hơn có thể trích hết vào plan), kèm đủ ngữ cảnh (tên field, vị trí dòng ước lượng) để không phải đoán — không phải placeholder che giấu thiếu sót.

**3. Type consistency:** `PrinterWriteInput` (không phải `AddPrinterInput`) dùng nhất quán Task 5→6→9. `DriverCapabilities`/`getDriverCapabilities`/`DRIVER_CAPABILITIES` nhất quán Task 3→5(dùng trong PrinterSchema)→9. `PrinterConnection`/`Printer.connection` nhất quán Task 5→6→7→8→9. Thứ tự task tôn trọng phụ thuộc: Task 1(errors,PrintType) → Task 2(PrintMedia,PrintDocument,PrintJob, cần errors) → Task 3(IPrinterDriver cần PrintDocument, DriverCapabilities) → Task 4(4 model printer, cần PrintMedia+PrintType+errors) → Task 5(Printer+PrinterConnection, cần Task 4 + DriverCapabilities Task 3; XOÁ types/printer.types.ts ở đây) → Task 6(PrinterRepository+PrinterWriteInput, cần Printer Task 5) → Task 7(services/ subfolder, độc lập shape, có thể làm sau Task 5 để tránh sửa 2 lần) → Task 8(PrintTarget cần Printer, DiscoverPrinterInput độc lập) → Task 9(sweep, cần mọi task trước xong).

**Rủi ro cao nhất:** Task 5 (đổi shape + storage version bump — mất dữ liệu đã lưu, đã xác nhận với user). Giảm bằng phương pháp compiler-driven (Step 5) thay vì liệt kê tay — TypeScript strict đảm bảo không sót field access nào. Lưới an toàn thứ 2: `npm run verify` sau mỗi task, không tiến task sau nếu task trước còn đỏ.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-printer-feature-model-reorg.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch fresh subagent mỗi task, review giữa các task, iteration nhanh.

**2. Inline Execution** - chạy trong session này, batch + checkpoint.

Chọn cách nào?
