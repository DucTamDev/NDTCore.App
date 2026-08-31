# Printer Module Restructure (gói A+B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách 2 god-file (`PrinterService.ts` 402d, `useAddPrinterFlow.ts` 581d) và `PrinterInfoCard.tsx` thành các đơn vị 1-trách-nhiệm, và dọn `utils/` catch-all — không đổi hành vi, không thêm layer DDD.

**Architecture:** Refactor thuần behavior-preserving. `PrinterService` → 4 service factory trong `services/` (`PrinterRepository`, `PrinterConnectionService`, `PrinterConfigService`, `DeviceScanService`), giữ nguyên pattern `createX(deps)` + singleton export cùng file. `useAddPrinterFlow` → coordinator (giữ vị trí cũ) + 4 hook con trong `hooks/addPrinter/`. Rule media (`cutter`/`validation`/`paperSpec`) ra `media/`; `driverConfig` + `DriverRegistry` về `drivers/`; hằng `config/` gộp vào `constants.ts`. Test đi theo file — assertion **di chuyển nguyên văn**, không viết lại.

**Tech Stack:** React Native CLI 0.86, TypeScript strict, Jest + react-test-renderer, React Hook Form + Zod, Redux Toolkit, MMKV.

**Spec:** `docs/superpowers/specs/2026-08-31-printer-module-restructure-proposal.md`

## Global Constraints

- **KHÔNG** tạo folder `domain/` `application/` `infrastructure/` `ui/`. Giữ taxonomy hiện có.
- **KHÔNG** tạo barrel / `index.ts` re-export. Import trực tiếp từng file.
- Mọi service mới giữ pattern hiện tại: `export const createX = (deps) => ({...})` **và** `export const X = createX(<wired deps>)` **trong cùng 1 file**.
- `print(printerId, documents, printType)` (bản low-level, `PrintScheduler` gọi) **ở lại `PrinterConnectionService`** — KHÔNG chuyển sang `printing/PrintService.ts` (sẽ trùng tên `print` trong 1 file). Đây là ruling khác spec §4; ghi vào ledger.
- Refactor behavior-preserving: KHÔNG sửa logic, KHÔNG thêm/bớt test case. Assertion di chuyển nguyên văn sang file mới; chỉ đổi `import` và tên factory/mock.
- Di chuyển file bằng `git mv` để giữ history.
- Toàn bộ text hiển thị người dùng: tiếng Việt (không có chuỗi nào đổi trong plan này).
- Chạy `npm run verify` (type-check + lint + test) xanh trước **mỗi** commit. Lint hiện có 2 warning pre-existing — không phát sinh thêm.
- Không path alias — import bằng relative path.
- Component UI thuần (`components/*` subcomponent) không có test file — theo convention repo.
- Nhánh làm việc: `fix/printer-post-merge`. Không tạo nhánh mới. Commit khi task xong.

---

### Task 1: Gộp `config/` → `constants.ts`

**Files:**
- Create: `src/features/printer/constants.ts`
- Delete: `src/features/printer/config/printerConfig.ts` (và folder `config/` rỗng theo)
- Modify: `src/features/printer/transports/BluetoothTransport.ts:4`
- Modify: `src/features/printer/transports/LanTransport.ts:4`

**Interfaces:**
- Consumes: nothing (task đầu)
- Produces: `export const CONNECT_TIMEOUT_MS = 10000` tại `src/features/printer/constants.ts`

- [ ] **Step 1: Tạo `constants.ts`**

```ts
// src/features/printer/constants.ts
/** Thời gian chờ tối đa khi kết nối transport (Bluetooth/LAN) trước khi coi là timeout. */
export const CONNECT_TIMEOUT_MS = 10000;
```

- [ ] **Step 2: Đổi import ở 2 transport**

Trong `BluetoothTransport.ts` và `LanTransport.ts`, đổi:
```ts
import { CONNECT_TIMEOUT_MS } from '../config/printerConfig';
```
thành:
```ts
import { CONNECT_TIMEOUT_MS } from '../constants';
```

- [ ] **Step 3: Xoá file + folder cũ**

```bash
git rm src/features/printer/config/printerConfig.ts
```
Nếu `src/features/printer/config/` còn file khác → giữ lại; hiện chỉ có 1 file nên folder biến mất.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: type-check clean, lint không thêm warning, 74 test suite pass (`BluetoothTransport.test.ts` / `LanTransport.test.ts` vẫn xanh — không mock `printerConfig`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: gộp printer config/ 1-hằng vào constants.ts"
```

---

### Task 2: Tách rule media ra `media/`

**Files:**
- `git mv src/features/printer/utils/cutter.ts` → `src/features/printer/media/cutter.ts`
- `git mv src/features/printer/utils/mediaValidation.ts` → `src/features/printer/media/validation.ts`
- `git mv src/features/printer/utils/paperSize.ts` → `src/features/printer/media/paperSpec.ts`
- `git mv src/features/printer/utils/__tests__/cutter.test.ts` → `src/features/printer/media/__tests__/cutter.test.ts`
- `git mv src/features/printer/utils/__tests__/mediaValidation.test.ts` → `src/features/printer/media/__tests__/validation.test.ts`
- `git mv src/features/printer/utils/__tests__/paperSize.test.ts` → `src/features/printer/media/__tests__/paperSpec.test.ts`
- Modify importers (bảng dưới)

**Interfaces:**
- Consumes: nothing
- Produces (đường dẫn mới, tên export KHÔNG đổi):
  - `src/features/printer/media/cutter.ts` → `resolveEffectiveCutterMode(media: PrintMedia): CutterMode`
  - `src/features/printer/media/validation.ts` → `dieCutRowOverflow(media): string | null`, `dieCutMediaError(media): string | null`
  - `src/features/printer/media/paperSpec.ts` → `DOTS_PER_MM`, `PAPER_SIZE_SPECS`

- [ ] **Step 1: `git mv` 6 file** (3 nguồn + 3 test) vào `media/` và `media/__tests__/`.

- [ ] **Step 2: Sửa import nội bộ giữa 3 file vừa move**

`media/validation.ts` đang import `./paperSize` → đổi thành `./paperSpec`:
```ts
import { PAPER_SIZE_SPECS } from './paperSpec';
```
`media/cutter.ts` và `media/paperSpec.ts` chỉ import từ `../types/printer.types` → đổi `../` không đổi (vẫn 1 cấp): giữ `from '../types/printer.types'`. `media/` cùng độ sâu với `utils/` nên mọi `../` giữ nguyên.

- [ ] **Step 3: Sửa import ở file test vừa move**

3 file test đổi `from '../<x>'` (không đổi — vẫn `../` vì `media/__tests__/` cùng shape với `utils/__tests__/`), chỉ đổi tên file:
- `cutter.test.ts`: `from '../cutter'` giữ nguyên.
- `validation.test.ts`: `from '../mediaValidation'` → `from '../validation'`.
- `paperSpec.test.ts`: `from '../paperSize'` → `from '../paperSpec'`.

- [ ] **Step 4: Sửa import ở các file consumer**

| File | Dòng cũ | Dòng mới |
|---|---|---|
| `drivers/tspl/TsplEncoder.ts` | `from '../../utils/paperSize'` | `from '../../media/paperSpec'` |
| `drivers/escpos/EscPosTextBuilder.ts` | `from '../../utils/paperSize'` | `from '../../media/paperSpec'` |
| `drivers/tspl/strategies/TsplBitmapStrategy.ts` | `from '../../../utils/paperSize'` | `from '../../../media/paperSpec'` |
| `hooks/useBillImageCapture.tsx` | `from '../utils/paperSize'` | `from '../media/paperSpec'` |
| `drivers/tspl/strategies/TsplInternalFontStrategy.ts` | `from '../../../utils/cutter'` | `from '../../../media/cutter'` |
| `drivers/tspl/strategies/TsplTrueTypeStrategy.ts` | `from '../../../utils/cutter'` | `from '../../../media/cutter'` |
| `drivers/tspl/strategies/TsplBitmapStrategy.ts` | `from '../../../utils/cutter'` | `from '../../../media/cutter'` |
| `drivers/escpos/EscPosDriver.ts` | `from '../../utils/cutter'` | `from '../../media/cutter'` |
| `components/DriverMediaSection.tsx` | `from '../utils/mediaValidation'` | `from '../media/validation'` |
| `schemas/printerFormSchema.ts` | `from '../utils/mediaValidation'` | `from '../media/validation'` |
| `hooks/useAddPrinterFlow.ts` | `from '../utils/mediaValidation'` | `from '../media/validation'` |

- [ ] **Step 5: Quét sót**

Run: `git grep -n "utils/cutter\|utils/mediaValidation\|utils/paperSize"`
Expected: không còn kết quả.

- [ ] **Step 6: Verify**

Run: `npm run verify`
Expected: tất cả xanh. Các test `media/__tests__/{cutter,validation,paperSpec}.test.ts` chạy đúng như trước.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: tách rule media (cutter/validation/paperSpec) ra printer/media/"
```

---

### Task 3: `driverConfig` + `DriverRegistry` về `drivers/`

**Files:**
- `git mv src/features/printer/utils/driverConfig.ts` → `src/features/printer/drivers/driverConfig.ts`
- `git mv src/features/printer/utils/__tests__/driverConfig.test.ts` → `src/features/printer/drivers/__tests__/driverConfig.test.ts`
- `git mv src/features/printer/printing/DriverRegistry.ts` → `src/features/printer/drivers/DriverRegistry.ts`
- `git mv src/features/printer/printing/DriverRegistry.web.ts` → `src/features/printer/drivers/DriverRegistry.web.ts`
- `git mv src/features/printer/printing/__tests__/DriverRegistry.web.test.ts` → `src/features/printer/drivers/__tests__/DriverRegistry.web.test.ts`
- Modify importers (bảng dưới)

**Interfaces:**
- Consumes: `media/` (Task 2) — không trực tiếp, nhưng `driverConfig.ts` KHÔNG import media (chỉ `../types/printer.types`).
- Produces (đường dẫn mới):
  - `src/features/printer/drivers/driverConfig.ts` → `tsplRenderModeOf`, `mediaOf`, `paperSizeOf`, `DEFAULT_TSPL_INTERNAL_FONT`
  - `src/features/printer/drivers/DriverRegistry.ts` → `DriverRegistry: Record<PrinterDriverType, IPrinterDriver>`

- [ ] **Step 1: `git mv` 5 file.**

- [ ] **Step 2: Sửa import nội bộ trong file vừa move**

`drivers/driverConfig.ts`: import cũ `from '../types/printer.types'` → `from '../types/printer.types'` giữ nguyên? KHÔNG — `drivers/` sâu hơn `utils/` 0 cấp (cùng cấp), nên `../types` vẫn đúng. Xác nhận: `utils/` và `drivers/` đều là con trực tiếp của `printer/` → mọi `../` giữ nguyên. Không sửa gì trong `driverConfig.ts`.

`drivers/DriverRegistry.ts`: import cũ:
```ts
import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterDriverType } from '../types/printer.types';
import { EscPosDriver } from '../drivers/escpos/EscPosDriver';
import { TsplDriver } from '../drivers/tspl/TsplDriver';
```
→ sau khi ở trong `drivers/`, sửa 2 dòng cuối:
```ts
import { EscPosDriver } from './escpos/EscPosDriver';
import { TsplDriver } from './tspl/TsplDriver';
```
`DriverRegistry.web.ts`: sửa tương tự các import `../drivers/...` → `./...`; giữ `../types/...`, `../adapters/...` nếu có (kiểm tra file — sửa đúng path theo vị trí mới `drivers/`).

- [ ] **Step 3: Sửa import file test vừa move**

- `drivers/__tests__/driverConfig.test.ts`: các import `from '../driverConfig'` và `from '../../types/...'` — `__tests__/` con của `drivers/` cùng shape với con của `utils/` → giữ nguyên hết.
- `drivers/__tests__/DriverRegistry.web.test.ts`: `from '../DriverRegistry.web'` giữ nguyên; các `from '../../types/...'` giữ nguyên.

- [ ] **Step 4: Sửa consumer**

| File | Dòng cũ | Dòng mới |
|---|---|---|
| `printing/PrintService.ts` | `from '../utils/driverConfig'` | `from '../drivers/driverConfig'` |
| `components/PrinterInfoCard.tsx` | `from '../utils/driverConfig'` | `from '../drivers/driverConfig'` |
| `hooks/useAddPrinterFlow.ts` | `from '../utils/driverConfig'` | `from '../drivers/driverConfig'` |
| `drivers/tspl/TsplDriver.ts` | `from '../../utils/driverConfig'` | `from '../driverConfig'` |
| `drivers/escpos/EscPosDriver.ts` | `from '../../utils/driverConfig'` | `from '../driverConfig'` |
| `drivers/escpos/__tests__/EscPosDriver.test.ts` | `from '../../../utils/driverConfig'` | `from '../../driverConfig'` |
| `printing/PrinterService.ts` | `from './DriverRegistry'` | `from '../drivers/DriverRegistry'` |

> Lưu ý: `printing/PrinterService.ts` bị xoá ở Task 5 — vẫn sửa ở đây để giữ cây xanh giữa 2 task.

- [ ] **Step 5: Quét sót**

Run: `git grep -n "utils/driverConfig\|printing/DriverRegistry"`
Expected: rỗng.

- [ ] **Step 6: Verify + Commit**

```bash
npm run verify
git add -A
git commit -m "refactor: đưa driverConfig + DriverRegistry về printer/drivers/"
```

---

### Task 4: Tách `PrinterService` → 4 service trong `services/`

Tạo 4 file service mới + di chuyển `PrinterConnectionLock`. **Giữ nguyên** `printing/PrinterService.ts` như 1 cầu nối (compose 4 service) để consumer chưa phải đổi — Task 5 mới gỡ. Test `PrinterService.test.ts` cũ **giữ nguyên** tới Task 5; 4 file test mới viết song song (assertion move nguyên văn).

**Files:**
- `git mv src/features/printer/printing/PrinterConnectionLock.ts` → `src/features/printer/services/PrinterConnectionLock.ts`
- `git mv src/features/printer/printing/__tests__/PrinterConnectionLock.test.ts` → `src/features/printer/services/__tests__/PrinterConnectionLock.test.ts` (nếu tồn tại — kiểm tra; nếu không có thì bỏ qua)
- Create: `src/features/printer/services/PrinterRepository.ts`
- Create: `src/features/printer/services/PrinterConnectionService.ts`
- Create: `src/features/printer/services/PrinterConfigService.ts`
- Create: `src/features/printer/services/DeviceScanService.ts`
- Create: `src/features/printer/services/__tests__/PrinterRepository.test.ts`
- Create: `src/features/printer/services/__tests__/PrinterConnectionService.test.ts`
- Create: `src/features/printer/services/__tests__/PrinterConfigService.test.ts`
- Create: `src/features/printer/services/__tests__/DeviceScanService.test.ts`
- Modify: `src/features/printer/printing/PrinterService.ts` (rút thành cầu nối compose)
- Modify: `src/features/printer/printing/PrintScheduler.ts:3` — import lock từ `../services/PrinterConnectionLock`
- Modify: `src/features/printer/printing/__tests__/PrintScheduler.test.ts` — import lock path

**Phân bổ method (nguồn: `printing/PrinterService.ts` hiện tại):**

```
services/PrinterRepository.ts   — createPrinterRepository()  (không deps ngoài PrinterStorage)
  export: getPrinters, savePrinters, findOrThrow, addPrinter, updatePrinter, removePrinter, setEnabled
  helper nội bộ: assertNoDuplicateIdentity, withRecomputedIdentity
  import: PrinterStorage, resolveIdentityKey (discovery/PrinterResolver), printerSchema (schemas/printerFormSchema),
          PrinterErrorException/PrinterErrorCode (types/PrinterError)
  singleton: export const PrinterRepository = createPrinterRepository()

services/PrinterConnectionService.ts — createPrinterConnectionService(registry, repository, lock)
  export: resourceKeyFor, connect, disconnect, reconnect, reconnectAutoPrinters,
          testPrint, print, connectDraft, disconnectForDriver,
          getStatus, onStatusChange, getStatusForDriver, onStatusChangeForDriver
  import: connectionResourceKey (services/PrinterConnectionLock), PrinterErrorException/Code,
          DriverRegistry (drivers/DriverRegistry), PrinterConnectionLock, PrinterRepository
  deps mặc định: registry = DriverRegistry, repository = PrinterRepository, lock = PrinterConnectionLock
  singleton: export const PrinterConnectionService = createPrinterConnectionService(DriverRegistry, PrinterRepository, PrinterConnectionLock)
  NOTE: `connect`/`disconnect`/`reconnect`/`print` dùng repository.findOrThrow / repository.getPrinters.

services/PrinterConfigService.ts — createPrinterConfigService(registry, repository, lock)
  export: installTsplFont, setTsplRenderMode, setTsplInternalFont, setDriverMedia
  helper nội bộ: resourceKeyForTsplPrinterId, updateDriverInPrinter (DRY hoá 3 setter — xem Step 3)
  import: PrinterLogger (services/PrinterLogger), LoggerService, errorCodeOf/PrinterErrorException/Code,
          connectionResourceKey, TsplDriver type, TsplRenderMode, DriverRegistry, PrinterConnectionLock, PrinterRepository
  singleton: export const PrinterConfigService = createPrinterConfigService(DriverRegistry, PrinterRepository, PrinterConnectionLock)

services/DeviceScanService.ts — createDeviceScanService(registry)
  export: scanDevices, scanForConnectionType, discoverDriver
  helper nội bộ: withScanLogging
  import: LoggerService, createDiscoverDriver + DiscoveryEvent/DiscoveryInput (discovery/PrinterDiscoveryService), DriverRegistry
  singleton: export const DeviceScanService = createDeviceScanService(DriverRegistry)
```

**Interfaces:**
- Consumes: `drivers/DriverRegistry` (Task 3), `services/PrinterConnectionLock` (moved this task).
- Produces: 4 singleton objects trên + factory tương ứng. Method signature **y hệt** `PrinterService` hiện tại.

- [ ] **Step 1: `git mv` `PrinterConnectionLock.ts` (+ test nếu có) sang `services/`.** Trong file, import `../types/...` và `../../services/LoggerService` — sau khi vào `services/`, `../types/...` giữ nguyên, `../../services/LoggerService` → `../../../services/LoggerService`. Sửa cho đúng.

- [ ] **Step 2: Tạo `services/PrinterRepository.ts`** — copy nguyên các hàm `getPrinters/savePrinters/findOrThrow/assertNoDuplicateIdentity/withRecomputedIdentity/addPrinter/updatePrinter/removePrinter/setEnabled` từ `PrinterService.ts` (dòng 25–75) vào factory `createPrinterRepository`. Sửa import path cho vị trí `services/`:
  - `PrinterStorage` `from '../storage/PrinterStorage'`
  - `resolveIdentityKey` `from '../discovery/PrinterResolver'`
  - `printerSchema` `from '../schemas/printerFormSchema'`
  - `PrinterErrorException, PrinterErrorCode` `from '../types/PrinterError'`

- [ ] **Step 3: Tạo `services/PrinterConfigService.ts`** — copy `resourceKeyForTsplPrinterId` + `installTsplFont` + 3 setter (dòng 201–372). DRY 3 setter (`setTsplRenderMode`/`setTsplInternalFont`/`setDriverMedia`) bằng 1 helper — **chỉ khi giữ nguyên hành vi từng cái**:

```ts
/**
 * Ghi đè config của đúng 1 driver entry trong 1 printer ĐÃ LƯU rồi persist.
 * `mutate` chỉ chạy khi tìm thấy printer + entry khớp `driverType` và
 * `entry.config.type === driverType` (guard type-narrow cho tspl). Không
 * thấy → no-op (printer draft chưa lưu).
 */
const updateSavedDriverConfig = (
  printerId: string,
  driverType: PrinterDriverType,
  mutate: (config: PrinterDriverConfig) => PrinterDriverConfig,
): void => {
  const printers = repository.getPrinters();
  const printer = printers.find((p) => p.id === printerId);
  const entry = printer?.drivers.find((d) => d.type === driverType);
  if (!printer || !entry || entry.config.type !== driverType) return;
  repository.savePrinters(
    printers.map((p) =>
      p.id !== printerId ? p : {
        ...p,
        drivers: p.drivers.map((d) => (d === entry ? { ...d, config: mutate(d.config) } : d)),
      },
    ),
  );
};
```
Rồi:
- `setTsplRenderMode(id, renderMode)` → `updateSavedDriverConfig(id, tspl, (c) => ({ ...c, renderMode }))`
- `setTsplInternalFont(id, internalFont)` → `updateSavedDriverConfig(id, tspl, (c) => ({ ...c, renderMode: internalfont, internalFont }))`
- `setDriverMedia(id, driverType, patch)` → `updateSavedDriverConfig(id, driverType, (c) => ({ ...c, media: { ...c.media, ...patch } }))`

  Ràng buộc: `setDriverMedia` cũ **không** có guard `entry.config.type !== driverType` (nó nhận cả escpos). Guard mới `entry.config.type !== driverType` **đúng** với cả escpos (`config.type === 'escpos'` khi `driverType === 'escpos'`). Xác nhận bằng test `setDriverMedia() cho escpos driver` phải vẫn xanh. Nếu DRY làm test đỏ → **bỏ DRY, copy 3 hàm nguyên văn** (ledger ruling).

  `installTsplFont` giữ **nguyên văn** (phần persist ở đuôi hàm dùng `repository.getPrinters()/savePrinters()` thay cho `getPrinters()/savePrinters()` cục bộ).

- [ ] **Step 4: Tạo `services/PrinterConnectionService.ts`** — copy `resourceKeyFor` + connect/disconnect/reconnect/reconnectAutoPrinters/testPrint/print/connectDraft/disconnectForDriver/getStatus/onStatusChange/getStatusForDriver/onStatusChangeForDriver + `getDriver` helper (dòng 22, 77–193). Thay mọi `getPrinters()`/`findOrThrow()` cục bộ bằng `repository.getPrinters()`/`repository.findOrThrow()`.

- [ ] **Step 5: Tạo `services/DeviceScanService.ts`** — copy `withScanLogging` + `scanDevices` + `scanForConnectionType` + `discoverDriver` + `discoverDriverFn` (dòng 23, 144–165, 193). Chỉ cần `registry`.

- [ ] **Step 6: Rút `printing/PrinterService.ts` thành cầu nối**

```ts
import { PrinterRepository } from '../services/PrinterRepository';
import { PrinterConnectionService } from '../services/PrinterConnectionService';
import { PrinterConfigService } from '../services/PrinterConfigService';
import { DeviceScanService } from '../services/DeviceScanService';

/**
 * @deprecated Cầu nối tạm trong lúc di chuyển consumer sang từng service cụ
 * thể (Task 5). Không thêm consumer mới vào đây.
 */
export const PrinterService = {
  ...PrinterRepository,
  ...PrinterConnectionService,
  ...PrinterConfigService,
  ...DeviceScanService,
};
```
Xoá `createPrinterService` cũ khỏi file này (test cũ `PrinterService.test.ts` + `PrintScheduler.test.ts` import `createPrinterService` → **tạm** re-export: thêm `export { createPrinterConnectionService as createPrinterService } from '../services/PrinterConnectionService'`? KHÔNG — thay vào đó **để nguyên `createPrinterService` cũ trong file này tới hết Task 4**, chỉ thêm 4 file mới + test mới. Task 5 mới xoá `createPrinterService` + `PrinterService.test.ts`).

  → **Ruling đơn giản hoá:** Ở Task 4, KHÔNG động vào `printing/PrinterService.ts` nội dung (chỉ Task 3 đã sửa 1 import). Chỉ thêm 4 service + 4 test mới + move lock. `printing/PrinterService.ts` vẫn tự chạy độc lập (nó copy code, không gọi service mới). Trùng lặp code tạm thời giữa 2 task — chấp nhận, Task 5 xoá bản cũ.

- [ ] **Step 7: Viết 4 file test mới** — chia `printing/__tests__/PrinterService.test.ts` (610 dòng) theo concern, **bê nguyên** từng `it(...)`:

| Test file mới | Lấy các `it` | Factory dùng |
|---|---|---|
| `services/__tests__/PrinterRepository.test.ts` | addPrinter/getPrinters/updatePrinter/removePrinter/setEnabled/identityKey recompute/duplicate collide (dòng 47–81, 61–74, 262–270) | `createPrinterRepository()` |
| `services/__tests__/PrinterConnectionService.test.ts` | connect/disconnect/reconnect/reconnectAutoPrinters/getStatus/onStatusChange/print/testPrint/connectDraft/lock keying/concurrency/RULE-15-17 (phần lớn file) | `createPrinterConnectionService(registry, createPrinterRepository(), lock)` |
| `services/__tests__/PrinterConfigService.test.ts` | installTsplFont* / setTsplRenderMode* / setTsplInternalFont* / setDriverMedia* / logger succeeded+failed (dòng 366–609, 470–555) | `createPrinterConfigService(registry, createPrinterRepository(), lock)` |
| `services/__tests__/DeviceScanService.test.ts` | scanForConnectionType(usb/bluetooth) / scan logging tap / discoverDriver (dòng 272–301, 334–345) | `createDeviceScanService(registry)` |

  - Test cần "printer đã lưu" (config/connection): tạo `const repository = createPrinterRepository()` rồi `repository.addPrinter(...)` thay cho `service.addPrinter(...)`. `PrinterStorage.savePrinters([])` trong `beforeEach` giữ nguyên.
  - Giữ helper `makeMockDriver` / `escposDriverEntry` / `tsplDriverEntry` / `basePrinter` — copy vào từng file cần (hoặc 1 file `services/__tests__/printerServiceTestKit.ts` không phải test, export chung — **được phép**, không phải barrel).
  - `jest.mock('../../../../services/LoggerService', ...)` → sửa số `../` cho đúng vị trí `services/__tests__/`.

- [ ] **Step 8: Sửa import lock ở `PrintScheduler.ts` + test**

`PrintScheduler.ts:3`: `from './PrinterConnectionLock'` → `from '../services/PrinterConnectionLock'`.
`printing/__tests__/PrintScheduler.test.ts`: `from '../PrinterConnectionLock'` → `from '../../services/PrinterConnectionLock'`; `from '../PrinterService'` (createPrinterService) — **giữ nguyên** tới Task 5.

- [ ] **Step 9: Verify**

Run: `npm run verify`
Expected: test suite tăng thêm 4 file, tất cả xanh. `PrinterService.test.ts` cũ vẫn xanh (chạy song song). Type-check clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: tách PrinterService thành 4 service (Repository/Connection/Config/DeviceScan)"
```

---

### Task 5: Chuyển consumer sang service cụ thể, gỡ facade cũ

**Files:**
- Modify: `src/features/printer/printing/PrintScheduler.ts`
- Modify: `src/features/printer/printing/PrintRoutingService.ts`
- Modify: `src/features/printer/hooks/usePrinterList.ts`
- Modify: `src/features/printer/hooks/usePrinterConnection.ts`
- Modify: `src/features/printer/hooks/useAddPrinterFlow.ts`
- Modify: `src/features/printer/components/DeviceScanList.tsx`
- Modify: `src/features/application/components/ApplicationSidebar.tsx`
- Modify test mocks: `hooks/__tests__/usePrinterList.test.tsx`, `hooks/__tests__/usePrinterConnection.test.tsx`, `hooks/__tests__/useAddPrinterFlow.test.tsx`, `printing/__tests__/PrintScheduler.test.ts`
- Delete: `src/features/printer/printing/PrinterService.ts`
- Delete: `src/features/printer/printing/__tests__/PrinterService.test.ts`

**Interfaces:**
- Consumes: 4 singleton service từ Task 4.
- Produces: không còn `printing/PrinterService.ts`.

**Bảng chuyển đổi (method → service):**

| Method cũ (`PrinterService.X`) | Service mới |
|---|---|
| `getPrinters` `addPrinter` `updatePrinter` `removePrinter` `setEnabled` | `PrinterRepository` |
| `connect` `disconnect` `reconnect` `reconnectAutoPrinters` `testPrint` `print` `connectDraft` `disconnectForDriver` `getStatus` `onStatusChange` `getStatusForDriver` `onStatusChangeForDriver` | `PrinterConnectionService` |
| `installTsplFont` `setTsplRenderMode` `setTsplInternalFont` `setDriverMedia` | `PrinterConfigService` |
| `scanDevices` `scanForConnectionType` `discoverDriver` | `DeviceScanService` |

- [ ] **Step 1: `PrintScheduler.ts`** — `createPrintScheduler(printerService: Pick<..., 'print'|'getPrinters'>)`. Đổi wired singleton:
```ts
import { PrinterConnectionService } from '../services/PrinterConnectionService';
import { PrinterRepository } from '../services/PrinterRepository';
// ...
export const PrintScheduler = createPrintScheduler({
  print: PrinterConnectionService.print,
  getPrinters: PrinterRepository.getPrinters,
});
```
`PrinterServiceLike` type → `{ print: typeof PrinterConnectionService.print; getPrinters: typeof PrinterRepository.getPrinters }`.

- [ ] **Step 2: `PrintRoutingService.ts`** — `getPrinters: PrinterRepository.getPrinters`; type `typeof PrinterRepository.getPrinters`.

- [ ] **Step 3: `usePrinterList.ts`** — import `PrinterRepository` (`getPrinters`, `setEnabled`, `removePrinter`) + `PrinterConnectionService` (`connect`, `disconnect`, `reconnect`). Đổi call site tương ứng.

- [ ] **Step 4: `usePrinterConnection.ts`** — `PrinterConnectionService.getStatus` / `.onStatusChange`.

- [ ] **Step 5: `useAddPrinterFlow.ts`** — thay `PrinterService.` theo bảng: `getPrinters`→Repository; `getStatusForDriver/onStatusChangeForDriver/disconnectForDriver/connectDraft/connect/reconnect/testPrint`→ConnectionService; `addPrinter/updatePrinter`→Repository; `installTsplFont/setTsplRenderMode/setTsplInternalFont/setDriverMedia`→ConfigService; `discoverDriver`→DeviceScanService. (Task 6 sẽ chia nhỏ tiếp — ở đây chỉ đổi import/tên.)

- [ ] **Step 6: `DeviceScanList.tsx`** — `DeviceScanService.scanForConnectionType`.

- [ ] **Step 7: `ApplicationSidebar.tsx`** — `import { PrinterConnectionService } from '../../printer/services/PrinterConnectionService'`; `PrinterConnectionService.getStatus(p.id)`.

- [ ] **Step 8: Test mocks** — mỗi file test đang `jest.mock('../../printing/PrinterService', ...)`:
  - `usePrinterList.test.tsx` → 2 mock: `jest.mock('../../services/PrinterRepository', () => ({ PrinterRepository: { getPrinters: jest.fn(()=>[]), setEnabled: jest.fn(), removePrinter: jest.fn() } }))` + `jest.mock('../../services/PrinterConnectionService', () => ({ PrinterConnectionService: { connect: jest.fn(()=>Promise.resolve()), disconnect: jest.fn(()=>Promise.resolve()), reconnect: jest.fn(()=>Promise.resolve()) } }))`. Đổi mọi `PrinterService.X` trong assertion → service tương ứng.
  - `usePrinterConnection.test.tsx` → mock `PrinterConnectionService` (`getStatus`, `onStatusChange`).
  - `useAddPrinterFlow.test.tsx` → mock 4 service (chỉ method hook dùng — xem mock hiện tại dòng 10–28, phân bổ theo bảng).
  - `PrintScheduler.test.ts` → `import { createPrinterConnectionService } from '../../services/PrinterConnectionService'` thay `createPrinterService`; wiring test tự dựng `{ print, getPrinters }` — kiểm tra file, sửa tối thiểu để pass (assertion không đổi).

- [ ] **Step 9: Xoá facade cũ**

```bash
git rm src/features/printer/printing/PrinterService.ts
git rm src/features/printer/printing/__tests__/PrinterService.test.ts
```

- [ ] **Step 10: Quét sót**

Run: `git grep -n "printing/PrinterService\|PrinterService\b"`
Expected: chỉ còn trong comment/doc (ARCHITECTURE.md, CLAUDE.md — cập nhật ở Task 8 riêng nếu muốn; KHÔNG bắt buộc trong plan này). Không còn `import ... PrinterService` trong code.

- [ ] **Step 11: Verify + Commit**

```bash
npm run verify
git add -A
git commit -m "refactor: consumer dùng PrinterRepository/Connection/Config/DeviceScan trực tiếp, gỡ facade PrinterService"
```

---

### Task 6: Tách `useAddPrinterFlow.ts` → coordinator + 4 hook con

**Files:**
- Create: `src/features/printer/hooks/addPrinter/useConnectionSetup.ts`
- Create: `src/features/printer/hooks/addPrinter/useProtocolDiscovery.ts`
- Create: `src/features/printer/hooks/addPrinter/useDriverConfig.ts`
- Create: `src/features/printer/hooks/addPrinter/useTestPrint.ts`
- Modify: `src/features/printer/hooks/useAddPrinterFlow.ts` (thành coordinator ~150d)
- Modify: `src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx` (giữ làm integration test; cập nhật mock nếu sub-hook đổi module import)
- Create (tuỳ chọn, nếu review yêu cầu coverage riêng): `src/features/printer/hooks/addPrinter/__tests__/*.test.tsx`

**Nguyên tắc chia (state chồng lấn `drivers` + `buildDraftPrinter` do coordinator sở hữu, truyền xuống):**

```
coordinator (useAddPrinterFlow.ts) — sở hữu:
  printerId, drivers state + setDrivers, displayForm, autoReconnect,
  buildDraftPrinter(), addDriverToList(), onSave, liveStatus effect,
  cleanup-on-unmount effect, savedRef/connectionRef.
  Ghép 4 hook con → trả về UseAddPrinterFlow (interface KHÔNG đổi).

useConnectionSetup({ initialValues, drivers }) → {
  connectionType, setConnectionType, selectedDevice, setSelectedDevice,
  lanForm, detectedLanIp, lanIpFetchError, onFetchLanIp, onAutoFillLanIp,
  currentIdentityKey(), identityErrorMessage,
  onConnectionTypeChange, onSelectDevice, onLanIpChange, onLanPortChange,
  buildLan(), refreshUsbSerial()
}
  — chứa effect tính identityErrorMessage (đọc PrinterRepository.getPrinters).

useProtocolDiscovery({ printerId, drivers, buildDraftPrinter, addDriverToList,
                       onConnectionType..., refreshUsbSerial, prefillDisplayName }) → {
  connectionState, protocolState, lastProtocol, deviceInfo, connectionErrorMessage,
  connectionDirty, startDiscovery, onConnectPress, onChooseProtocol,
  resetConnectionResult, discoveryUnsubscribeRef
}
  — DeviceScanService.discoverDriver + PrinterConnectionService.connectDraft.

useDriverConfig({ printerId, drivers, setDrivers }) → {
  onToggleContentType, updateTsplConfig, onSelectTsplRenderMode,
  onChangeDriverMedia, onChangeTsplInternalFont, tsplFontPending
}
  — PrinterConfigService.* + PrinterConnectionService? không; chỉ Config + installTsplFont.

useTestPrint({ drivers, displayForm, buildDraftPrinter, captureBillImage }) → {
  testPrintReceiptPending, testPrintLabelPending, testPrintErrorMessage,
  testPrintRowsText, setTestPrintRowsText, onTestPrintReceipt, onTestPrintLabel,
  clearTestPrintError, resolveTestPrintDocuments
}
  — PrinterConnectionService.testPrint.
```

**Interfaces:**
- Consumes: 4 service (Task 5), `drivers/driverConfig` + `media/validation` (Task 2–3).
- Produces: `useAddPrinterFlow(input): UseAddPrinterFlow` — **cùng chữ ký, cùng interface** như hiện tại. Import path ngoài (`components/AddPrinterForm.tsx` → `../hooks/useAddPrinterFlow`) KHÔNG đổi.

- [ ] **Step 1: Tạo `hooks/addPrinter/useConnectionSetup.ts`** — chuyển state + hàm connection (dòng 61–62, 79–82, 91–97 lanForm, 150–178 identity, 335–374). Nhận `drivers` (đọc `drivers.length` để khoá input). Trả object ở trên.

- [ ] **Step 2: Tạo `hooks/addPrinter/useProtocolDiscovery.ts`** — chuyển `connectionState/protocolState/lastProtocol/deviceInfo/connectionErrorMessage/connectionDirty` + `resetDiscoveryFields/resetConnectionResult/startDiscovery/onConnectPress/onChooseProtocol` + `discoveryUnsubscribeRef` (dòng 75–79, 84, 180–333). Nhận callback từ coordinator: `buildDraftPrinter`, `addDriverToList`, `refreshUsbSerial`, `prefillDisplayName`.

- [ ] **Step 3: Tạo `hooks/addPrinter/useDriverConfig.ts`** — `tsplFontPending` + `onToggleContentType/updateTsplConfig/onSelectTsplRenderMode/onChangeDriverMedia/onChangeTsplInternalFont` (dòng 69, 376–450). Nhận `printerId`, `drivers`, `setDrivers`.

- [ ] **Step 4: Tạo `hooks/addPrinter/useTestPrint.ts`** — `testPrint*Pending/testPrintErrorMessage/testPrintRowsText` + `resolveTestPrintDocuments/runTestPrint/onTestPrintReceipt/onTestPrintLabel` (dòng 65–67, 73, 452–483). Nhận `drivers`, `displayForm`, `buildDraftPrinter`, `captureBillImage`.

- [ ] **Step 5: Rút `useAddPrinterFlow.ts` thành coordinator** — giữ `printerId`, `drivers`/`setDrivers`, `displayForm`, `autoReconnect`, `useBillImageCapture`, `buildDraftPrinter`, `addDriverToList`, `prefillDisplayName`, `liveStatus` + 3 effect (connectionRef sync, liveStatus subscribe, 2 cleanup). Gọi 4 hook con, spread kết quả vào `connectionSection/statusPanel/infoCard`. `onSave` ở coordinator.

- [ ] **Step 6: Cập nhật test** — `useAddPrinterFlow.test.tsx` test qua interface trả về → phần lớn **giữ nguyên**. Chỉ sửa: các `jest.mock('../../services/...')` (đã làm ở Task 5) phải cover method mà sub-hook gọi. `jest.mock('../useBillImageCapture')` giữ. `jest.mock('../../services/NetworkInfoService')` — nếu `useConnectionSetup` import trực tiếp từ `../../services/NetworkInfoService` thì path mock đổi thành `../../../services/NetworkInfoService`? KHÔNG — `hooks/addPrinter/useConnectionSetup.ts` sâu hơn 1 cấp so với `hooks/useAddPrinterFlow.ts`; nó import `../../services/NetworkInfoService`. Test ở `hooks/__tests__/` mock theo module specifier mà **test file** thấy → vẫn `'../../services/NetworkInfoService'`. Jest resolve theo đường dẫn từ test file. Xác nhận bằng chạy test.

- [ ] **Step 7: Verify**

Run: `npm run verify`
Expected: `useAddPrinterFlow.test.tsx` (toàn bộ ~340 dòng test) xanh không sửa assertion. Type-check clean (chú ý: interface `UseAddPrinterFlow` không đổi).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: tách useAddPrinterFlow thành coordinator + 4 hook con (hooks/addPrinter/)"
```

---

### Task 7: Tách `PrinterInfoCard.tsx` → 2 sub-component

**Files:**
- Create: `src/features/printer/components/DriverRenderModeSection.tsx`
- Create: `src/features/printer/components/TestPrintPanel.tsx`
- Modify: `src/features/printer/components/PrinterInfoCard.tsx`

**Interfaces:**
- Consumes: `drivers/driverConfig` (Task 3).
- Produces:
  - `DriverRenderModeSection` props: `{ driver: PrinterDriver; disabled: boolean; tsplFontPending: boolean; onSelectTsplRenderMode: (mode: TsplRenderMode) => void; onChangeTsplInternalFont: (patch: Partial<TsplInternalFontConfig>) => void }` — render `AppSelect "Chế độ in TSPL"` + (nếu `internalfont`) codepage `AppSelect` + fontName `AppInput`. Chỉ render khi `driver.type === tspl` (guard trong component, trả `null` nếu không).
  - `TestPrintPanel` props: `{ status: PrinterStatus; hasTsplDriver: boolean; canPrintReceipt: boolean; canPrintLabel: boolean; testPrintRowsText: string; onTestPrintRowsChange: (t: string) => void; testPrintReceiptPending: boolean; testPrintLabelPending: boolean; onTestPrintReceipt: () => void; onTestPrintLabel: () => void; disabled: boolean }` — ô "Số hàng in thử" + 2 nút.

- [ ] **Step 1: Tạo `DriverRenderModeSection.tsx`** — cắt block dòng 154–187 của `PrinterInfoCard.tsx` + các `const tsplRenderModeLabel/tsplRenderModeOptions/tsplCodepageOptions` (dòng 34–49) chuyển sang file mới. Import `DEFAULT_TSPL_INTERNAL_FONT, tsplRenderModeOf` từ `../drivers/driverConfig`.

- [ ] **Step 2: Tạo `TestPrintPanel.tsx`** — cắt block dòng 191–217 + style `testPrintRow/testPrintButton`.

- [ ] **Step 3: Sửa `PrinterInfoCard.tsx`** — thay 2 block bằng `<DriverRenderModeSection ... />` (trong `.map(driver => ...)`) và `<TestPrintPanel ... />`. Truyền `canPrintReceipt={canPrint(PrintType.Receipt)}` v.v. Còn lại ~130d: name input + deviceInfo + auto-reconnect + `drivers.map` (chip + `DriverMediaSection` + content-type switches + `DriverRenderModeSection`) + `TestPrintPanel` + nút Lưu.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: type-check clean, lint 0 error mới. `useAddPrinterFlow.test.tsx` (render qua `infoCard`) vẫn xanh — props truyền xuyên suốt không đổi.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: tách PrinterInfoCard thành DriverRenderModeSection + TestPrintPanel"
```

---

## Self-Review

**1. Spec coverage:**
- Spec §0 #1 (tách useAddPrinterFlow) → Task 6. ✅
- §0 #2 + §4 (tách PrinterService) → Task 4 + 5. ✅ (ruling: `print` ở lại ConnectionService, không sang PrintService)
- §0 #3 (va chạm tên PrinterService/PrintService) → giải quyết bởi Task 5 (PrinterService biến mất). ✅
- §0 #4 + §2 (`media/`, driverConfig→drivers/) → Task 2 + 3. ✅
- §0 #5 (`types/PrinterError.ts`) → spec chốt "không đổi" → không có task. ✅ (đúng chủ đích)
- §0 #6 + §6 (PrinterInfoCard) → Task 7. ✅
- §0 #7 + §2 (`config/`→`constants.ts`) → Task 1. ✅
- §2 `DriverRegistry`→`drivers/` → Task 3. ✅

**2. Placeholder scan:** Không có "TBD/TODO". Các "kiểm tra file — sửa đúng path" ở Task 3/4/5 là hướng dẫn xử lý biến thể đường dẫn tương đối, kèm quy tắc cụ thể (cùng cấp → `../` giữ nguyên; sâu thêm 1 cấp → thêm 1 `../`). Test không được viết mới — assertion move nguyên văn, nêu rõ file nguồn + vùng dòng.

**3. Type consistency:**
- `PrinterRepository` / `PrinterConnectionService` / `PrinterConfigService` / `DeviceScanService` — tên nhất quán Task 4→5→6.
- `createPrinterRepository` / `createPrinterConnectionService` / `createPrinterConfigService` / `createDeviceScanService` — factory naming nhất quán.
- `media/paperSpec.ts` (không phải `paperSize.ts`) — nhất quán Task 2 (mọi bảng import dùng `paperSpec`).
- `media/validation.ts` (không phải `mediaValidation.ts`) — nhất quán.
- `hooks/addPrinter/` (không phải `hooks/useAddPrinterFlow/`) — coordinator giữ path cũ `hooks/useAddPrinterFlow.ts`, 4 con ở `hooks/addPrinter/`.
- `UseAddPrinterFlow` interface + `useAddPrinterFlow` signature — bất biến qua Task 6.
- `CONNECT_TIMEOUT_MS` — cùng tên, chỉ đổi path.

**Rủi ro cao nhất:** Task 6 (state chồng lấn). Giảm bằng: coordinator giữ `drivers`/`buildDraftPrinter`; integration test `useAddPrinterFlow.test.tsx` không đổi assertion là lưới an toàn. Nếu implementer thấy `buildDraftPrinter` cần > 3 tham số truyền vòng → chấp nhận truyền qua 1 object `draftContext`, ledger ruling.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-printer-module-restructure.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch fresh subagent mỗi task, review giữa các task, iteration nhanh.

**2. Inline Execution** — chạy trong session này, batch + checkpoint.

Chọn cách nào?
