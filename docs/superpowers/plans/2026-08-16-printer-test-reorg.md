# Printer Test File Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 22 `src/features/printer/` `.test.ts` files into `__tests__/` subfolders, completing the test-file reorganization that `docs/superpowers/plans/2026-08-16-file-structure-reorg.md` deliberately deferred for this module.

**Architecture:** Identical mechanism to the prior plan: each test file is `git mv`'d into a `__tests__/` subfolder in its current directory, then its relative import/`jest.mock` paths are adjusted by exactly one `../` level (bare-specifier mocks of installed packages — `@poriyaalar/react-native-thermal-receipt-printer`, `react-native`, `react-native-bluetooth-classic`, `react-native-tcp-socket`, `buffer` — are untouched). No source file being tested is ever modified. Zero risk to production behavior — verified by running the affected test(s) after every move and a full suite pass at the end.

**Tech Stack:** React Native CLI + TypeScript strict, Jest (`preset: 'react-native'`, default `testMatch` — auto-discovers `__tests__/` folders, no `jest.config.js` change needed, already confirmed by the prior plan's execution).

**Spec:** `docs/superpowers/specs/2026-08-16-file-structure-reorg-design.md` (this plan completes the work that spec's Non-Goals section explicitly deferred: *"`src/features/printer/`'s 22 test files — deferred... It has 22 of the repo's 39 test files (the largest single chunk) and has had heavy, active development all in the current session... Deferred to a dedicated follow-up once printer/ development settles."* That follow-up is now.)

## Global Constraints

- Zero behavior change — no test assertion changes, no driver/service behavior changes anywhere in this plan.
- Only **relative** (`./` or `../`) import/`jest.mock` paths get adjusted when a file moves. Bare-specifier imports/mocks of installed packages (`@poriyaalar/react-native-thermal-receipt-printer`, `react-native`, `react-native-bluetooth-classic`, `react-native-tcp-socket`, `buffer`) are untouched.
- No `jest.config.js` changes.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt (unaffected by this plan — no UI text changes).
- TypeScript strict, no `any`.

---

### Task 1: Move `constants`/`protocols`/`schemas` test files into `__tests__/`

**Files:**
- Move: `src/features/printer/constants/printerDetectionRules.test.ts` → `src/features/printer/constants/__tests__/printerDetectionRules.test.ts`
- Move: `src/features/printer/protocols/TsplEncoder.test.ts` → `src/features/printer/protocols/__tests__/TsplEncoder.test.ts`
- Move: `src/features/printer/schemas/printerFormSchema.test.ts` → `src/features/printer/schemas/__tests__/printerFormSchema.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `printerDetectionRules.test.ts`**

```bash
git mv src/features/printer/constants/printerDetectionRules.test.ts src/features/printer/constants/__tests__/printerDetectionRules.test.ts
```

- [ ] **Step 2: Fix its relative import path**

In `src/features/printer/constants/__tests__/printerDetectionRules.test.ts`, replace:

```ts
import { PRINTER_DETECTION_RULES } from './printerDetectionRules';
```

with:

```ts
import { PRINTER_DETECTION_RULES } from '../printerDetectionRules';
```

- [ ] **Step 3: Move `TsplEncoder.test.ts`**

```bash
git mv src/features/printer/protocols/TsplEncoder.test.ts src/features/printer/protocols/__tests__/TsplEncoder.test.ts
```

- [ ] **Step 4: Fix its relative import path**

In `src/features/printer/protocols/__tests__/TsplEncoder.test.ts`, replace:

```ts
import { TsplEncoder } from './TsplEncoder';
```

with:

```ts
import { TsplEncoder } from '../TsplEncoder';
```

- [ ] **Step 5: Move `printerFormSchema.test.ts`**

```bash
git mv src/features/printer/schemas/printerFormSchema.test.ts src/features/printer/schemas/__tests__/printerFormSchema.test.ts
```

- [ ] **Step 6: Fix its relative import path**

In `src/features/printer/schemas/__tests__/printerFormSchema.test.ts`, replace:

```ts
import { lanConnectionSchema, printerDisplaySchema } from './printerFormSchema';
```

with:

```ts
import { lanConnectionSchema, printerDisplaySchema } from '../printerFormSchema';
```

- [ ] **Step 7: Verify**

Run: `npx jest src/features/printer/constants/__tests__/printerDetectionRules.test.ts src/features/printer/protocols/__tests__/TsplEncoder.test.ts src/features/printer/schemas/__tests__/printerFormSchema.test.ts`
Expected: all 3 suites PASS with the same test names/counts as before the move.

- [ ] **Step 8: Commit**

```bash
git add src/features/printer/constants/printerDetectionRules.test.ts src/features/printer/constants/__tests__/printerDetectionRules.test.ts src/features/printer/protocols/TsplEncoder.test.ts src/features/printer/protocols/__tests__/TsplEncoder.test.ts src/features/printer/schemas/printerFormSchema.test.ts src/features/printer/schemas/__tests__/printerFormSchema.test.ts
git commit -m "chore: move printer constants/protocols/schemas test files into __tests__/ subfolders"
```

---

### Task 2: Move `drivers` test files into `__tests__/`

**Files:**
- Move: `src/features/printer/drivers/ThermalReceiptDriver.test.ts` → `src/features/printer/drivers/__tests__/ThermalReceiptDriver.test.ts`
- Move: `src/features/printer/drivers/TsplDriver.test.ts` → `src/features/printer/drivers/__tests__/TsplDriver.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `ThermalReceiptDriver.test.ts`**

```bash
git mv src/features/printer/drivers/ThermalReceiptDriver.test.ts src/features/printer/drivers/__tests__/ThermalReceiptDriver.test.ts
```

- [ ] **Step 2: Fix its relative import and mock paths**

In `src/features/printer/drivers/__tests__/ThermalReceiptDriver.test.ts`, replace:

```ts
import { ThermalReceiptDriver } from './ThermalReceiptDriver';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintDocument } from '../types/printDocument.types';
```

with:

```ts
import { ThermalReceiptDriver } from '../ThermalReceiptDriver';
import type { PrinterConfig } from '../../types/printer.types';
import type { PrintDocument } from '../../types/printDocument.types';
```

And replace:

```ts
jest.mock('../services/PrinterPermissionService', () => ({
```

with:

```ts
jest.mock('../../services/PrinterPermissionService', () => ({
```

And replace:

```ts
jest.mock('../services/PrinterLogger', () => ({
```

with:

```ts
jest.mock('../../services/PrinterLogger', () => ({
```

(The `jest.mock('@poriyaalar/react-native-thermal-receipt-printer', ...)` call is a bare package specifier — leave it unchanged.)

- [ ] **Step 3: Move `TsplDriver.test.ts`**

```bash
git mv src/features/printer/drivers/TsplDriver.test.ts src/features/printer/drivers/__tests__/TsplDriver.test.ts
```

- [ ] **Step 4: Fix its relative import and mock paths**

In `src/features/printer/drivers/__tests__/TsplDriver.test.ts`, replace:

```ts
import { TsplDriver } from './TsplDriver';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintDocument, PrintElement } from '../types/printDocument.types';
```

with:

```ts
import { TsplDriver } from '../TsplDriver';
import type { PrinterConfig } from '../../types/printer.types';
import type { PrintDocument, PrintElement } from '../../types/printDocument.types';
```

And replace:

```ts
jest.mock('../transports/LanTransport', () => ({
```

with:

```ts
jest.mock('../../transports/LanTransport', () => ({
```

And replace:

```ts
jest.mock('../transports/BluetoothTransport', () => ({
```

with:

```ts
jest.mock('../../transports/BluetoothTransport', () => ({
```

And replace:

```ts
jest.mock('../services/PrinterPermissionService', () => ({
```

with:

```ts
jest.mock('../../services/PrinterPermissionService', () => ({
```

And replace:

```ts
jest.mock('../services/PrinterLogger', () => ({
```

with:

```ts
jest.mock('../../services/PrinterLogger', () => ({
```

- [ ] **Step 5: Verify**

Run: `npx jest src/features/printer/drivers/__tests__/ThermalReceiptDriver.test.ts src/features/printer/drivers/__tests__/TsplDriver.test.ts`
Expected: both suites PASS with the same test names/counts as before the move.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/drivers/ThermalReceiptDriver.test.ts src/features/printer/drivers/__tests__/ThermalReceiptDriver.test.ts src/features/printer/drivers/TsplDriver.test.ts src/features/printer/drivers/__tests__/TsplDriver.test.ts
git commit -m "chore: move printer drivers test files into __tests__/ subfolders"
```

---

### Task 3: Move `transports` test files into `__tests__/`

**Files:**
- Move: `src/features/printer/transports/BluetoothTransport.test.ts` → `src/features/printer/transports/__tests__/BluetoothTransport.test.ts`
- Move: `src/features/printer/transports/LanTransport.test.ts` → `src/features/printer/transports/__tests__/LanTransport.test.ts`
- Move: `src/features/printer/transports/UsbTransport.test.ts` → `src/features/printer/transports/__tests__/UsbTransport.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `BluetoothTransport.test.ts`**

```bash
git mv src/features/printer/transports/BluetoothTransport.test.ts src/features/printer/transports/__tests__/BluetoothTransport.test.ts
```

- [ ] **Step 2: Fix its relative import path**

In `src/features/printer/transports/__tests__/BluetoothTransport.test.ts`, replace:

```ts
import { BluetoothTransport } from './BluetoothTransport';
```

with:

```ts
import { BluetoothTransport } from '../BluetoothTransport';
```

(`import { Buffer } from 'buffer';` and `jest.mock('react-native-bluetooth-classic', ...)` are bare specifiers — leave unchanged.)

- [ ] **Step 3: Move `LanTransport.test.ts`**

```bash
git mv src/features/printer/transports/LanTransport.test.ts src/features/printer/transports/__tests__/LanTransport.test.ts
```

- [ ] **Step 4: Fix its relative import path**

In `src/features/printer/transports/__tests__/LanTransport.test.ts`, replace:

```ts
import { LanTransport } from './LanTransport';
```

with:

```ts
import { LanTransport } from '../LanTransport';
```

(`import { Buffer } from 'buffer';` and `jest.mock('react-native-tcp-socket', ...)` are bare specifiers — leave unchanged.)

- [ ] **Step 5: Move `UsbTransport.test.ts`**

```bash
git mv src/features/printer/transports/UsbTransport.test.ts src/features/printer/transports/__tests__/UsbTransport.test.ts
```

- [ ] **Step 6: Fix its relative import paths**

In `src/features/printer/transports/__tests__/UsbTransport.test.ts`, replace:

```ts
import { UsbTransport } from './UsbTransport';
import { AppErrorException } from '../../../types/AppError';
```

with:

```ts
import { UsbTransport } from '../UsbTransport';
import { AppErrorException } from '../../../../types/AppError';
```

- [ ] **Step 7: Verify**

Run: `npx jest src/features/printer/transports/__tests__/BluetoothTransport.test.ts src/features/printer/transports/__tests__/LanTransport.test.ts src/features/printer/transports/__tests__/UsbTransport.test.ts`
Expected: all 3 suites PASS with the same test names/counts as before the move.

- [ ] **Step 8: Commit**

```bash
git add src/features/printer/transports/BluetoothTransport.test.ts src/features/printer/transports/__tests__/BluetoothTransport.test.ts src/features/printer/transports/LanTransport.test.ts src/features/printer/transports/__tests__/LanTransport.test.ts src/features/printer/transports/UsbTransport.test.ts src/features/printer/transports/__tests__/UsbTransport.test.ts
git commit -m "chore: move printer transports test files into __tests__/ subfolders"
```

---

### Task 4: Move `types` test files into `__tests__/`

**Files:**
- Move: `src/features/printer/types/printConfiguration.types.test.ts` → `src/features/printer/types/__tests__/printConfiguration.types.test.ts`
- Move: `src/features/printer/types/printDocument.types.test.ts` → `src/features/printer/types/__tests__/printDocument.types.test.ts`
- Move: `src/features/printer/types/printJob.types.test.ts` → `src/features/printer/types/__tests__/printJob.types.test.ts`
- Move: `src/features/printer/types/printer.types.test.ts` → `src/features/printer/types/__tests__/printer.types.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `printConfiguration.types.test.ts`**

```bash
git mv src/features/printer/types/printConfiguration.types.test.ts src/features/printer/types/__tests__/printConfiguration.types.test.ts
```

- [ ] **Step 2: Fix its relative import path**

In `src/features/printer/types/__tests__/printConfiguration.types.test.ts`, replace:

```ts
import type { PrintConfiguration, PrintType } from './printConfiguration.types';
```

with:

```ts
import type { PrintConfiguration, PrintType } from '../printConfiguration.types';
```

- [ ] **Step 3: Move `printDocument.types.test.ts`**

```bash
git mv src/features/printer/types/printDocument.types.test.ts src/features/printer/types/__tests__/printDocument.types.test.ts
```

- [ ] **Step 4: Fix its relative import path**

In `src/features/printer/types/__tests__/printDocument.types.test.ts`, replace:

```ts
import type { PrintDocument, PrintElement } from './printDocument.types';
```

with:

```ts
import type { PrintDocument, PrintElement } from '../printDocument.types';
```

- [ ] **Step 5: Move `printJob.types.test.ts`**

```bash
git mv src/features/printer/types/printJob.types.test.ts src/features/printer/types/__tests__/printJob.types.test.ts
```

- [ ] **Step 6: Fix its relative import paths**

In `src/features/printer/types/__tests__/printJob.types.test.ts`, replace:

```ts
import type { PrintDocument } from './printDocument.types';
import type { PrintJob, PrintResult } from './printJob.types';
```

with:

```ts
import type { PrintDocument } from '../printDocument.types';
import type { PrintJob, PrintResult } from '../printJob.types';
```

- [ ] **Step 7: Move `printer.types.test.ts`**

```bash
git mv src/features/printer/types/printer.types.test.ts src/features/printer/types/__tests__/printer.types.test.ts
```

- [ ] **Step 8: Fix its relative import paths**

In `src/features/printer/types/__tests__/printer.types.test.ts`, replace:

```ts
import type { IPrinterDriver } from './driver.types';
import type { PrinterConfig } from './printer.types';
```

with:

```ts
import type { IPrinterDriver } from '../driver.types';
import type { PrinterConfig } from '../printer.types';
```

- [ ] **Step 9: Verify**

Run: `npx jest src/features/printer/types/__tests__/printConfiguration.types.test.ts src/features/printer/types/__tests__/printDocument.types.test.ts src/features/printer/types/__tests__/printJob.types.test.ts src/features/printer/types/__tests__/printer.types.test.ts`
Expected: all 4 suites PASS with the same test names/counts as before the move.

- [ ] **Step 10: Commit**

```bash
git add src/features/printer/types/printConfiguration.types.test.ts src/features/printer/types/__tests__/printConfiguration.types.test.ts src/features/printer/types/printDocument.types.test.ts src/features/printer/types/__tests__/printDocument.types.test.ts src/features/printer/types/printJob.types.test.ts src/features/printer/types/__tests__/printJob.types.test.ts src/features/printer/types/printer.types.test.ts src/features/printer/types/__tests__/printer.types.test.ts
git commit -m "chore: move printer types test files into __tests__/ subfolders"
```

---

### Task 5: Move `store` test file into `__tests__/`

**Files:**
- Move: `src/features/printer/store/printerSlice.test.ts` → `src/features/printer/store/__tests__/printerSlice.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `printerSlice.test.ts`**

```bash
git mv src/features/printer/store/printerSlice.test.ts src/features/printer/store/__tests__/printerSlice.test.ts
```

- [ ] **Step 2: Fix its relative import paths**

In `src/features/printer/store/__tests__/printerSlice.test.ts`, replace:

```ts
import printerReducer, {
  printersLoaded,
  printerUpserted,
  printerRemoved,
  defaultPrinterSet,
  printerStatusChanged,
  printerEnabledChanged,
  selectPrinters,
  selectPrinterStatus,
} from './printerSlice';
import type { PrinterConfig } from '../types/printer.types';
```

with:

```ts
import printerReducer, {
  printersLoaded,
  printerUpserted,
  printerRemoved,
  defaultPrinterSet,
  printerStatusChanged,
  printerEnabledChanged,
  selectPrinters,
  selectPrinterStatus,
} from '../printerSlice';
import type { PrinterConfig } from '../../types/printer.types';
```

- [ ] **Step 3: Verify**

Run: `npx jest src/features/printer/store/__tests__/printerSlice.test.ts`
Expected: PASS with the same test names/count as before the move.

- [ ] **Step 4: Commit**

```bash
git add src/features/printer/store/printerSlice.test.ts src/features/printer/store/__tests__/printerSlice.test.ts
git commit -m "chore: move printer store test file into __tests__/ subfolder"
```

---

### Task 6: Move `services` test files (batch 1: standalone services) into `__tests__/`

**Files:**
- Move: `src/features/printer/services/DriverRegistry.web.test.ts` → `src/features/printer/services/__tests__/DriverRegistry.web.test.ts`
- Move: `src/features/printer/services/PrintConfigurationService.test.ts` → `src/features/printer/services/__tests__/PrintConfigurationService.test.ts`
- Move: `src/features/printer/services/PrinterConnectionLock.test.ts` → `src/features/printer/services/__tests__/PrinterConnectionLock.test.ts`
- Move: `src/features/printer/services/PrinterLogger.test.ts` → `src/features/printer/services/__tests__/PrinterLogger.test.ts`
- Move: `src/features/printer/services/PrinterPermissionService.test.ts` → `src/features/printer/services/__tests__/PrinterPermissionService.test.ts`

**Interfaces:** None — pure file relocation.

- [ ] **Step 1: Move `DriverRegistry.web.test.ts`**

```bash
git mv src/features/printer/services/DriverRegistry.web.test.ts src/features/printer/services/__tests__/DriverRegistry.web.test.ts
```

- [ ] **Step 2: Fix its relative import paths**

In `src/features/printer/services/__tests__/DriverRegistry.web.test.ts`, replace:

```ts
import { DriverRegistry } from './DriverRegistry.web';
import type { PrinterConfig } from '../types/printer.types';
```

with:

```ts
import { DriverRegistry } from '../DriverRegistry.web';
import type { PrinterConfig } from '../../types/printer.types';
```

- [ ] **Step 3: Move `PrintConfigurationService.test.ts`**

```bash
git mv src/features/printer/services/PrintConfigurationService.test.ts src/features/printer/services/__tests__/PrintConfigurationService.test.ts
```

- [ ] **Step 4: Fix its relative import paths**

In `src/features/printer/services/__tests__/PrintConfigurationService.test.ts`, replace:

```ts
import { createPrintConfigurationService } from './PrintConfigurationService';
import { StorageService } from '../../../services/StorageService';
import type { PrintConfiguration } from '../types/printConfiguration.types';
```

with:

```ts
import { createPrintConfigurationService } from '../PrintConfigurationService';
import { StorageService } from '../../../../services/StorageService';
import type { PrintConfiguration } from '../../types/printConfiguration.types';
```

- [ ] **Step 5: Move `PrinterConnectionLock.test.ts`**

```bash
git mv src/features/printer/services/PrinterConnectionLock.test.ts src/features/printer/services/__tests__/PrinterConnectionLock.test.ts
```

- [ ] **Step 6: Fix its relative import path**

In `src/features/printer/services/__tests__/PrinterConnectionLock.test.ts`, replace:

```ts
import { connectionResourceKey, createResourceLock } from './PrinterConnectionLock';
```

with:

```ts
import { connectionResourceKey, createResourceLock } from '../PrinterConnectionLock';
```

- [ ] **Step 7: Move `PrinterLogger.test.ts`**

```bash
git mv src/features/printer/services/PrinterLogger.test.ts src/features/printer/services/__tests__/PrinterLogger.test.ts
```

- [ ] **Step 8: Fix its relative import and mock paths**

In `src/features/printer/services/__tests__/PrinterLogger.test.ts`, replace:

```ts
import { LoggerService } from '../../../services/LoggerService';
import { PrinterLogger } from './PrinterLogger';
```

with:

```ts
import { LoggerService } from '../../../../services/LoggerService';
import { PrinterLogger } from '../PrinterLogger';
```

And replace:

```ts
jest.mock('../../../services/LoggerService', () => ({
```

with:

```ts
jest.mock('../../../../services/LoggerService', () => ({
```

- [ ] **Step 9: Move `PrinterPermissionService.test.ts`**

```bash
git mv src/features/printer/services/PrinterPermissionService.test.ts src/features/printer/services/__tests__/PrinterPermissionService.test.ts
```

- [ ] **Step 10: Fix its relative import and mock paths**

In `src/features/printer/services/__tests__/PrinterPermissionService.test.ts`, replace:

```ts
import { ensureBluetoothPermission } from './PrinterPermissionService';
import { PrinterLogger } from './PrinterLogger';
```

with:

```ts
import { ensureBluetoothPermission } from '../PrinterPermissionService';
import { PrinterLogger } from '../PrinterLogger';
```

And replace:

```ts
jest.mock('./PrinterLogger', () => ({
```

with:

```ts
jest.mock('../PrinterLogger', () => ({
```

(`import { PermissionsAndroid, Platform } from 'react-native';` and `jest.mock('react-native', ...)` are bare specifiers — leave unchanged.)

- [ ] **Step 11: Verify**

Run: `npx jest src/features/printer/services/__tests__/DriverRegistry.web.test.ts src/features/printer/services/__tests__/PrintConfigurationService.test.ts src/features/printer/services/__tests__/PrinterConnectionLock.test.ts src/features/printer/services/__tests__/PrinterLogger.test.ts src/features/printer/services/__tests__/PrinterPermissionService.test.ts`
Expected: all 5 suites PASS with the same test names/counts as before the move.

- [ ] **Step 12: Commit**

```bash
git add src/features/printer/services/DriverRegistry.web.test.ts src/features/printer/services/__tests__/DriverRegistry.web.test.ts src/features/printer/services/PrintConfigurationService.test.ts src/features/printer/services/__tests__/PrintConfigurationService.test.ts src/features/printer/services/PrinterConnectionLock.test.ts src/features/printer/services/__tests__/PrinterConnectionLock.test.ts src/features/printer/services/PrinterLogger.test.ts src/features/printer/services/__tests__/PrinterLogger.test.ts src/features/printer/services/PrinterPermissionService.test.ts src/features/printer/services/__tests__/PrinterPermissionService.test.ts
git commit -m "chore: move printer services test files (batch 1) into __tests__/ subfolders"
```

---

### Task 7: Move `services` test files (batch 2: scheduler/print/discovery) into `__tests__/`

**Files:**
- Move: `src/features/printer/services/PrintScheduler.test.ts` → `src/features/printer/services/__tests__/PrintScheduler.test.ts`
- Move: `src/features/printer/services/PrintService.test.ts` → `src/features/printer/services/__tests__/PrintService.test.ts`
- Move: `src/features/printer/services/PrinterService.test.ts` → `src/features/printer/services/__tests__/PrinterService.test.ts`
- Move: `src/features/printer/services/discoverProtocol.test.ts` → `src/features/printer/services/__tests__/discoverProtocol.test.ts`

**Interfaces:** None — pure file relocation.

This task moves the last 4 files in `src/features/printer/services/` — after this task, that directory's `__tests__/` subfolder holds all 9 of its test files (5 from Task 6, 4 from this task).

- [ ] **Step 1: Move `PrintScheduler.test.ts`**

```bash
git mv src/features/printer/services/PrintScheduler.test.ts src/features/printer/services/__tests__/PrintScheduler.test.ts
```

- [ ] **Step 2: Fix its relative import paths**

In `src/features/printer/services/__tests__/PrintScheduler.test.ts`, replace:

```ts
import { createPrintScheduler } from './PrintScheduler';
import { createPrinterService } from './PrinterService';
import { createResourceLock } from './PrinterConnectionLock';
import { AppErrorException } from '../../../types/AppError';
import type { IPrinterDriver } from '../types/driver.types';
import type { PrintJob } from '../types/printJob.types';
import type { PrinterConfig } from '../types/printer.types';
```

with:

```ts
import { createPrintScheduler } from '../PrintScheduler';
import { createPrinterService } from '../PrinterService';
import { createResourceLock } from '../PrinterConnectionLock';
import { AppErrorException } from '../../../../types/AppError';
import type { IPrinterDriver } from '../../types/driver.types';
import type { PrintJob } from '../../types/printJob.types';
import type { PrinterConfig } from '../../types/printer.types';
```

- [ ] **Step 3: Move `PrintService.test.ts`**

```bash
git mv src/features/printer/services/PrintService.test.ts src/features/printer/services/__tests__/PrintService.test.ts
```

- [ ] **Step 4: Fix its relative import paths**

In `src/features/printer/services/__tests__/PrintService.test.ts`, replace:

```ts
import { createPrintService } from './PrintService';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintJob } from '../types/printJob.types';
```

with:

```ts
import { createPrintService } from '../PrintService';
import type { PrinterConfig } from '../../types/printer.types';
import type { PrintJob } from '../../types/printJob.types';
```

- [ ] **Step 5: Move `PrinterService.test.ts`**

```bash
git mv src/features/printer/services/PrinterService.test.ts src/features/printer/services/__tests__/PrinterService.test.ts
```

- [ ] **Step 6: Fix its relative import paths**

In `src/features/printer/services/__tests__/PrinterService.test.ts`, replace:

```ts
import { createPrinterService } from './PrinterService';
import { createResourceLock } from './PrinterConnectionLock';
import { StorageService } from '../../../services/StorageService';
import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterConfig } from '../types/printer.types';
```

with:

```ts
import { createPrinterService } from '../PrinterService';
import { createResourceLock } from '../PrinterConnectionLock';
import { StorageService } from '../../../../services/StorageService';
import type { IPrinterDriver } from '../../types/driver.types';
import type { PrinterConfig } from '../../types/printer.types';
```

- [ ] **Step 7: Move `discoverProtocol.test.ts`**

```bash
git mv src/features/printer/services/discoverProtocol.test.ts src/features/printer/services/__tests__/discoverProtocol.test.ts
```

- [ ] **Step 8: Fix its relative import and mock paths**

In `src/features/printer/services/__tests__/discoverProtocol.test.ts`, replace:

```ts
import { createDiscoverProtocol, resolveCandidates, type DiscoveryEvent } from './discoverProtocol';
import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterDetectionRule } from '../constants/printerDetectionRules';
import type { Protocol } from '../types/printer.types';
import { PrinterLogger } from './PrinterLogger';
```

with:

```ts
import { createDiscoverProtocol, resolveCandidates, type DiscoveryEvent } from '../discoverProtocol';
import type { IPrinterDriver } from '../../types/driver.types';
import type { PrinterDetectionRule } from '../../constants/printerDetectionRules';
import type { Protocol } from '../../types/printer.types';
import { PrinterLogger } from '../PrinterLogger';
```

And replace:

```ts
jest.mock('./PrinterLogger', () => ({
```

with:

```ts
jest.mock('../PrinterLogger', () => ({
```

- [ ] **Step 9: Verify**

Run: `npx jest src/features/printer/services/__tests__/PrintScheduler.test.ts src/features/printer/services/__tests__/PrintService.test.ts src/features/printer/services/__tests__/PrinterService.test.ts src/features/printer/services/__tests__/discoverProtocol.test.ts`
Expected: all 4 suites PASS with the same test names/counts as before the move.

- [ ] **Step 10: Verify the whole branch**

Run: `npm run verify` (type-check + lint + full test suite)
Expected: 0 type errors, 0 lint errors, all 39 suites pass (17 from the prior plan + this plan's 22 = matches the original pre-reorg total of 39 test files project-wide, all now uniformly under `__tests__/`).

Run: `find src -iname "*.test.ts" -not -path "*/__tests__/*"`
Expected: empty output — zero test files remain outside a `__tests__/` folder anywhere in the project.

- [ ] **Step 11: Commit**

```bash
git add src/features/printer/services/PrintScheduler.test.ts src/features/printer/services/__tests__/PrintScheduler.test.ts src/features/printer/services/PrintService.test.ts src/features/printer/services/__tests__/PrintService.test.ts src/features/printer/services/PrinterService.test.ts src/features/printer/services/__tests__/PrinterService.test.ts src/features/printer/services/discoverProtocol.test.ts src/features/printer/services/__tests__/discoverProtocol.test.ts
git commit -m "chore: move printer services test files (batch 2) into __tests__/ subfolders"
```

---

## Post-plan verification

After all 7 tasks:

```bash
npm run verify   # type-check + lint + test
```

Then confirm `find src -iname "*.test.ts" -not -path "*/__tests__/*"` returns nothing at all (unlike the prior plan, which expected only `printer/`'s files here — this plan closes that gap), and that the total test-file count across the whole project is still 39 (`find src -iname "*.test.ts" | wc -l`).
