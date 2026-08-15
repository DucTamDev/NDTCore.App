# Print Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `PrintDestination`/`PrintRule`/`OrderPrintPlanner` category-routing system with a much simpler fixed-`PrintType` (Receipt/Label) + `PrintConfiguration` model, on top of the driver/scheduler layer already built and reviewed on the branch this one forked from.

**Architecture:** Delete everything specific to destination/rule routing; add a flat `PrintConfiguration{printType, printerId, isDefault, isEnabled}` list read directly by a rewritten `PrintService.print(printType, document)`, which always broadcasts to every enabled+default printer for that type (no failover, no fanout mode). Checkout builds one receipt document for the whole order and sends it through this path, non-blockingly.

**Tech Stack:** React Native CLI + TypeScript strict, MMKV (`StorageService`), Jest, `react-native-paper`.

**Spec:** `docs/superpowers/specs/2026-08-15-print-configuration-design.md`

## Global Constraints

- TypeScript strict, no `any`.
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- UI component không bao giờ gọi driver/`DriverRegistry` trực tiếp — luôn qua `PrinterService`/`PrintService`.
- File logic (services) có `.test.ts`; component UI thuần trình bày thì không.
- ID generation: `generateId()` from `src/utils/id.ts` — do not add a `uuid` dependency.
- **No Redux slice for `PrintConfiguration`** — the branch this forked from had its final review flag `destinationSlice`/`printRuleSlice` as dead code (nothing dispatched into them, since `PrinterManagementPanel.tsx` already uses local `useState` + service re-reads, not Redux, for its list). Do not repeat that pattern here.
- This branch (`feat/print-configuration`) forked from the tip of `feat/printer-printing-system`, so every file this plan doesn't explicitly touch is assumed to exist exactly as that branch left it.

---

### Task 1: Remove the routing UI and its Settings wiring

**Files:**
- Delete: `src/features/printer/components/PrintDestinationPanel.tsx`
- Delete: `src/features/printer/components/PrintRoutingPanel.tsx`
- Modify: `src/features/settings/store/settingsSlice.ts`
- Modify: `src/features/settings/config/settingsConfig.ts`
- Modify: `src/features/settings/components/SettingsContent.tsx`

**Interfaces:**
- No new interfaces. This task only removes consumers of `DestinationService`/`PrintRuleService`/the old `PrintService`, clearing the way for later tasks to delete those files without breaking the build.

No `.test.ts` changes — none of the touched files have dedicated tests.

- [ ] **Step 1: Delete the two panel files**

Delete `src/features/printer/components/PrintDestinationPanel.tsx` and `src/features/printer/components/PrintRoutingPanel.tsx` entirely.

- [ ] **Step 2: Revert `settingsSlice.ts`**

Replace `src/features/settings/store/settingsSlice.ts`'s `SettingsMenuKey` union with:

```ts
export type SettingsMenuKey =
  | 'printer'
  | 'scanner'
  | 'account'
  | 'language'
  | 'sync'
  | 'info';
```

(Removes `'printDestination'`/`'printRouting'`. Everything else in this file — `SettingsState`, the slice, `activeMenuKeyChanged`, `selectActiveMenuKey` — is unchanged.)

- [ ] **Step 3: Revert `settingsConfig.ts`**

Replace `src/features/settings/config/settingsConfig.ts`'s `settingsMenuItems` array with:

```ts
export const settingsMenuItems: SettingsMenuItem[] = [
  { key: 'printer', icon: 'printer', label: 'Quản lý máy in', group: 'device' },
  { key: 'scanner', icon: 'barcode-scan', label: 'Máy quét mã vạch', group: 'device', disabled: true },
  { key: 'account', icon: 'account', label: 'Tài khoản', group: 'app', disabled: true },
  { key: 'language', icon: 'translate', label: 'Ngôn ngữ', group: 'app', disabled: true },
  { key: 'sync', icon: 'cloud-outline', label: 'Đồng bộ dữ liệu', group: 'app', disabled: true },
  { key: 'info', icon: 'information-outline', label: 'Về ứng dụng', group: 'app', disabled: true },
];
```

(Removes the `printDestination`/`printRouting` entries. `DEFAULT_TABLET_MENU_KEY` stays `'printer'`.)

- [ ] **Step 4: Revert `SettingsContent.tsx`**

Replace `src/features/settings/components/SettingsContent.tsx` entirely with:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';
import type { SettingsMenuKey } from '../store/settingsSlice';

interface SettingsContentProps {
  activeSection: SettingsMenuKey | null;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ activeSection }) => (
  <View style={styles.container}>
    {activeSection === 'printer' && <PrinterManagementPanel />}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

- [ ] **Step 5: Verify**

Run: `npm run type-check`
Expected: 0 errors.

Run: `npm test`
Expected: all suites pass (nothing references the deleted panels anymore; `DestinationService`/`PrintRuleService`/old `PrintService`/`OrderPrintPlanner` are still present and still compile — they just have no UI consumer left).

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/components/PrintDestinationPanel.tsx src/features/printer/components/PrintRoutingPanel.tsx src/features/settings/store/settingsSlice.ts src/features/settings/config/settingsConfig.ts src/features/settings/components/SettingsContent.tsx
git commit -m "chore: remove PrintDestination/PrintRouting panels and Settings wiring"
```

(`git add` on deleted files stages the deletion.)

---

### Task 2: `PrintConfiguration` type + `PrintConfigurationService`

**Files:**
- Create: `src/features/printer/types/printConfiguration.types.ts`
- Create: `src/features/printer/types/printConfiguration.types.test.ts`
- Create: `src/features/printer/services/PrintConfigurationService.ts`
- Create: `src/features/printer/services/PrintConfigurationService.test.ts`

**Interfaces:**
- Produces: `PrintType = 'Receipt' | 'Label'`; `PrintConfiguration { id, printType, printerId, isDefault, isEnabled }`; `PrintConfigurationService.{getAll, upsert, remove, getDefaultPrinterIdsForType}`.

- [ ] **Step 1: Write the failing compile-check test for the type**

Create `src/features/printer/types/printConfiguration.types.test.ts`:

```ts
import type { PrintConfiguration, PrintType } from './printConfiguration.types';

describe('print configuration types', () => {
  it('accepts a full PrintConfiguration for each PrintType', () => {
    const types: PrintType[] = ['Receipt', 'Label'];
    const configs: PrintConfiguration[] = types.map((printType) => ({
      id: `c-${printType}`,
      printType,
      printerId: 'p1',
      isDefault: true,
      isEnabled: true,
    }));
    expect(configs).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- printConfiguration.types.test.ts`
Expected: FAIL — module `./printConfiguration.types` does not exist.

- [ ] **Step 3: Implement the type**

Create `src/features/printer/types/printConfiguration.types.ts`:

```ts
export type PrintType = 'Receipt' | 'Label';

export interface PrintConfiguration {
  id: string;
  printType: PrintType;
  printerId: string;
  isDefault: boolean;
  isEnabled: boolean;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- printConfiguration.types.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing `PrintConfigurationService` test**

Create `src/features/printer/services/PrintConfigurationService.test.ts`:

```ts
import { createPrintConfigurationService } from './PrintConfigurationService';
import { StorageService } from '../../../services/StorageService';
import type { PrintConfiguration } from '../types/printConfiguration.types';

const receiptConfig: PrintConfiguration = { id: 'c1', printType: 'Receipt', printerId: 'p1', isDefault: true, isEnabled: true };
const labelConfig: PrintConfiguration = { id: 'c2', printType: 'Label', printerId: 'p2', isDefault: true, isEnabled: true };

describe('PrintConfigurationService', () => {
  beforeEach(() => StorageService.removeItem('printConfiguration.list'));

  it('returns an empty list when nothing is stored', () => {
    const service = createPrintConfigurationService();
    expect(service.getAll()).toEqual([]);
  });

  it('upsert() adds a new configuration, and updates an existing one by id', () => {
    const service = createPrintConfigurationService();
    service.upsert(receiptConfig);
    expect(service.getAll()).toEqual([receiptConfig]);
    const updated = { ...receiptConfig, isDefault: false };
    service.upsert(updated);
    expect(service.getAll()).toEqual([updated]);
  });

  it('remove() removes by id', () => {
    const service = createPrintConfigurationService();
    service.upsert(receiptConfig);
    service.remove(receiptConfig.id);
    expect(service.getAll()).toEqual([]);
  });

  it('getDefaultPrinterIdsForType() filters by printType, isDefault, and isEnabled', () => {
    const service = createPrintConfigurationService();
    service.upsert(receiptConfig);
    service.upsert(labelConfig);
    service.upsert({ id: 'c3', printType: 'Receipt', printerId: 'p3', isDefault: false, isEnabled: true });
    service.upsert({ id: 'c4', printType: 'Receipt', printerId: 'p4', isDefault: true, isEnabled: false });
    expect(service.getDefaultPrinterIdsForType('Receipt')).toEqual(['p1']);
    expect(service.getDefaultPrinterIdsForType('Label')).toEqual(['p2']);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- PrintConfigurationService.test.ts`
Expected: FAIL — module `./PrintConfigurationService` does not exist.

- [ ] **Step 7: Implement `PrintConfigurationService`**

Create `src/features/printer/services/PrintConfigurationService.ts`:

```ts
import { StorageService } from '../../../services/StorageService';
import type { PrintConfiguration, PrintType } from '../types/printConfiguration.types';

const PRINT_CONFIGURATION_LIST_KEY = 'printConfiguration.list';

export const createPrintConfigurationService = () => {
  const getAll = (): PrintConfiguration[] =>
    StorageService.getItem<PrintConfiguration[]>(PRINT_CONFIGURATION_LIST_KEY) ?? [];

  const saveAll = (configurations: PrintConfiguration[]): void => {
    StorageService.setItem(PRINT_CONFIGURATION_LIST_KEY, configurations);
  };

  const upsert = (configuration: PrintConfiguration): void => {
    const all = getAll();
    const index = all.findIndex((c) => c.id === configuration.id);
    if (index === -1) saveAll([...all, configuration]);
    else saveAll(all.map((c) => (c.id === configuration.id ? configuration : c)));
  };

  const remove = (id: string): void => {
    saveAll(getAll().filter((c) => c.id !== id));
  };

  const getDefaultPrinterIdsForType = (printType: PrintType): string[] =>
    getAll()
      .filter((c) => c.printType === printType && c.isDefault && c.isEnabled)
      .map((c) => c.printerId);

  return { getAll, upsert, remove, getDefaultPrinterIdsForType };
};

export const PrintConfigurationService = createPrintConfigurationService();
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- PrintConfigurationService.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/features/printer/types/printConfiguration.types.ts src/features/printer/types/printConfiguration.types.test.ts src/features/printer/services/PrintConfigurationService.ts src/features/printer/services/PrintConfigurationService.test.ts
git commit -m "feat: add PrintType, PrintConfiguration type, PrintConfigurationService"
```

---

### Task 3: Rewrite `PrintService` + checkout integration

**Files:**
- Modify: `src/features/printer/types/printJob.types.ts`
- Modify: `src/features/printer/types/printJob.types.test.ts`
- Modify: `src/features/printer/services/PrintService.ts` (full rewrite)
- Modify: `src/features/printer/services/PrintService.test.ts` (full rewrite)
- Modify: `src/features/cart/services/OrderPrintTrigger.ts` (full rewrite)
- Modify: `src/features/cart/services/OrderPrintTrigger.test.ts` (full rewrite — create if it doesn't already exist under this exact name)
- Modify: `src/features/cart/hooks/useCheckout.ts`
- Modify: `src/features/cart/components/CartPanel.tsx`

**Interfaces:**
- Consumes: `PrintConfigurationService.getDefaultPrinterIdsForType()` (Task 2), `PrinterService.getPrinters()`/`.enabled` (existing), `PrintScheduler.enqueue()` (existing), `PrintDocument`/`PrintElement` (existing).
- Produces: `PrintService.print(printType: PrintType, document: PrintDocument): Promise<PrintResult>`; `buildReceiptDocument(orderResponse, items, serviceType): PrintDocument`; `printReceipt(document): Promise<boolean>` (`true` = no Receipt printer configured); `useCheckout()` returns `noReceiptPrinterConfigured: boolean`/`dismissReceiptPrinterWarning: () => void` in place of the old `unroutedCount`/`dismissUnroutedCount`.

**This task keeps the working tree compiling throughout** because `PrintPlan` (in `printJob.types.ts`) is left in place for now — `OrderPrintPlanner.ts` (deleted in Task 4) still references it, and this task never touches `OrderPrintPlanner.ts`.

- [ ] **Step 1: Rename `PrintJob.planId` to `requestId`**

In `src/features/printer/types/printJob.types.ts`, change:

```ts
export interface PrintJob {
  id: string;
  planId: string;
  ...
```

to:

```ts
export interface PrintJob {
  id: string;
  requestId: string;
  ...
```

(Only this one field changes. `PrintPlan`, `PrintJobStatus`, `PrintResultStatus`, `PrintResult` are all unchanged in this file for now.)

- [ ] **Step 2: Update the now-broken compile-check test**

In `src/features/printer/types/printJob.types.test.ts`, change the `PrintJob` literal:

```ts
  it('accepts a pending PrintJob', () => {
    const job: PrintJob = {
      id: 'job1',
      requestId: 'req1',
      printerId: 'p1',
      document,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(job.status).toBe('pending');
  });
```

(Only the `planId: 'plan1'` → `requestId: 'req1'` line changes. The `PrintPlan` and `PrintResult` test cases in this file are unchanged.)

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `npm test -- printJob.types.test.ts`
Expected before Step 1/2: this pair is done together with the rename, so run it once now — Expected: PASS (both the type and the test were edited together; if this fails, re-check Step 1/2 match exactly).

- [ ] **Step 4: Write the failing `PrintService` test (full replacement)**

Replace all of `src/features/printer/services/PrintService.test.ts` with:

```ts
import { createPrintService } from './PrintService';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintJob } from '../types/printJob.types';

const document = { elements: [] };

const printer = (id: string, enabled = true): PrinterConfig => ({
  id, printerName: id, protocol: 'escpos', protocolSource: 'auto', connectionType: 'lan',
  paperSize: '80mm', autoReconnect: false, isDefault: false, enabled,
});

const makeDeps = (
  defaultPrinterIds: string[],
  printers: PrinterConfig[],
  scheduleResult: (printerId: string) => PrintJob,
) => ({
  getDefaultPrinterIdsForType: jest.fn().mockReturnValue(defaultPrinterIds),
  getPrinters: jest.fn().mockReturnValue(printers),
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService', () => {
  it('returns no-available-printer with no jobs and a NO_AVAILABLE_PRINTER error when nothing is configured', async () => {
    const deps = makeDeps([], [], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('no-available-printer');
    expect(result.jobs).toEqual([]);
    expect(result.error?.code).toBe('NO_AVAILABLE_PRINTER');
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('excludes a configured printer that is disabled', async () => {
    const deps = makeDeps(['p1'], [printer('p1', false)], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('no-available-printer');
  });

  it('sends to every configured printer and reports success when all succeed', async () => {
    const deps = makeDeps(['p1', 'p2'], [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, document, status: 'success', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('success');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(2);
  });

  it('reports partial-failure on mixed results', async () => {
    const deps = makeDeps(['p1', 'p2'], [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, document,
      status: printerId === 'p1' ? 'success' : 'failed', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('partial-failure');
  });

  it('reports failed with no top-level error when all configured printers fail', async () => {
    const deps = makeDeps(['p1', 'p2'], [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', requestId: 'req1', printerId, document, status: 'failed', retryCount: 0, createdAt: 'now',
      error: { code: 'PRINT_ERROR', message: 'x' },
    }));
    const service = createPrintService(deps);
    const result = await service.print('Receipt', document);
    expect(result.status).toBe('failed');
    expect(result.error).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- PrintService.test.ts`
Expected: FAIL — `createPrintService`'s current signature takes a `PrintPlan`, not `(printType, document)`; type errors / assertion failures.

- [ ] **Step 6: Rewrite `PrintService.ts`**

Replace all of `src/features/printer/services/PrintService.ts` with:

```ts
import { PrintConfigurationService } from './PrintConfigurationService';
import { PrinterService } from './PrinterService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import type { PrintType } from '../types/printConfiguration.types';
import type { PrintDocument } from '../types/printDocument.types';
import type { PrintJob, PrintResult } from '../types/printJob.types';

interface PrintServiceDeps {
  getDefaultPrinterIdsForType: typeof PrintConfigurationService.getDefaultPrinterIdsForType;
  getPrinters: typeof PrinterService.getPrinters;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

const printTypeLabel = (printType: PrintType): string => (printType === 'Receipt' ? 'Hoá đơn' : 'Tem');

export const createPrintService = (deps: PrintServiceDeps) => {
  const effectivePrinterIds = (printType: PrintType): string[] => {
    const configuredIds = new Set(deps.getDefaultPrinterIdsForType(printType));
    return deps.getPrinters()
      .filter((p) => p.enabled && configuredIds.has(p.id))
      .map((p) => p.id);
  };

  const print = async (printType: PrintType, document: PrintDocument): Promise<PrintResult> => {
    const printerIds = effectivePrinterIds(printType);
    if (printerIds.length === 0) {
      return {
        status: 'no-available-printer',
        jobs: [],
        error: { code: 'NO_AVAILABLE_PRINTER', message: `Chưa thiết lập máy in cho ${printTypeLabel(printType)}` },
      };
    }

    const requestId = generateId();
    const jobs: PrintJob[] = await Promise.all(
      printerIds.map((printerId) =>
        deps.scheduler.enqueue({
          id: generateId(),
          requestId,
          printerId,
          document,
          status: 'pending',
          retryCount: 0,
          createdAt: new Date().toISOString(),
        }),
      ),
    );
    const successCount = jobs.filter((job) => job.status === 'success').length;
    const status = successCount === jobs.length ? 'success' : successCount === 0 ? 'failed' : 'partial-failure';
    return { status, jobs };
  };

  return { print };
};

export const PrintService = createPrintService({
  getDefaultPrinterIdsForType: PrintConfigurationService.getDefaultPrinterIdsForType,
  getPrinters: PrinterService.getPrinters,
  scheduler: PrintScheduler,
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- PrintService.test.ts`
Expected: PASS

- [ ] **Step 8: Write the failing `OrderPrintTrigger` test (full replacement)**

Replace all of `src/features/cart/services/OrderPrintTrigger.test.ts` with (create the file if it doesn't already exist under this name):

```ts
import { buildReceiptDocument, printReceipt } from './OrderPrintTrigger';
import { PrintService } from '../../printer/services/PrintService';
import type { CartItem, CreateOrderResponse } from '../types/cart.types';

jest.mock('../../printer/services/PrintService');

const item: CartItem = {
  key: 'k1', productId: 1, productCode: 'SKU1', productName: 'Trà sữa', imageUrl: null,
  regularPrice: 30000, unitPrice: 30000, quantity: 2, note: 'ít đường', optionGroups: [], options: [],
};

const orderResponse: CreateOrderResponse = { Id: 1, OrderNumber: 'ORD-001', Status: 'Created', TotalAmount: 60000, CreatedAt: null };

describe('buildReceiptDocument', () => {
  it('builds one document with a header line and one table row per item', () => {
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    expect(document.elements[0]).toEqual({ type: 'text', content: 'Đơn ORD-001 · DineIn', x: 0, y: 0 });
    const table = document.elements.find((el) => el.type === 'table');
    expect(table).toMatchObject({ rows: [['Trà sữa', '2', 'ít đường']] });
  });
});

describe('printReceipt', () => {
  it('resolves true when PrintService reports no-available-printer', async () => {
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'no-available-printer', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    await expect(printReceipt(document)).resolves.toBe(true);
  });

  it('resolves false and never rejects when PrintService.print rejects', async () => {
    (PrintService.print as jest.Mock).mockRejectedValue(new Error('mất kết nối'));
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    await expect(printReceipt(document)).resolves.toBe(false);
  });

  it('resolves false when printing succeeds', async () => {
    (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });
    const document = buildReceiptDocument(orderResponse, [item], 'DineIn');
    await expect(printReceipt(document)).resolves.toBe(false);
  });
});
```

- [ ] **Step 9: Run test to verify it fails**

Run: `npm test -- OrderPrintTrigger.test.ts`
Expected: FAIL — `buildReceiptDocument`/`printReceipt` don't exist yet (the file currently exports `buildOrderFromCart`/`triggerPrinting`).

- [ ] **Step 10: Rewrite `OrderPrintTrigger.ts`**

Replace all of `src/features/cart/services/OrderPrintTrigger.ts` with:

```ts
import { PrintService } from '../../printer/services/PrintService';
import { LoggerService } from '../../../services/LoggerService';
import type { CartItem, CreateOrderResponse, ServiceType } from '../types/cart.types';
import type { PrintDocument } from '../../printer/types/printDocument.types';

export const buildReceiptDocument = (
  orderResponse: CreateOrderResponse,
  items: CartItem[],
  serviceType: ServiceType,
): PrintDocument => ({
  elements: [
    { type: 'text', content: `Đơn ${orderResponse.OrderNumber} · ${serviceType}`, x: 0, y: 0 },
    { type: 'line', x: 0, y: 20 },
    { type: 'table', rows: items.map((item) => [item.productName, String(item.quantity), item.note]), x: 0, y: 30 },
  ],
});

/**
 * Kích hoạt in hoá đơn theo kiểu "fire-and-forget": gửi thẳng 1 document cho
 * toàn bộ đơn tới PrintService. Không bao giờ reject — mọi lỗi đều bị nuốt
 * và ghi log cảnh báo, để submit() phía trên không bị ảnh hưởng.
 *
 * Triggers receipt printing "fire-and-forget": sends one document for the
 * whole order straight to PrintService. Never rejects — every error is
 * swallowed and logged as a warning, so the calling submit() is unaffected.
 *
 * @returns true nếu chưa thiết lập máy in cho Hoá đơn (no-available-printer).
 */
export const printReceipt = async (document: PrintDocument): Promise<boolean> => {
  try {
    const result = await PrintService.print('Receipt', document);
    return result.status === 'no-available-printer';
  } catch (err) {
    LoggerService.warning(`In hoá đơn thất bại: ${String(err)}`);
    return false;
  }
};
```

- [ ] **Step 11: Run test to verify it passes**

Run: `npm test -- OrderPrintTrigger.test.ts`
Expected: PASS

- [ ] **Step 12: Update `useCheckout.ts`'s call site**

In `src/features/cart/hooks/useCheckout.ts`:
- Change the import from `import { buildOrderFromCart, triggerPrinting } from '../services/OrderPrintTrigger';` to `import { buildReceiptDocument, printReceipt } from '../services/OrderPrintTrigger';`.
- Remove the `import { selectProducts } from '../../catalog/store/catalogSlice';` import and the `products` selector/state line — no longer needed (no `categoryId` lookup left).
- Rename the state: `const [unroutedCount, setUnroutedCount] = useState(0);` → `const [noReceiptPrinterConfigured, setNoReceiptPrinterConfigured] = useState(false);`
- Inside `submit()`, replace:
  ```ts
  const order = buildOrderFromCart(response.Data, items, serviceType, products);
  triggerPrinting(order).then(setUnroutedCount);
  ```
  with:
  ```ts
  const document = buildReceiptDocument(response.Data, items, serviceType);
  printReceipt(document).then(setNoReceiptPrinterConfigured);
  ```
- Update the `useCallback` dependency array: remove `products`, keep the rest (`dispatch, storeId, items, serviceType, note`).
- Rename `dismissUnroutedCount` to `dismissReceiptPrinterWarning` (same body, just `setNoReceiptPrinterConfigured(false)`).
- Update the return statement's field names accordingly: `{ submit, isSubmitting, error, dismissError, noReceiptPrinterConfigured, dismissReceiptPrinterWarning }`.

The full resulting file:

```ts
// src/features/cart/hooks/useCheckout.ts
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { selectCurrentStoreId } from '../../store/store/storeSlice';
import { CartService } from '../services/CartService';
import { buildReceiptDocument, printReceipt } from '../services/OrderPrintTrigger';
import { orderApi } from '../api/orderApi';
import { cartCleared, selectCartItems, selectCartNote, selectServiceType } from '../store/cartSlice';
import type { CreateOrderResponse } from '../types/cart.types';

export const useCheckout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));
  const items = useSelector((state: RootState) => selectCartItems(state));
  const serviceType = useSelector((state: RootState) => selectServiceType(state));
  const note = useSelector((state: RootState) => selectCartNote(state));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noReceiptPrinterConfigured, setNoReceiptPrinterConfigured] = useState(false);

  const submit = useCallback(async (): Promise<CreateOrderResponse | null> => {
    if (storeId === null || items.length === 0) return null;

    setIsSubmitting(true);
    setError(null);
    try {
      const request = CartService.toCreateOrderRequest(storeId, items, serviceType, note);
      const response = await orderApi.createOrderAsync(request);
      if (!response.IsSuccess || !response.Data) {
        throw new Error(response.Error?.Message ?? 'Không thể tạo đơn hàng');
      }
      dispatch(cartCleared());
      // Không await: submit() phải trả về ngay khi đơn hàng được tạo thành
      // công, không chờ việc in ấn (fire-and-forget theo spec §5).
      const document = buildReceiptDocument(response.Data, items, serviceType);
      printReceipt(document).then(setNoReceiptPrinterConfigured);
      return response.Data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo đơn hàng');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, storeId, items, serviceType, note]);

  const dismissError = useCallback(() => setError(null), []);
  const dismissReceiptPrinterWarning = useCallback(() => setNoReceiptPrinterConfigured(false), []);

  return { submit, isSubmitting, error, dismissError, noReceiptPrinterConfigured, dismissReceiptPrinterWarning };
};
```

- [ ] **Step 13: Update `CartPanel.tsx`**

In `src/features/cart/components/CartPanel.tsx`:
- Change the destructure: `const { submit, isSubmitting, error, dismissError, unroutedCount, dismissUnroutedCount } = useCheckout();` → `const { submit, isSubmitting, error, dismissError, noReceiptPrinterConfigured, dismissReceiptPrinterWarning } = useCheckout();`
- Change the third `Snackbar`:
  ```tsx
  <Snackbar visible={unroutedCount > 0} onDismiss={dismissUnroutedCount} duration={4000}>
    {`${unroutedCount} món chưa có cấu hình in`}
  </Snackbar>
  ```
  to:
  ```tsx
  <Snackbar visible={noReceiptPrinterConfigured} onDismiss={dismissReceiptPrinterWarning} duration={4000}>
    Chưa thiết lập máy in cho Hoá đơn
  </Snackbar>
  ```

- [ ] **Step 14: Run the full suite and type-check**

Run: `npm test`
Expected: all suites pass (no more references to `unroutedCount`/`buildOrderFromCart`/`triggerPrinting`/`selectProducts` in the cart feature).

Run: `npm run type-check`
Expected: 0 errors. (`OrderPrintPlanner.ts`/`DestinationService.ts`/`destination.types.ts`/`printRule*` files still exist and still compile — nothing in this task touches them, they're now simply unreferenced by anything except each other and are deleted in Task 4.)

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 15: Commit**

```bash
git add src/features/printer/types/printJob.types.ts src/features/printer/types/printJob.types.test.ts src/features/printer/services/PrintService.ts src/features/printer/services/PrintService.test.ts src/features/cart/services/OrderPrintTrigger.ts src/features/cart/services/OrderPrintTrigger.test.ts src/features/cart/hooks/useCheckout.ts src/features/cart/components/CartPanel.tsx
git commit -m "feat: rewrite PrintService and checkout integration around PrintConfiguration"
```

---

### Task 4: Delete the routing internals

**Files:**
- Delete: `src/features/printer/services/OrderPrintPlanner.ts` (+ `.test.ts`)
- Delete: `src/features/printer/types/order.types.ts`
- Delete: `src/features/printer/types/destination.types.ts`
- Delete: `src/features/printer/services/DestinationService.ts` (+ `.test.ts`)
- Delete: `src/features/printer/store/destinationSlice.ts` (+ `.test.ts`)
- Delete: `src/features/printer/types/printRule.types.ts`
- Delete: `src/features/printer/services/PrintRuleService.ts` (+ `.test.ts`)
- Delete: `src/features/printer/store/printRuleSlice.ts` (+ `.test.ts`)
- Delete: `src/features/printer/services/evaluatePrintRules.ts` (+ `.test.ts`)
- Modify: `src/features/printer/types/printJob.types.ts` (remove `PrintPlan`)
- Modify: `src/store/index.ts` (remove `destination`/`printRule` reducers)

**Interfaces:**
- Removes: `PrintPlan`, `Order`, `OrderItem`, `PrintDestination`, `PrintCondition`, `PrintRule`, `PrintRoutingConfiguration`, `OrderPrintPlanner`, `DestinationService`, `PrintRuleService`, `evaluatePrintRules`, `destinationSlice`, `printRuleSlice` — none of these are referenced by anything after Task 3, so deleting them is purely subtractive.

No new tests — this task only removes files and two small edits.

- [ ] **Step 1: Delete the 9 files (18 counting `.test.ts` pairs) listed above**

```bash
rm src/features/printer/services/OrderPrintPlanner.ts src/features/printer/services/OrderPrintPlanner.test.ts
rm src/features/printer/types/order.types.ts
rm src/features/printer/types/destination.types.ts
rm src/features/printer/services/DestinationService.ts src/features/printer/services/DestinationService.test.ts
rm src/features/printer/store/destinationSlice.ts src/features/printer/store/destinationSlice.test.ts
rm src/features/printer/types/printRule.types.ts
rm src/features/printer/services/PrintRuleService.ts src/features/printer/services/PrintRuleService.test.ts
rm src/features/printer/store/printRuleSlice.ts src/features/printer/store/printRuleSlice.test.ts
rm src/features/printer/services/evaluatePrintRules.ts src/features/printer/services/evaluatePrintRules.test.ts
```

- [ ] **Step 2: Remove `PrintPlan` from `printJob.types.ts`**

In `src/features/printer/types/printJob.types.ts`, delete this block entirely:

```ts
export interface PrintPlan {
  id: string;
  destinationId: string;
  document: PrintDocument;
  copies: number;
}
```

The file should now start directly with the `PrintJobStatus`/`PrintJob` declarations (the `import type { PrintDocument } from './printDocument.types';` import stays — `PrintJob.document: PrintDocument` still needs it).

- [ ] **Step 3: Revert `src/store/index.ts`**

Remove the `destination`/`printRule` imports and reducer-map entries. Resulting file:

```ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/store/authSlice';
import cartReducer from '../features/cart/store/cartSlice';
import catalogReducer from '../features/catalog/store/catalogSlice';
import currentStoreReducer from '../features/store/store/storeSlice';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    catalog: catalogReducer,
    currentStore: currentStoreReducer,
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 4: Verify**

Run: `npm run type-check`
Expected: 0 errors.

Run: `npm test`
Expected: all suites pass — the deleted files' own tests are gone with them, and nothing else referenced them.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete PrintDestination/PrintRule/OrderPrintPlanner and their storage"
```

(`git add -A` here is appropriate — every change in this task is a deletion or an edit already fully described above; there is nothing else in the working tree to accidentally sweep in, since Tasks 1-3 already committed their own changes.)

---

### Task 5: `PrintConfigurationPanel` UI + Settings wiring

**Files:**
- Create: `src/features/printer/components/PrintConfigurationPanel.tsx`
- Modify: `src/features/settings/store/settingsSlice.ts`
- Modify: `src/features/settings/config/settingsConfig.ts`
- Modify: `src/features/settings/components/SettingsContent.tsx`

**Interfaces:**
- Consumes: `PrintConfigurationService.{getAll, upsert, remove}` (Task 2), `PrinterService.getPrinters()` (existing), `AppSwitch` (existing, `src/components/AppSwitch.tsx`), `generateId()` (existing).

No `.test.ts` (pure presentational + form panel, per this repo's convention).

- [ ] **Step 1: Register the new settings menu key**

In `src/features/settings/store/settingsSlice.ts`:

```ts
export type SettingsMenuKey =
  | 'printer'
  | 'printConfiguration'
  | 'scanner'
  | 'account'
  | 'language'
  | 'sync'
  | 'info';
```

In `src/features/settings/config/settingsConfig.ts`, add one entry to `settingsMenuItems` right after the `printer` entry:

```ts
{ key: 'printConfiguration', icon: 'printer-settings', label: 'Thiết lập in', group: 'device' },
```

- [ ] **Step 2: Implement `PrintConfigurationPanel`**

Create `src/features/printer/components/PrintConfigurationPanel.tsx`, following `PrinterManagementPanel.tsx`'s established pattern (local `useState` list + `refresh` callback re-reading from the service, no Redux subscription):

```tsx
// src/features/printer/components/PrintConfigurationPanel.tsx
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppSwitch } from '../../../components/AppSwitch';
import { PrinterService } from '../services/PrinterService';
import { PrintConfigurationService } from '../services/PrintConfigurationService';
import { generateId } from '../../../utils/id';
import type { PrintConfiguration, PrintType } from '../types/printConfiguration.types';

const PRINT_TYPE_SECTIONS: { printType: PrintType; label: string }[] = [
  { printType: 'Receipt', label: 'Hoá đơn' },
  { printType: 'Label', label: 'Tem' },
];

export const PrintConfigurationPanel: React.FC = () => {
  const [configurations, setConfigurations] = useState<PrintConfiguration[]>(() => PrintConfigurationService.getAll());
  const printers = PrinterService.getPrinters();

  const refresh = useCallback(() => setConfigurations(PrintConfigurationService.getAll()), []);

  const toggle = (printType: PrintType, printerId: string, checked: boolean): void => {
    const existing = configurations.find((c) => c.printType === printType && c.printerId === printerId);
    if (checked) {
      PrintConfigurationService.upsert({
        id: existing?.id ?? generateId(),
        printType,
        printerId,
        isDefault: true,
        isEnabled: true,
      });
    } else if (existing) {
      PrintConfigurationService.remove(existing.id);
    }
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Thiết lập in</Text>
      {PRINT_TYPE_SECTIONS.map((section) => (
        <View key={section.printType} style={styles.section}>
          <Text variant="titleSmall">{section.label}</Text>
          {printers.map((printer) => {
            const checked = configurations.some(
              (c) => c.printType === section.printType && c.printerId === printer.id,
            );
            return (
              <AppSwitch
                key={printer.id}
                label={printer.printerName}
                value={checked}
                onValueChange={(value) => toggle(section.printType, printer.id, value)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 8 },
});
```

- [ ] **Step 3: Wire into `SettingsContent`**

In `src/features/settings/components/SettingsContent.tsx`:

```tsx
import { PrintConfigurationPanel } from '../../printer/components/PrintConfigurationPanel';
// ...
{activeSection === 'printConfiguration' && <PrintConfigurationPanel />}
```

Full resulting file:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';
import { PrintConfigurationPanel } from '../../printer/components/PrintConfigurationPanel';
import type { SettingsMenuKey } from '../store/settingsSlice';

interface SettingsContentProps {
  activeSection: SettingsMenuKey | null;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ activeSection }) => (
  <View style={styles.container}>
    {activeSection === 'printer' && <PrinterManagementPanel />}
    {activeSection === 'printConfiguration' && <PrintConfigurationPanel />}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

- [ ] **Step 4: Verify with type-check and lint**

Run: `npm run type-check`
Expected: 0 errors.

Run: `npm run lint`
Expected: 0 errors.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/components/PrintConfigurationPanel.tsx src/features/settings/store/settingsSlice.ts src/features/settings/config/settingsConfig.ts src/features/settings/components/SettingsContent.tsx
git commit -m "feat: add Print Configuration panel, wired into Settings"
```

---

## Post-plan verification

After all 5 tasks:

```bash
npm run verify   # type-check + lint + test
```

Then manually, on a device/emulator: add a printer (existing flow, unchanged), open Cài đặt → Thiết lập in, check it under "Hoá đơn", complete a real checkout and confirm that printer receives one ticket with every item in the order. Check/uncheck under "Tem" and confirm it persists (no consumer yet — this only proves the checklist state round-trips).
