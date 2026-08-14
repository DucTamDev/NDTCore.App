# Printer Printing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Printing half of the printer system — Destination/Rule
config, `PrintDestination`-based fanout, a per-printer job scheduler, and
real category-based order routing wired into checkout — on top of the
already-existing Printer Management layer (`PrinterService`, `DriverRegistry`).

**Architecture:** A new `PrintService` (facade) resolves a `PrintPlan`
against `PrintDestination`/`Printer.enabled`, fans out to one `PrintJob` per
effective printer, and hands each job to a `PrintScheduler` that serializes
writes per `printerId` by calling a new `PrinterService.print(printerId,
document)` — never touching `DriverRegistry` directly. `OrderPrintPlanner`
groups a checked-out order's items by resolved destination and is wired
non-blockingly into `useCheckout.ts`.

**Tech Stack:** React Native CLI + TypeScript strict, Redux Toolkit, MMKV
(`StorageService`), Jest, `react-native-paper`.

**Spec:** `docs/superpowers/specs/2026-08-14-printer-printing-system-design.md`

## Global Constraints

- TypeScript strict, no `any` (repo-wide convention).
- Toàn bộ text hiển thị cho người dùng: tiếng Việt.
- UI component không bao giờ gọi driver/`DriverRegistry` trực tiếp — luôn
  qua `PrinterService`/`PrintService`.
- File logic (services, slices, encoders, drivers) có `.test.ts`; component
  UI thuần trình bày thì không.
- Trạng thái kết nối máy in là event-driven — không polling.
- **Branch risk (spec §3):** this plan's Task 4 targets
  `src/features/printer/drivers/EscPosDriver.ts`, the real ESC/POS driver on
  `main`. If branch `feat/thermal-receipt-printer-driver` merges to `main`
  before this plan's branch does, `EscPosDriver.ts` will be gone — stop and
  flag this to the user before continuing Task 4 if that file is missing
  when you reach it.
- ID generation: `generateId()` from `src/utils/id.ts` (existing repo
  convention, e.g. used in `AddPrinterModal.tsx`) — do not add a `uuid`
  dependency.

---

### Task 1: `Printer.enabled`

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`
- Modify: `src/features/printer/store/printerSlice.ts`
- Modify: `src/features/printer/store/printerSlice.test.ts`
- Modify: `src/features/printer/services/PrinterService.ts`
- Modify: `src/features/printer/services/PrinterService.test.ts`

**Interfaces:**
- Produces: `PrinterConfig.enabled: boolean`; `printerEnabledChanged({printerId, enabled})` action + `selectPrinterEnabled(state, printerId): boolean` selector; `PrinterService.setEnabled(printerId: string, enabled: boolean): void`; `PrinterService.getPrinters()` now normalizes missing `enabled` to `true`.

- [ ] **Step 1: Add the field to the type**

In `src/features/printer/types/printer.types.ts`, add to `PrinterConfig`:

```ts
export interface PrinterConfig {
  id: string;
  printerName: string;
  protocol: Protocol;
  protocolSource: ProtocolSource;
  connectionType: ConnectionType;
  paperSize: PaperSize;
  autoReconnect: boolean;
  isDefault: boolean;
  enabled: boolean;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  deviceInfo?: PrinterDeviceInfo;
}
```

- [ ] **Step 2: Write the failing slice test**

Add to `src/features/printer/store/printerSlice.test.ts`:

```ts
it('printerEnabledChanged updates enabled for that printer only', () => {
  const other = { ...printer, id: 'p2', enabled: true };
  let state = printerReducer(undefined, printersLoaded([printer, other]));
  state = printerReducer(state, printerEnabledChanged({ printerId: 'p1', enabled: false }));
  expect(selectPrinters({ printer: state }).find((p) => p.id === 'p1')?.enabled).toBe(false);
  expect(selectPrinters({ printer: state }).find((p) => p.id === 'p2')?.enabled).toBe(true);
});
```

Add `enabled: true` to the existing `printer` fixture object at the top of
the file (it will fail to type-check otherwise), and add `printerEnabledChanged`
to the import list from `./printerSlice`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- printerSlice.test.ts`
Expected: FAIL — `printerEnabledChanged` is not exported.

- [ ] **Step 4: Implement the reducer and selector**

In `src/features/printer/store/printerSlice.ts`, add to `reducers`:

```ts
printerEnabledChanged(state, action: PayloadAction<{ printerId: string; enabled: boolean }>) {
  const printer = state.printers.find((p) => p.id === action.payload.printerId);
  if (printer) printer.enabled = action.payload.enabled;
},
```

Add `printerEnabledChanged` to the `export const { ... }` block.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- printerSlice.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing PrinterService test**

Add to `src/features/printer/services/PrinterService.test.ts` (add
`enabled: true` to `baseConfig` first, or the fixture will fail to compile):

```ts
it('setEnabled() updates enabled for that printer only', () => {
  const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() });
  const second: PrinterConfig = { ...baseConfig, id: 'p2' };
  service.addPrinter(baseConfig);
  service.addPrinter(second);
  service.setEnabled('p1', false);
  expect(service.getPrinters().find((p) => p.id === 'p1')?.enabled).toBe(false);
  expect(service.getPrinters().find((p) => p.id === 'p2')?.enabled).toBe(true);
});

it('getPrinters() normalizes a stored printer with no enabled field to true', () => {
  const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() });
  const legacyRecord = { ...baseConfig } as Partial<PrinterConfig>;
  delete legacyRecord.enabled;
  StorageService.setItem('printer.list', [legacyRecord]);
  expect(service.getPrinters()[0].enabled).toBe(true);
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- PrinterService.test.ts`
Expected: FAIL — `setEnabled` is not a function; normalization test fails
(`enabled` is `undefined`).

- [ ] **Step 8: Implement `setEnabled` and read-time normalization**

In `src/features/printer/services/PrinterService.ts`:

```ts
const getPrinters = (): PrinterConfig[] =>
  (StorageService.getItem<PrinterConfig[]>(PRINTER_LIST_KEY) ?? []).map((p) => ({
    ...p,
    enabled: p.enabled ?? true,
  }));
```

Add, mirroring `setDefault`:

```ts
const setEnabled = (printerId: string, enabled: boolean): void => {
  savePrinters(getPrinters().map((p) => (p.id === printerId ? { ...p, enabled } : p)));
};
```

Add `setEnabled` to the returned object.

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- PrinterService.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/features/printer/types/printer.types.ts src/features/printer/store/printerSlice.ts src/features/printer/store/printerSlice.test.ts src/features/printer/services/PrinterService.ts src/features/printer/services/PrinterService.test.ts
git commit -m "feat: add Printer.enabled with read-time normalization for legacy records"
```

---

### Task 2: `PrintDocument`, `PrintJob`, `PrintPlan`, `PrintResult` types

**Files:**
- Create: `src/features/printer/types/printDocument.types.ts`
- Create: `src/features/printer/types/printDocument.types.test.ts`
- Create: `src/features/printer/types/printJob.types.ts`
- Create: `src/features/printer/types/printJob.types.test.ts`

**Interfaces:**
- Produces: `PrintDocument`, `PrintElement` (union of `text`/`image`/`barcode`/`qrCode`/`line`/`table`), `PrintPlan`, `PrintJob`, `PrintJobStatus`, `PrintResult`, `PrintResultStatus`.

- [ ] **Step 1: Write the failing compile-check test for `PrintDocument`**

Create `src/features/printer/types/printDocument.types.test.ts`:

```ts
import type { PrintDocument, PrintElement } from './printDocument.types';

describe('print document types', () => {
  it('accepts a document mixing every element kind', () => {
    const elements: PrintElement[] = [
      { type: 'text', content: 'NDTCore POS', x: 0, y: 0 },
      { type: 'line', x: 0, y: 10 },
      { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      { type: 'image', data: 'base64...', x: 0, y: 40 },
      { type: 'barcode', content: '123456', x: 0, y: 60 },
      { type: 'qrCode', content: 'https://ndtcore.pos/order/1', x: 0, y: 80 },
    ];
    const document: PrintDocument = { elements };
    expect(document.elements).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- printDocument.types.test.ts`
Expected: FAIL — module `./printDocument.types` does not exist.

- [ ] **Step 3: Implement `printDocument.types.ts`**

Create `src/features/printer/types/printDocument.types.ts`:

```ts
interface PrintElementBase {
  x: number;
  y: number;
}

export interface PrintTextElement extends PrintElementBase {
  type: 'text';
  content: string;
}

export interface PrintImageElement extends PrintElementBase {
  type: 'image';
  data: string;
}

export interface PrintBarcodeElement extends PrintElementBase {
  type: 'barcode';
  content: string;
}

export interface PrintQrCodeElement extends PrintElementBase {
  type: 'qrCode';
  content: string;
}

export interface PrintLineElement extends PrintElementBase {
  type: 'line';
}

export interface PrintTableElement extends PrintElementBase {
  type: 'table';
  rows: string[][];
}

export type PrintElement =
  | PrintTextElement
  | PrintImageElement
  | PrintBarcodeElement
  | PrintQrCodeElement
  | PrintLineElement
  | PrintTableElement;

export interface PrintDocument {
  elements: PrintElement[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- printDocument.types.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing compile-check test for `PrintJob`/`PrintPlan`/`PrintResult`**

Create `src/features/printer/types/printJob.types.test.ts`:

```ts
import type { PrintDocument } from './printDocument.types';
import type { PrintPlan, PrintJob, PrintResult } from './printJob.types';

const document: PrintDocument = { elements: [{ type: 'text', content: 'x', x: 0, y: 0 }] };

describe('print job types', () => {
  it('accepts a full PrintPlan', () => {
    const plan: PrintPlan = { id: 'plan1', destinationId: 'dest1', document, copies: 1 };
    expect(plan.copies).toBe(1);
  });

  it('accepts a pending PrintJob', () => {
    const job: PrintJob = {
      id: 'job1',
      planId: 'plan1',
      printerId: 'p1',
      document,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    expect(job.status).toBe('pending');
  });

  it('accepts every PrintResult status', () => {
    const results: PrintResult[] = [
      { status: 'success', jobs: [] },
      { status: 'partial-failure', jobs: [] },
      { status: 'failed', jobs: [] },
      { status: 'no-available-printer', jobs: [] },
    ];
    expect(results).toHaveLength(4);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- printJob.types.test.ts`
Expected: FAIL — module `./printJob.types` does not exist.

- [ ] **Step 7: Implement `printJob.types.ts`**

Create `src/features/printer/types/printJob.types.ts`:

```ts
import type { AppError } from '../../../types/AppError';
import type { PrintDocument } from './printDocument.types';

export interface PrintPlan {
  id: string;
  destinationId: string;
  document: PrintDocument;
  copies: number;
}

export type PrintJobStatus = 'pending' | 'printing' | 'success' | 'failed' | 'cancelled';

export interface PrintJob {
  id: string;
  planId: string;
  printerId: string;
  document: PrintDocument;
  status: PrintJobStatus;
  retryCount: number;
  error?: AppError;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type PrintResultStatus = 'success' | 'partial-failure' | 'failed' | 'no-available-printer';

export interface PrintResult {
  status: PrintResultStatus;
  jobs: PrintJob[];
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- printJob.types.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/features/printer/types/printDocument.types.ts src/features/printer/types/printDocument.types.test.ts src/features/printer/types/printJob.types.ts src/features/printer/types/printJob.types.test.ts
git commit -m "feat: add PrintDocument, PrintPlan, PrintJob, PrintResult types"
```

---

### Task 3: `IPrinterDriver.print()` + `TsplEncoder.image()` + `TsplDriver.print()`

**Files:**
- Modify: `src/features/printer/types/driver.types.ts`
- Modify: `src/types/AppError.ts`
- Modify: `src/features/printer/protocols/TsplEncoder.ts`
- Modify: `src/features/printer/protocols/TsplEncoder.test.ts`
- Modify: `src/features/printer/drivers/TsplDriver.ts`
- Modify: `src/features/printer/drivers/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `PrintDocument`/`PrintElement` (Task 2).
- Produces: `IPrinterDriver.print(printerId: string, document: PrintDocument): Promise<void>`; `TsplEncoder.image(x: number, y: number, data: string): this`; `AppErrorCode` gains `'ENCODING_FAILED'`.

- [ ] **Step 1: Add `ENCODING_FAILED` to `AppErrorCode`**

In `src/types/AppError.ts`:

```ts
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONNECTION_ERROR'
  | 'UNSUPPORTED_CONNECTION'
  | 'PRINT_ERROR'
  | 'ENCODING_FAILED'
  | 'UNKNOWN_ERROR';
```

- [ ] **Step 2: Add `print()` to `IPrinterDriver`**

In `src/features/printer/types/driver.types.ts`:

```ts
import type { PrintDocument } from './printDocument.types';

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(config: PrinterConfig): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(config: PrinterConfig): Promise<void>;
  print(printerId: string, document: PrintDocument): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
}
```

This will break every mock/implementation of `IPrinterDriver` until Steps 3
and later (this task) and Task 4 add `print()` to `TsplDriver`/`EscPosDriver`,
and until Task 1's `PrinterService.test.ts` mock factory (`makeMockDriver`)
gets a `print` field — add it there too in this step:

```ts
const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  print: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});
```

(This edits `src/features/printer/services/PrinterService.test.ts` — add it
to this task's file list too.)

- [ ] **Step 3: Write the failing `TsplEncoder.image()` test**

Add to `src/features/printer/protocols/TsplEncoder.test.ts`:

```ts
it('image() adds a BITMAP command', () => {
  const bytes = new TsplEncoder().initialize('58mm').image(10, 20, 'AAAA').encode();
  const text = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
  expect(text).toContain('BITMAP 10,20');
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- TsplEncoder.test.ts`
Expected: FAIL — `image` is not a function.

- [ ] **Step 5: Implement `TsplEncoder.image()`**

In `src/features/printer/protocols/TsplEncoder.ts`, add alongside `qrcode()`:

```ts
image(x: number, y: number, data: string): this {
  this.commands.push(`BITMAP ${x},${y},${data}`);
  return this;
}
```

(TSPL's real `BITMAP` command needs width-in-bytes/height/mode fields ahead
of the raw data — this minimal form only carries what `PrintImageElement`
currently has (`x`, `y`, `data`). Extending `data` to a structured bitmap
payload is real follow-up work, not invented here as a placeholder — track
it as a known gap, do not silently under-implement the command format
without saying so.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- TsplEncoder.test.ts`
Expected: PASS

- [ ] **Step 7: Write the failing `TsplDriver.print()` test**

Add to `src/features/printer/drivers/TsplDriver.test.ts`:

```ts
it('print() encodes every element kind and writes once', async () => {
  const driver = new TsplDriver();
  await driver.connect(baseConfig); // reuse this file's existing baseConfig fixture
  const document: PrintDocument = {
    elements: [
      { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
      { type: 'line', x: 0, y: 10 },
      { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      { type: 'image', data: 'AAAA', x: 0, y: 40 },
      { type: 'barcode', content: '123', x: 0, y: 60 },
      { type: 'qrCode', content: 'https://x', x: 0, y: 80 },
    ],
  };
  await expect(driver.print(baseConfig.id, document)).resolves.toBeUndefined();
});

it('print() rejects with ENCODING_FAILED for an unsupported element', async () => {
  const driver = new TsplDriver();
  await driver.connect(baseConfig);
  const badElement = { type: 'unknown-kind', x: 0, y: 0 } as unknown as PrintElement;
  await expect(driver.print(baseConfig.id, { elements: [badElement] })).rejects.toMatchObject({
    code: 'ENCODING_FAILED',
  });
});
```

Add `import type { PrintDocument, PrintElement } from '../types/printDocument.types';`
to the top of the test file.

- [ ] **Step 8: Run test to verify it fails**

Run: `npm test -- TsplDriver.test.ts`
Expected: FAIL — `print` is not a function.

- [ ] **Step 9: Implement `TsplDriver.print()`**

In `src/features/printer/drivers/TsplDriver.ts`, add (needs `PrinterConfig`
for `paperSize`, so also track it per-printer like `connections` does —
simplest: look it up from the existing `connections` map's transport plus a
new `configs` map set in `connect()`):

```ts
// add near the other private maps
private configs = new Map<string, PrinterConfig>();
```

In `connect()`, after `this.connections.set(config.id, transport);`, add:
`this.configs.set(config.id, config);`

Then add the method:

```ts
async print(printerId: string, document: PrintDocument): Promise<void> {
  const config = this.configs.get(printerId);
  const transport = this.connections.get(printerId);
  if (!config || !transport) {
    throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
  }
  const encoder = new TsplEncoder().initialize(config.paperSize);
  for (const element of document.elements) {
    if (element.type === 'text') {
      encoder.text(element.x, element.y, element.content);
    } else if (element.type === 'line') {
      encoder.text(element.x, element.y, '--------------------------------');
    } else if (element.type === 'table') {
      element.rows.forEach((row, i) => encoder.text(element.x, element.y + i * 20, row.join('  ')));
    } else if (element.type === 'image') {
      encoder.image(element.x, element.y, element.data);
    } else if (element.type === 'barcode') {
      encoder.barcode(element.x, element.y, element.content);
    } else if (element.type === 'qrCode') {
      encoder.qrcode(element.x, element.y, element.content);
    } else {
      throw new AppErrorException({
        code: 'ENCODING_FAILED',
        message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}`,
      });
    }
  }
  const bytes = encoder.cut().encode();
  if (config.connectionType === 'lan') {
    (transport as LanTransport).write(bytes);
  } else if (config.connectionType === 'bluetooth') {
    await (transport as BluetoothTransport).write(bytes);
  } else {
    throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: 'USB chưa được hỗ trợ cho in nội dung tuỳ ý' });
  }
}
```

Add `import type { PrintDocument } from '../types/printDocument.types';` to
the top of `TsplDriver.ts`.

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test -- TsplDriver.test.ts TsplEncoder.test.ts PrinterService.test.ts`
Expected: PASS (the `PrinterService.test.ts` run here re-verifies Step 2's
mock-factory edit didn't break anything).

- [ ] **Step 11: Commit**

```bash
git add src/types/AppError.ts src/features/printer/types/driver.types.ts src/features/printer/protocols/TsplEncoder.ts src/features/printer/protocols/TsplEncoder.test.ts src/features/printer/drivers/TsplDriver.ts src/features/printer/drivers/TsplDriver.test.ts src/features/printer/services/PrinterService.test.ts
git commit -m "feat: add IPrinterDriver.print() and implement it on TsplDriver"
```

---

### Task 4: `EscPosDriver.print()`

**Files:**
- Modify: `src/features/printer/drivers/EscPosDriver.ts`
- Modify: `src/features/printer/drivers/EscPosDriver.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver.print()` (Task 3), `PrintDocument`/`PrintElement` (Task 2).
- Produces: `EscPosDriver.print(printerId, document): Promise<void>`.

**Before starting:** re-read
`node_modules/react-native-esc-pos-printer/lib/typescript/*.d.ts` (run
`npm install` first if `node_modules/react-native-esc-pos-printer` is
absent) for the real `AddImageParams`/`AddBarcodeParams`/`AddSymbolParams`
field names — the spec (§3) explicitly flagged these as unconfirmed. Adjust
the field names below to match what you find; do not guess silently if they
differ from what's shown here.

- [ ] **Step 1: Write the failing test**

Add to `src/features/printer/drivers/EscPosDriver.test.ts` (check this
file's existing mock setup for how `Printer`'s methods are mocked — likely
via `jest.mock('react-native-esc-pos-printer', ...)`; follow that pattern):

```ts
it('print() calls the matching add* method for each element kind, then feed/cut/send once', async () => {
  const driver = new EscPosDriver();
  await driver.connect(baseConfig);
  const printerInstance = mockPrinterInstances[mockPrinterInstances.length - 1]; // adjust to this file's actual mock-access pattern
  const document: PrintDocument = {
    elements: [
      { type: 'text', content: 'Trà sữa', x: 0, y: 0 },
      { type: 'line', x: 0, y: 10 },
      { type: 'table', rows: [['Trà sữa', '2']], x: 0, y: 20 },
      { type: 'image', data: 'AAAA', x: 0, y: 40 },
      { type: 'barcode', content: '123', x: 0, y: 60 },
      { type: 'qrCode', content: 'https://x', x: 0, y: 80 },
    ],
  };
  await driver.print(baseConfig.id, document);
  expect(printerInstance.addText).toHaveBeenCalled();
  expect(printerInstance.addImage).toHaveBeenCalled();
  expect(printerInstance.addBarcode).toHaveBeenCalled();
  expect(printerInstance.addSymbol).toHaveBeenCalled();
  expect(printerInstance.addFeedLine).toHaveBeenCalledTimes(1);
  expect(printerInstance.addCut).toHaveBeenCalledTimes(1);
  expect(printerInstance.sendData).toHaveBeenCalledTimes(1);
});
```

Adjust `mockPrinterInstances`/however this test file currently exposes the
mocked `Printer` instance created inside `connect()` — match the existing
`EscPosDriver.test.ts` mocking style exactly rather than introducing a new
one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EscPosDriver.test.ts`
Expected: FAIL — `print` is not a function.

- [ ] **Step 3: Implement `EscPosDriver.print()`**

In `src/features/printer/drivers/EscPosDriver.ts`:

```ts
async print(printerId: string, document: PrintDocument): Promise<void> {
  const printer = this.printers.get(printerId);
  if (!printer) {
    throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
  }
  for (const element of document.elements) {
    if (element.type === 'text') {
      await printer.addText(`${element.content}\n`);
    } else if (element.type === 'line') {
      await printer.addText('--------------------------------\n');
    } else if (element.type === 'table') {
      for (const row of element.rows) await printer.addText(`${row.join('  ')}\n`);
    } else if (element.type === 'image') {
      await printer.addImage({ data: element.data });
    } else if (element.type === 'barcode') {
      await printer.addBarcode({ data: element.content });
    } else if (element.type === 'qrCode') {
      await printer.addSymbol({ data: element.content });
    } else {
      throw new AppErrorException({
        code: 'ENCODING_FAILED',
        message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}`,
      });
    }
  }
  await printer.addFeedLine();
  await printer.addCut();
  await printer.sendData();
}
```

Add `import type { PrintDocument } from '../types/printDocument.types';` to
the top of `EscPosDriver.ts`. **The `{ data: ... }` param shapes above are
placeholders pending the real `.d.ts` check from this task's "Before
starting" note — replace them with the confirmed field names before this
step is considered done, not after.**

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EscPosDriver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/drivers/EscPosDriver.ts src/features/printer/drivers/EscPosDriver.test.ts
git commit -m "feat: implement EscPosDriver.print() using the Epson SDK's builder API"
```

---

### Task 5: `PrinterService.print()`

**Files:**
- Modify: `src/features/printer/services/PrinterService.ts`
- Modify: `src/features/printer/services/PrinterService.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver.print()` (Task 3/4).
- Produces: `PrinterService.print(printerId: string, document: PrintDocument): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Add to `src/features/printer/services/PrinterService.test.ts`:

```ts
it('print() forwards to the driver matching the printer protocol', async () => {
  const escposDriver = makeMockDriver();
  const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
  service.addPrinter(baseConfig);
  const document = { elements: [{ type: 'text' as const, content: 'x', x: 0, y: 0 }] };
  await service.print(baseConfig.id, document);
  expect(escposDriver.print).toHaveBeenCalledWith(baseConfig.id, document);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PrinterService.test.ts`
Expected: FAIL — `service.print` is not a function.

- [ ] **Step 3: Implement `print()`**

In `src/features/printer/services/PrinterService.ts`, mirroring `testPrint`:

```ts
const print = async (printerId: string, document: PrintDocument): Promise<void> => {
  const config = findOrThrow(printerId);
  await getDriver(config.protocol).print(printerId, document);
};
```

Add `import type { PrintDocument } from '../types/printDocument.types';` and
add `print` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrinterService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/services/PrinterService.ts src/features/printer/services/PrinterService.test.ts
git commit -m "feat: add PrinterService.print(), the only driver-print entry point"
```

---

### Task 6: `PrintDestination` type + `DestinationService` + `destinationSlice`

**Files:**
- Create: `src/features/printer/types/destination.types.ts`
- Create: `src/features/printer/services/DestinationService.ts`
- Create: `src/features/printer/services/DestinationService.test.ts`
- Create: `src/features/printer/store/destinationSlice.ts`
- Create: `src/features/printer/store/destinationSlice.test.ts`

**Interfaces:**
- Produces: `PrintDestination { id, name, printerIds: string[], fanoutMode: 'failover' | 'broadcast', enabled: boolean }`; `DestinationService.{getDestinations, addDestination, updateDestination, removeDestination}`; `destinationSlice` actions `destinationsLoaded`/`destinationUpserted`/`destinationRemoved` + `selectDestinations`.

- [ ] **Step 1: Create the type**

Create `src/features/printer/types/destination.types.ts`:

```ts
export type PrintFanoutMode = 'failover' | 'broadcast';

export interface PrintDestination {
  id: string;
  name: string;
  printerIds: string[];
  fanoutMode: PrintFanoutMode;
  enabled: boolean;
}
```

- [ ] **Step 2: Write the failing `DestinationService` test**

Create `src/features/printer/services/DestinationService.test.ts`:

```ts
import { createDestinationService } from './DestinationService';
import { StorageService } from '../../../services/StorageService';
import type { PrintDestination } from '../types/destination.types';

const dest: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1', 'p2'], fanoutMode: 'failover', enabled: true };

describe('DestinationService', () => {
  beforeEach(() => StorageService.removeItem('printDestination.list'));

  it('addDestination() persists and getDestinations() returns it back', () => {
    const service = createDestinationService();
    service.addDestination(dest);
    expect(service.getDestinations()).toEqual([dest]);
  });

  it('updateDestination() replaces by id', () => {
    const service = createDestinationService();
    service.addDestination(dest);
    const renamed = { ...dest, name: 'Bar 2' };
    service.updateDestination(renamed);
    expect(service.getDestinations()).toEqual([renamed]);
  });

  it('removeDestination() removes by id', () => {
    const service = createDestinationService();
    service.addDestination(dest);
    service.removeDestination(dest.id);
    expect(service.getDestinations()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- DestinationService.test.ts`
Expected: FAIL — module `./DestinationService` does not exist.

- [ ] **Step 4: Implement `DestinationService`**

Create `src/features/printer/services/DestinationService.ts`, mirroring
`PrinterService`'s storage-CRUD shape:

```ts
import { StorageService } from '../../../services/StorageService';
import type { PrintDestination } from '../types/destination.types';

const DESTINATION_LIST_KEY = 'printDestination.list';

export const createDestinationService = () => {
  const getDestinations = (): PrintDestination[] =>
    StorageService.getItem<PrintDestination[]>(DESTINATION_LIST_KEY) ?? [];

  const saveDestinations = (destinations: PrintDestination[]): void => {
    StorageService.setItem(DESTINATION_LIST_KEY, destinations);
  };

  const addDestination = (destination: PrintDestination): void => {
    saveDestinations([...getDestinations(), destination]);
  };

  const updateDestination = (destination: PrintDestination): void => {
    saveDestinations(getDestinations().map((d) => (d.id === destination.id ? destination : d)));
  };

  const removeDestination = (destinationId: string): void => {
    saveDestinations(getDestinations().filter((d) => d.id !== destinationId));
  };

  return { getDestinations, addDestination, updateDestination, removeDestination };
};

export const DestinationService = createDestinationService();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- DestinationService.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing `destinationSlice` test**

Create `src/features/printer/store/destinationSlice.test.ts`:

```ts
import destinationReducer, {
  destinationsLoaded,
  destinationUpserted,
  destinationRemoved,
  selectDestinations,
} from './destinationSlice';
import type { PrintDestination } from '../types/destination.types';

const dest: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1'], fanoutMode: 'broadcast', enabled: true };

describe('destinationSlice', () => {
  it('destinationsLoaded replaces the list', () => {
    const state = destinationReducer(undefined, destinationsLoaded([dest]));
    expect(selectDestinations({ destination: state })).toEqual([dest]);
  });

  it('destinationUpserted adds a new one, updates an existing one', () => {
    let state = destinationReducer(undefined, destinationUpserted(dest));
    expect(selectDestinations({ destination: state })).toHaveLength(1);
    const renamed = { ...dest, name: 'Bar 2' };
    state = destinationReducer(state, destinationUpserted(renamed));
    expect(selectDestinations({ destination: state })).toEqual([renamed]);
  });

  it('destinationRemoved removes by id', () => {
    let state = destinationReducer(undefined, destinationUpserted(dest));
    state = destinationReducer(state, destinationRemoved(dest.id));
    expect(selectDestinations({ destination: state })).toEqual([]);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- destinationSlice.test.ts`
Expected: FAIL — module `./destinationSlice` does not exist.

- [ ] **Step 8: Implement `destinationSlice`**

Create `src/features/printer/store/destinationSlice.ts`, mirroring
`printerSlice.ts`:

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PrintDestination } from '../types/destination.types';

interface DestinationState {
  destinations: PrintDestination[];
}

const initialState: DestinationState = { destinations: [] };

const destinationSlice = createSlice({
  name: 'destination',
  initialState,
  reducers: {
    destinationsLoaded(state, action: PayloadAction<PrintDestination[]>) {
      state.destinations = action.payload;
    },
    destinationUpserted(state, action: PayloadAction<PrintDestination>) {
      const index = state.destinations.findIndex((d) => d.id === action.payload.id);
      if (index === -1) state.destinations.push(action.payload);
      else state.destinations[index] = action.payload;
    },
    destinationRemoved(state, action: PayloadAction<string>) {
      state.destinations = state.destinations.filter((d) => d.id !== action.payload);
    },
  },
});

export const { destinationsLoaded, destinationUpserted, destinationRemoved } = destinationSlice.actions;

interface StateWithDestination {
  destination: DestinationState;
}

export const selectDestinations = (state: StateWithDestination): PrintDestination[] => state.destination.destinations;

export default destinationSlice.reducer;
```

Register the reducer in the root store (find where `printerSlice` is
combined — likely `src/store/store.ts` — and add `destination:
destinationReducer` alongside it).

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- destinationSlice.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/features/printer/types/destination.types.ts src/features/printer/services/DestinationService.ts src/features/printer/services/DestinationService.test.ts src/features/printer/store/destinationSlice.ts src/features/printer/store/destinationSlice.test.ts src/store/store.ts
git commit -m "feat: add PrintDestination type, DestinationService, destinationSlice"
```

---

### Task 7: `PrintRule` types + `PrintRuleService` + `printRuleSlice`

**Files:**
- Create: `src/features/printer/types/printRule.types.ts`
- Create: `src/features/printer/services/PrintRuleService.ts`
- Create: `src/features/printer/services/PrintRuleService.test.ts`
- Create: `src/features/printer/store/printRuleSlice.ts`
- Create: `src/features/printer/store/printRuleSlice.test.ts`

**Interfaces:**
- Produces: `PrintCondition` (discriminated union), `PrintRule`, `PrintRoutingConfiguration`; `PrintRuleService.{getRoutingConfiguration, saveRoutingConfiguration}`; `printRuleSlice` action `routingConfigurationLoaded` + `selectRules`/`selectDefaultDestinationId`.

- [ ] **Step 1: Create the types**

Create `src/features/printer/types/printRule.types.ts`:

```ts
import type { ServiceType } from '../../cart/types/cart.types';

export type PrintCondition =
  | { field: 'categoryId'; value: number }
  | { field: 'serviceType'; value: ServiceType };

export interface PrintRule {
  id: string;
  conditions: PrintCondition[];
  destinationId: string;
  priority: number;
  enabled: boolean;
}

export interface PrintRoutingConfiguration {
  rules: PrintRule[];
  defaultDestinationId?: string;
}
```

- [ ] **Step 2: Write the failing `PrintRuleService` test**

Create `src/features/printer/services/PrintRuleService.test.ts`:

```ts
import { createPrintRuleService } from './PrintRuleService';
import { StorageService } from '../../../services/StorageService';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const config: PrintRoutingConfiguration = {
  rules: [
    { id: 'r1', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'd1', priority: 100, enabled: true },
  ],
  defaultDestinationId: 'd0',
};

describe('PrintRuleService', () => {
  beforeEach(() => StorageService.removeItem('printRule.routingConfiguration'));

  it('returns an empty configuration when nothing is stored', () => {
    const service = createPrintRuleService();
    expect(service.getRoutingConfiguration()).toEqual({ rules: [] });
  });

  it('saveRoutingConfiguration() persists and getRoutingConfiguration() returns it back', () => {
    const service = createPrintRuleService();
    service.saveRoutingConfiguration(config);
    expect(service.getRoutingConfiguration()).toEqual(config);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- PrintRuleService.test.ts`
Expected: FAIL — module `./PrintRuleService` does not exist.

- [ ] **Step 4: Implement `PrintRuleService`**

Create `src/features/printer/services/PrintRuleService.ts`:

```ts
import { StorageService } from '../../../services/StorageService';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const ROUTING_CONFIGURATION_KEY = 'printRule.routingConfiguration';

export const createPrintRuleService = () => {
  const getRoutingConfiguration = (): PrintRoutingConfiguration =>
    StorageService.getItem<PrintRoutingConfiguration>(ROUTING_CONFIGURATION_KEY) ?? { rules: [] };

  const saveRoutingConfiguration = (configuration: PrintRoutingConfiguration): void => {
    StorageService.setItem(ROUTING_CONFIGURATION_KEY, configuration);
  };

  return { getRoutingConfiguration, saveRoutingConfiguration };
};

export const PrintRuleService = createPrintRuleService();
```

(`PrintRoutingConfiguration` is stored as one JSON object, not a bare list —
unlike `PrinterConfig`/`PrintDestination`, `rules` and `defaultDestinationId`
are edited together on the same routing screen, so one read-modify-write key
avoids splitting one form's save into two storage calls.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- PrintRuleService.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing `printRuleSlice` test**

Create `src/features/printer/store/printRuleSlice.test.ts`:

```ts
import printRuleReducer, {
  routingConfigurationLoaded,
  selectRules,
  selectDefaultDestinationId,
} from './printRuleSlice';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const config: PrintRoutingConfiguration = {
  rules: [{ id: 'r1', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'd1', priority: 100, enabled: true }],
  defaultDestinationId: 'd0',
};

describe('printRuleSlice', () => {
  it('routingConfigurationLoaded replaces rules and defaultDestinationId', () => {
    const state = printRuleReducer(undefined, routingConfigurationLoaded(config));
    expect(selectRules({ printRule: state })).toEqual(config.rules);
    expect(selectDefaultDestinationId({ printRule: state })).toBe('d0');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- printRuleSlice.test.ts`
Expected: FAIL — module `./printRuleSlice` does not exist.

- [ ] **Step 8: Implement `printRuleSlice`**

Create `src/features/printer/store/printRuleSlice.ts`:

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const initialState: PrintRoutingConfiguration = { rules: [] };

const printRuleSlice = createSlice({
  name: 'printRule',
  initialState,
  reducers: {
    routingConfigurationLoaded(_state, action: PayloadAction<PrintRoutingConfiguration>) {
      return action.payload;
    },
  },
});

export const { routingConfigurationLoaded } = printRuleSlice.actions;

interface StateWithPrintRule {
  printRule: PrintRoutingConfiguration;
}

export const selectRules = (state: StateWithPrintRule) => state.printRule.rules;
export const selectDefaultDestinationId = (state: StateWithPrintRule) => state.printRule.defaultDestinationId;

export default printRuleSlice.reducer;
```

Register `printRule: printRuleReducer` in the root store next to
`destination`.

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- printRuleSlice.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/features/printer/types/printRule.types.ts src/features/printer/services/PrintRuleService.ts src/features/printer/services/PrintRuleService.test.ts src/features/printer/store/printRuleSlice.ts src/features/printer/store/printRuleSlice.test.ts src/store/store.ts
git commit -m "feat: add PrintRule types, PrintRuleService, printRuleSlice"
```

---

### Task 8: `evaluatePrintRules`

**Files:**
- Create: `src/features/printer/services/evaluatePrintRules.ts`
- Create: `src/features/printer/services/evaluatePrintRules.test.ts`

**Interfaces:**
- Consumes: `PrintRoutingConfiguration`/`PrintRule`/`PrintCondition` (Task 7).
- Produces: `evaluatePrintRules(subject: {categoryId: number | null; serviceType: ServiceType}, routing: PrintRoutingConfiguration): string | null`.

- [ ] **Step 1: Write the failing test**

Create `src/features/printer/services/evaluatePrintRules.test.ts`:

```ts
import { evaluatePrintRules } from './evaluatePrintRules';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

describe('evaluatePrintRules', () => {
  it('matches a rule whose single condition matches the subject', () => {
    const routing: PrintRoutingConfiguration = {
      rules: [{ id: 'r1', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'bar', priority: 100, enabled: true }],
    };
    expect(evaluatePrintRules({ categoryId: 1, serviceType: 'DineIn' }, routing)).toBe('bar');
  });

  it('requires all conditions in a rule to match (AND)', () => {
    const routing: PrintRoutingConfiguration = {
      rules: [{
        id: 'r1',
        conditions: [{ field: 'categoryId', value: 1 }, { field: 'serviceType', value: 'DineIn' }],
        destinationId: 'bar',
        priority: 100,
        enabled: true,
      }],
    };
    expect(evaluatePrintRules({ categoryId: 1, serviceType: 'TakeAway' }, routing)).toBeNull();
  });

  it('evaluates rules in priority order, higher first', () => {
    const routing: PrintRoutingConfiguration = {
      rules: [
        { id: 'low', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'kitchen', priority: 10, enabled: true },
        { id: 'high', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'bar', priority: 100, enabled: true },
      ],
    };
    expect(evaluatePrintRules({ categoryId: 1, serviceType: 'DineIn' }, routing)).toBe('bar');
  });

  it('skips disabled rules', () => {
    const routing: PrintRoutingConfiguration = {
      rules: [{ id: 'r1', conditions: [{ field: 'categoryId', value: 1 }], destinationId: 'bar', priority: 100, enabled: false }],
      defaultDestinationId: 'fallback',
    };
    expect(evaluatePrintRules({ categoryId: 1, serviceType: 'DineIn' }, routing)).toBe('fallback');
  });

  it('falls through to defaultDestinationId when nothing matches', () => {
    const routing: PrintRoutingConfiguration = { rules: [], defaultDestinationId: 'fallback' };
    expect(evaluatePrintRules({ categoryId: 99, serviceType: 'DineIn' }, routing)).toBe('fallback');
  });

  it('returns null when nothing matches and there is no default', () => {
    const routing: PrintRoutingConfiguration = { rules: [] };
    expect(evaluatePrintRules({ categoryId: 99, serviceType: 'DineIn' }, routing)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- evaluatePrintRules.test.ts`
Expected: FAIL — module `./evaluatePrintRules` does not exist.

- [ ] **Step 3: Implement `evaluatePrintRules`**

Create `src/features/printer/services/evaluatePrintRules.ts`:

```ts
import type { ServiceType } from '../../cart/types/cart.types';
import type { PrintCondition, PrintRoutingConfiguration } from '../types/printRule.types';

interface RuleSubject {
  categoryId: number | null;
  serviceType: ServiceType;
}

const conditionMatches = (condition: PrintCondition, subject: RuleSubject): boolean => {
  if (condition.field === 'categoryId') return subject.categoryId === condition.value;
  return subject.serviceType === condition.value;
};

export const evaluatePrintRules = (subject: RuleSubject, routing: PrintRoutingConfiguration): string | null => {
  const sortedRules = [...routing.rules]
    .filter((rule) => rule.enabled)
    .sort((a, b) => b.priority - a.priority);

  const matched = sortedRules.find((rule) => rule.conditions.every((condition) => conditionMatches(condition, subject)));
  if (matched) return matched.destinationId;

  return routing.defaultDestinationId ?? null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- evaluatePrintRules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/services/evaluatePrintRules.ts src/features/printer/services/evaluatePrintRules.test.ts
git commit -m "feat: add evaluatePrintRules"
```

---

### Task 9: `PrintScheduler`

**Files:**
- Create: `src/features/printer/services/PrintScheduler.ts`
- Create: `src/features/printer/services/PrintScheduler.test.ts`

**Interfaces:**
- Consumes: `PrinterService.print()` (Task 5), `PrintJob` (Task 2).
- Produces: `PrintScheduler.{enqueue(job: PrintJob): Promise<PrintJob>, retry(job: PrintJob): Promise<PrintJob>}`.

- [ ] **Step 1: Write the failing test**

Create `src/features/printer/services/PrintScheduler.test.ts`:

```ts
import { createPrintScheduler } from './PrintScheduler';
import { AppErrorException } from '../../../types/AppError';
import type { PrintJob } from '../types/printJob.types';

const makeJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  id: 'job1',
  planId: 'plan1',
  printerId: 'p1',
  document: { elements: [] },
  status: 'pending',
  retryCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('PrintScheduler', () => {
  it('enqueue() resolves with status success when PrinterService.print resolves', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined) };
    const scheduler = createPrintScheduler(printerService);
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe('success');
    expect(result.completedAt).toBeDefined();
  });

  it('enqueue() resolves with status failed and an AppError when PrinterService.print rejects', async () => {
    const printerService = {
      print: jest.fn().mockRejectedValue(new AppErrorException({ code: 'PRINT_ERROR', message: 'hết giấy' })),
    };
    const scheduler = createPrintScheduler(printerService);
    const result = await scheduler.enqueue(makeJob());
    expect(result.status).toBe('failed');
    expect(result.error).toEqual({ code: 'PRINT_ERROR', message: 'hết giấy' });
  });

  it('never runs two jobs for the same printerId concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const printerService = {
      print: jest.fn().mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      }),
    };
    const scheduler = createPrintScheduler(printerService);
    await Promise.all([
      scheduler.enqueue(makeJob({ id: 'a' })),
      scheduler.enqueue(makeJob({ id: 'b' })),
      scheduler.enqueue(makeJob({ id: 'c' })),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('retry() increments retryCount and re-enqueues the same job id', async () => {
    const printerService = { print: jest.fn().mockResolvedValue(undefined) };
    const scheduler = createPrintScheduler(printerService);
    const failed = makeJob({ status: 'failed', retryCount: 0 });
    const result = await scheduler.retry(failed);
    expect(result.id).toBe(failed.id);
    expect(result.retryCount).toBe(1);
    expect(result.status).toBe('success');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PrintScheduler.test.ts`
Expected: FAIL — module `./PrintScheduler` does not exist.

- [ ] **Step 3: Implement `PrintScheduler`**

Create `src/features/printer/services/PrintScheduler.ts`:

```ts
import { AppErrorException, type AppError } from '../../../types/AppError';
import { PrinterService } from './PrinterService';
import type { PrintJob } from '../types/printJob.types';

interface QueueEntry {
  job: PrintJob;
  resolve: (job: PrintJob) => void;
}

type PrinterServiceLike = Pick<typeof PrinterService, 'print'>;

export const createPrintScheduler = (printerService: PrinterServiceLike) => {
  const queues = new Map<string, QueueEntry[]>();
  const processing = new Set<string>();

  const toAppError = (error: unknown): AppError =>
    error instanceof AppErrorException
      ? { code: error.code, message: error.message }
      : { code: 'PRINT_ERROR', message: String(error) };

  const processQueue = async (printerId: string): Promise<void> => {
    if (processing.has(printerId)) return;
    processing.add(printerId);
    try {
      const queue = queues.get(printerId);
      while (queue && queue.length > 0) {
        const entry = queue[0];
        const { job } = entry;
        job.status = 'printing';
        job.startedAt = new Date().toISOString();
        try {
          await printerService.print(job.printerId, job.document);
          job.status = 'success';
        } catch (error) {
          job.status = 'failed';
          job.error = toAppError(error);
        }
        job.completedAt = new Date().toISOString();
        queue.shift();
        entry.resolve(job);
      }
    } finally {
      processing.delete(printerId);
    }
  };

  const enqueue = (job: PrintJob): Promise<PrintJob> =>
    new Promise<PrintJob>((resolve) => {
      if (!queues.has(job.printerId)) queues.set(job.printerId, []);
      queues.get(job.printerId)?.push({ job, resolve });
      void processQueue(job.printerId);
    });

  const retry = (job: PrintJob): Promise<PrintJob> => {
    job.retryCount += 1;
    job.status = 'pending';
    job.error = undefined;
    return enqueue(job);
  };

  return { enqueue, retry };
};

export const PrintScheduler = createPrintScheduler(PrinterService);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrintScheduler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/services/PrintScheduler.ts src/features/printer/services/PrintScheduler.test.ts
git commit -m "feat: add PrintScheduler with per-printer serialized job queue"
```

---

### Task 10: `PrintService`

**Files:**
- Modify: `src/types/AppError.ts`
- Create: `src/features/printer/services/PrintService.ts`
- Create: `src/features/printer/services/PrintService.test.ts`

**Interfaces:**
- Consumes: `PrintScheduler.enqueue()` (Task 9), `PrintDestination` (Task 6), `Printer.enabled` (Task 1), `PrintPlan`/`PrintResult` (Task 2).
- Produces: `PrintService.print(plan: PrintPlan): Promise<PrintResult>`; `AppErrorCode` gains `'NO_AVAILABLE_PRINTER'`.

- [ ] **Step 1: Add `NO_AVAILABLE_PRINTER` to `AppErrorCode`**

In `src/types/AppError.ts`:

```ts
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONNECTION_ERROR'
  | 'UNSUPPORTED_CONNECTION'
  | 'PRINT_ERROR'
  | 'ENCODING_FAILED'
  | 'NO_AVAILABLE_PRINTER'
  | 'UNKNOWN_ERROR';
```

- [ ] **Step 2: Write the failing test**

Create `src/features/printer/services/PrintService.test.ts`:

```ts
import { createPrintService } from './PrintService';
import type { PrintDestination } from '../types/destination.types';
import type { PrinterConfig } from '../types/printer.types';
import type { PrintJob } from '../types/printJob.types';

const plan = { id: 'plan1', destinationId: 'd1', document: { elements: [] }, copies: 1 };

const printer = (id: string, enabled = true): PrinterConfig => ({
  id, printerName: id, protocol: 'escpos', protocolSource: 'auto', connectionType: 'lan',
  paperSize: '80mm', autoReconnect: false, isDefault: false, enabled,
});

const makeDeps = (destination: PrintDestination, printers: PrinterConfig[], scheduleResult: (printerId: string) => PrintJob) => ({
  getDestinations: jest.fn().mockReturnValue([destination]),
  getPrinters: jest.fn().mockReturnValue(printers),
  scheduler: { enqueue: jest.fn().mockImplementation((job: PrintJob) => Promise.resolve(scheduleResult(job.printerId))) },
});

describe('PrintService', () => {
  it('returns no-available-printer with no jobs when the effective printer list is empty', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: [], fanoutMode: 'failover', enabled: true };
    const deps = makeDeps(destination, [], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result).toEqual({ status: 'no-available-printer', jobs: [] });
    expect(deps.scheduler.enqueue).not.toHaveBeenCalled();
  });

  it('excludes disabled printers and a disabled destination\'s printers from the effective list', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1'], fanoutMode: 'failover', enabled: true };
    const deps = makeDeps(destination, [printer('p1', false)], () => { throw new Error('should not be called'); });
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('no-available-printer');
  });

  it('failover: stops at the first successful printer', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1', 'p2'], fanoutMode: 'failover', enabled: true };
    const deps = makeDeps(destination, [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', planId: plan.id, printerId, document: plan.document, status: 'success', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('success');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(1);
  });

  it('failover: tries every printer and reports failed (not no-available-printer) when all fail', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1', 'p2'], fanoutMode: 'failover', enabled: true };
    const deps = makeDeps(destination, [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', planId: plan.id, printerId, document: plan.document, status: 'failed', retryCount: 0, createdAt: 'now',
      error: { code: 'PRINT_ERROR', message: 'x' },
    }));
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('failed');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(2);
  });

  it('broadcast: sends to every effective printer and reports partial-failure on mixed results', async () => {
    const destination: PrintDestination = { id: 'd1', name: 'Bar', printerIds: ['p1', 'p2'], fanoutMode: 'broadcast', enabled: true };
    const deps = makeDeps(destination, [printer('p1'), printer('p2')], (printerId) => ({
      id: 'job1', planId: plan.id, printerId, document: plan.document,
      status: printerId === 'p1' ? 'success' : 'failed', retryCount: 0, createdAt: 'now',
    }));
    const service = createPrintService(deps);
    const result = await service.print(plan);
    expect(result.status).toBe('partial-failure');
    expect(deps.scheduler.enqueue).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- PrintService.test.ts`
Expected: FAIL — module `./PrintService` does not exist.

- [ ] **Step 4: Implement `PrintService`**

Create `src/features/printer/services/PrintService.ts`:

```ts
import { DestinationService } from './DestinationService';
import { PrinterService } from './PrinterService';
import { PrintScheduler } from './PrintScheduler';
import { generateId } from '../../../utils/id';
import type { PrintPlan, PrintJob, PrintResult } from '../types/printJob.types';

interface PrintServiceDeps {
  getDestinations: typeof DestinationService.getDestinations;
  getPrinters: typeof PrinterService.getPrinters;
  scheduler: Pick<typeof PrintScheduler, 'enqueue'>;
}

export const createPrintService = (deps: PrintServiceDeps) => {
  const effectivePrinterIds = (destinationId: string): string[] => {
    const destination = deps.getDestinations().find((d) => d.id === destinationId);
    if (!destination || !destination.enabled) return [];
    const enabledPrinterIds = new Set(deps.getPrinters().filter((p) => p.enabled).map((p) => p.id));
    return destination.printerIds.filter((id) => enabledPrinterIds.has(id));
  };

  const makeJob = (plan: PrintPlan, printerId: string): PrintJob => ({
    id: generateId(),
    planId: plan.id,
    printerId,
    document: plan.document,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });

  const print = async (plan: PrintPlan): Promise<PrintResult> => {
    const destination = deps.getDestinations().find((d) => d.id === plan.destinationId);
    const printerIds = effectivePrinterIds(plan.destinationId);
    if (printerIds.length === 0) return { status: 'no-available-printer', jobs: [] };

    if (destination?.fanoutMode === 'broadcast') {
      const jobs = await Promise.all(printerIds.map((printerId) => deps.scheduler.enqueue(makeJob(plan, printerId))));
      const successCount = jobs.filter((job) => job.status === 'success').length;
      const status = successCount === jobs.length ? 'success' : successCount === 0 ? 'failed' : 'partial-failure';
      return { status, jobs };
    }

    const jobs: PrintJob[] = [];
    for (const printerId of printerIds) {
      const job = await deps.scheduler.enqueue(makeJob(plan, printerId));
      jobs.push(job);
      if (job.status === 'success') return { status: 'success', jobs };
    }
    return { status: 'failed', jobs };
  };

  return { print };
};

export const PrintService = createPrintService({
  getDestinations: DestinationService.getDestinations,
  getPrinters: PrinterService.getPrinters,
  scheduler: PrintScheduler,
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- PrintService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/AppError.ts src/features/printer/services/PrintService.ts src/features/printer/services/PrintService.test.ts
git commit -m "feat: add PrintService — destination resolution, failover/broadcast fanout"
```

---

### Task 11: `Order`/`OrderItem` types + `OrderPrintPlanner`

**Files:**
- Create: `src/features/printer/types/order.types.ts`
- Create: `src/features/printer/services/OrderPrintPlanner.ts`
- Create: `src/features/printer/services/OrderPrintPlanner.test.ts`

**Interfaces:**
- Consumes: `evaluatePrintRules` (Task 8), `PrintRuleService` (Task 7), `PrintPlan`/`PrintDocument` (Task 2).
- Produces: `Order`, `OrderItem`; `OrderPrintPlanner.createPlans(order: Order): Promise<{plans: PrintPlan[]; unrouted: OrderItem[]}>`.

- [ ] **Step 1: Create the types**

Create `src/features/printer/types/order.types.ts`:

```ts
import type { ServiceType } from '../../cart/types/cart.types';

export interface OrderItem {
  productId: number;
  productName: string;
  categoryId: number | null;
  quantity: number;
  note: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  serviceType: ServiceType;
  items: OrderItem[];
}
```

- [ ] **Step 2: Write the failing test**

Create `src/features/printer/services/OrderPrintPlanner.test.ts`:

```ts
import { createOrderPrintPlanner } from './OrderPrintPlanner';
import type { Order } from '../types/order.types';
import type { PrintRoutingConfiguration } from '../types/printRule.types';

const order: Order = {
  id: 1,
  orderNumber: 'ORD-001',
  serviceType: 'DineIn',
  items: [
    { productId: 1, productName: 'Trà sữa', categoryId: 10, quantity: 2, note: 'ít đường' },
    { productId: 2, productName: 'Burger', categoryId: 20, quantity: 1, note: '' },
    { productId: 3, productName: 'Bánh', categoryId: 30, quantity: 1, note: '' },
  ],
};

const routing: PrintRoutingConfiguration = {
  rules: [
    { id: 'r1', conditions: [{ field: 'categoryId', value: 10 }], destinationId: 'bar', priority: 100, enabled: true },
    { id: 'r2', conditions: [{ field: 'categoryId', value: 20 }], destinationId: 'kitchen', priority: 100, enabled: true },
  ],
};

describe('OrderPrintPlanner', () => {
  it('groups items by resolved destination into one plan each', async () => {
    const planner = createOrderPrintPlanner({ getRoutingConfiguration: () => routing });
    const { plans, unrouted } = await planner.createPlans(order);
    expect(plans).toHaveLength(2);
    expect(unrouted).toEqual([order.items[2]]);
    const barPlan = plans.find((p) => p.destinationId === 'bar');
    expect(barPlan?.document.elements.some((el) => el.type === 'table')).toBe(true);
  });

  it('returns empty plans, all items unrouted, when nothing matches and there is no default', async () => {
    const planner = createOrderPrintPlanner({ getRoutingConfiguration: () => ({ rules: [] }) });
    const { plans, unrouted } = await planner.createPlans(order);
    expect(plans).toEqual([]);
    expect(unrouted).toEqual(order.items);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- OrderPrintPlanner.test.ts`
Expected: FAIL — module `./OrderPrintPlanner` does not exist.

- [ ] **Step 4: Implement `OrderPrintPlanner`**

Create `src/features/printer/services/OrderPrintPlanner.ts`:

```ts
import { PrintRuleService } from './PrintRuleService';
import { evaluatePrintRules } from './evaluatePrintRules';
import { generateId } from '../../../utils/id';
import type { Order, OrderItem } from '../types/order.types';
import type { PrintPlan } from '../types/printJob.types';
import type { PrintDocument, PrintElement } from '../types/printDocument.types';

interface OrderPrintPlannerDeps {
  getRoutingConfiguration: typeof PrintRuleService.getRoutingConfiguration;
}

const buildDocument = (order: Order, items: OrderItem[]): PrintDocument => {
  const elements: PrintElement[] = [
    { type: 'text', content: `Đơn ${order.orderNumber} · ${order.serviceType}`, x: 0, y: 0 },
    { type: 'line', x: 0, y: 20 },
    {
      type: 'table',
      rows: items.map((item) => [item.productName, String(item.quantity), item.note]),
      x: 0,
      y: 30,
    },
  ];
  return { elements };
};

export const createOrderPrintPlanner = (deps: OrderPrintPlannerDeps) => {
  const createPlans = async (order: Order): Promise<{ plans: PrintPlan[]; unrouted: OrderItem[] }> => {
    const routing = deps.getRoutingConfiguration();
    const itemsByDestination = new Map<string, OrderItem[]>();
    const unrouted: OrderItem[] = [];

    for (const item of order.items) {
      const destinationId = evaluatePrintRules({ categoryId: item.categoryId, serviceType: order.serviceType }, routing);
      if (destinationId === null) {
        unrouted.push(item);
        continue;
      }
      if (!itemsByDestination.has(destinationId)) itemsByDestination.set(destinationId, []);
      itemsByDestination.get(destinationId)?.push(item);
    }

    const plans: PrintPlan[] = Array.from(itemsByDestination.entries()).map(([destinationId, items]) => ({
      id: generateId(),
      destinationId,
      document: buildDocument(order, items),
      copies: 1,
    }));

    return { plans, unrouted };
  };

  return { createPlans };
};

export const OrderPrintPlanner = createOrderPrintPlanner({ getRoutingConfiguration: PrintRuleService.getRoutingConfiguration });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- OrderPrintPlanner.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/types/order.types.ts src/features/printer/services/OrderPrintPlanner.ts src/features/printer/services/OrderPrintPlanner.test.ts
git commit -m "feat: add OrderPrintPlanner — group order items by resolved destination"
```

---

### Task 12: Wire printing into `useCheckout.ts`

**Files:**
- Modify: `src/features/cart/hooks/useCheckout.ts`
- Create: `src/features/cart/hooks/useCheckout.test.ts`

**Interfaces:**
- Consumes: `OrderPrintPlanner.createPlans()` (Task 11), `PrintService.print()` (Task 10), `selectProducts` (existing, `src/features/catalog/store/catalogSlice.ts`).
- Produces: `useCheckout()`'s `unroutedCount: number` return field (drives the Snackbar the spec commits to — the Snackbar component itself is out of this task's scope per the spec's "Out of scope" list; this task only exposes the count `CartPanel.tsx` will read in a later, unplanned task).

- [ ] **Step 1: Write the failing test**

Create `src/features/cart/hooks/useCheckout.test.ts`. Check how this repo
tests other hooks with Redux + mocked services first (e.g.
`src/features/settings/hooks/useSettings.test.ts`) and match that
`renderHook`/store-wrapping setup exactly rather than inventing a new one.
The behavior to assert:

```ts
// Illustrative — adapt the render/store setup to match useSettings.test.ts's pattern.
import { OrderPrintPlanner } from '../../printer/services/OrderPrintPlanner';
import { PrintService } from '../../printer/services/PrintService';

jest.mock('../../printer/services/OrderPrintPlanner');
jest.mock('../../printer/services/PrintService');

it('submit() still resolves successfully even when PrintService.print() rejects', async () => {
  (OrderPrintPlanner.createPlans as jest.Mock).mockResolvedValue({
    plans: [{ id: 'plan1', destinationId: 'd1', document: { elements: [] }, copies: 1 }],
    unrouted: [],
  });
  (PrintService.print as jest.Mock).mockRejectedValue(new Error('máy in mất kết nối'));
  // ... render useCheckout() with a cart containing one item, call submit() ...
  // assert the resolved CreateOrderResponse is returned (not null/thrown),
  // and that PrintService.print was called once.
});

it('submit() calls PrintService.print() once per plan produced by OrderPrintPlanner', async () => {
  (OrderPrintPlanner.createPlans as jest.Mock).mockResolvedValue({
    plans: [
      { id: 'plan1', destinationId: 'bar', document: { elements: [] }, copies: 1 },
      { id: 'plan2', destinationId: 'kitchen', document: { elements: [] }, copies: 1 },
    ],
    unrouted: [],
  });
  (PrintService.print as jest.Mock).mockResolvedValue({ status: 'success', jobs: [] });
  // ... call submit(), assert PrintService.print called twice, once per plan ...
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useCheckout.test.ts`
Expected: FAIL — `OrderPrintPlanner.createPlans`/`PrintService.print` not
called (the hook doesn't call them yet).

- [ ] **Step 3: Implement the checkout integration**

In `src/features/cart/hooks/useCheckout.ts`:

```ts
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { selectCurrentStoreId } from '../../store/store/storeSlice';
import { selectProducts } from '../../catalog/store/catalogSlice';
import { CartService } from '../services/CartService';
import { orderApi } from '../api/orderApi';
import { cartCleared, selectCartItems, selectCartNote, selectServiceType } from '../store/cartSlice';
import { OrderPrintPlanner } from '../../printer/services/OrderPrintPlanner';
import { PrintService } from '../../printer/services/PrintService';
import { PrinterLogger } from '../../printer/services/PrinterLogger';
import type { CreateOrderResponse } from '../types/cart.types';
import type { Order } from '../../printer/types/order.types';

export const useCheckout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));
  const items = useSelector((state: RootState) => selectCartItems(state));
  const serviceType = useSelector((state: RootState) => selectServiceType(state));
  const note = useSelector((state: RootState) => selectCartNote(state));
  const products = useSelector((state: RootState) => selectProducts(state));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unroutedCount, setUnroutedCount] = useState(0);

  const triggerPrinting = useCallback(
    (orderResponse: CreateOrderResponse): void => {
      const order: Order = {
        id: orderResponse.Id,
        orderNumber: orderResponse.OrderNumber,
        serviceType,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          categoryId: products.find((p) => p.id === item.productId)?.categoryId ?? null,
          quantity: item.quantity,
          note: item.note,
        })),
      };
      OrderPrintPlanner.createPlans(order)
        .then(({ plans, unrouted }) => {
          if (unrouted.length > 0) {
            setUnroutedCount(unrouted.length);
            PrinterLogger.warn(`Đơn ${order.orderNumber}: ${unrouted.length} món chưa có cấu hình in`);
          }
          return Promise.all(plans.map((plan) => PrintService.print(plan)));
        })
        .catch((err: unknown) => {
          PrinterLogger.warn(`Đơn ${order.orderNumber}: in thất bại — ${String(err)}`);
        });
    },
    [items, serviceType, products],
  );

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
      triggerPrinting(response.Data);
      return response.Data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo đơn hàng');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, storeId, items, serviceType, note, triggerPrinting]);

  const dismissError = useCallback(() => setError(null), []);
  const dismissUnroutedCount = useCallback(() => setUnroutedCount(0), []);

  return { submit, isSubmitting, error, dismissError, unroutedCount, dismissUnroutedCount };
};
```

`triggerPrinting` is deliberately **not** `await`ed inside `submit()` — this
is the fire-and-forget contract from spec §6: `submit()`'s `try` block
returns right after `triggerPrinting(response.Data)` is called, before the
planner/printing promise chain resolves.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useCheckout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/cart/hooks/useCheckout.ts src/features/cart/hooks/useCheckout.test.ts
git commit -m "feat: wire OrderPrintPlanner/PrintService into checkout, non-blocking"
```

---

### Task 13: Enable/Disable switch on the printer list

**Files:**
- Modify: `src/features/printer/components/PrinterListItem.tsx`

**Interfaces:**
- Consumes: `PrinterService.setEnabled()` (Task 1), `AppSwitch` (existing, `src/components/AppSwitch.tsx`).

This is a pure presentational component change — per this repo's
convention, it gets no dedicated `.test.ts` (verify via `type-check` + `lint`
+ manual check).

- [ ] **Step 1: Add the switch**

In `src/features/printer/components/PrinterListItem.tsx`, import `AppSwitch`
from `'../../../components/AppSwitch'`, and add inside the `row` `View`
(before or after `PrinterStatusBadge`, matching this file's existing layout
order):

```tsx
<AppSwitch
  label=""
  value={printer.enabled}
  onValueChange={(enabled) => {
    PrinterService.setEnabled(printer.id, enabled);
    onChanged();
  }}
/>
```

Per this repo's "Disable, không Hide" rule: when `printer.enabled` is
`false`, the row itself stays fully visible — do not conditionally hide any
part of it. The `Menu` actions (Connect/Disconnect/Test Print) are **not**
gated by `enabled` in this task; the spec (§1) only commits to disabled
printers being excluded from Destination resolution (Task 10's
`effectivePrinterIds`), not to disabling their manual controls — do not
add a `disabled` prop to the `Menu.Item`s without that being asked for
separately, that would be scope beyond what §1 specifies.

- [ ] **Step 2: Verify with type-check and lint**

Run: `npm run type-check`
Run: `npm run lint`
Expected: both pass with no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/components/PrinterListItem.tsx
git commit -m "feat: add Enable/Disable switch to the printer list"
```

---

### Task 14: `PrintDestinationPanel` + Settings wiring

**Files:**
- Create: `src/features/printer/components/PrintDestinationPanel.tsx`
- Modify: `src/features/settings/store/settingsSlice.ts`
- Modify: `src/features/settings/config/settingsConfig.ts`
- Modify: `src/features/settings/components/SettingsContent.tsx`

**Interfaces:**
- Consumes: `DestinationService` (Task 6), `destinationSlice` (Task 6), `PrinterService.getPrinters()` (existing), `PrintService.print()` (Task 10) for "Test Print".

No dedicated `.test.ts` (pure presentational + form screen, per convention).

- [ ] **Step 1: Register the new settings menu key**

In `src/features/settings/store/settingsSlice.ts`, add `'printDestination'`
to the `SettingsMenuKey` union:

```ts
export type SettingsMenuKey =
  | 'printer'
  | 'printDestination'
  | 'scanner'
  | 'account'
  | 'language'
  | 'sync'
  | 'info';
```

In `src/features/settings/config/settingsConfig.ts`, add an entry to
`settingsMenuItems` (after the `printer` entry, same `group: 'device'`):

```ts
{ key: 'printDestination', icon: 'printer-pos', label: 'Điểm in', group: 'device' },
```

- [ ] **Step 2: Implement `PrintDestinationPanel`**

Create `src/features/printer/components/PrintDestinationPanel.tsx`,
following `PrinterManagementPanel.tsx`'s structure (local `useState` list +
refresh callback, no modal component built yet — this task delivers the
list + a minimal inline add/edit form, not a separate `AddDestinationModal`
file, since the spec doesn't call for one and this repo avoids
building UI ahead of what's asked):

```tsx
// src/features/printer/components/PrintDestinationPanel.tsx
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, RadioButton } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { AppInput } from '../../../components/AppInput';
import { AppSwitch } from '../../../components/AppSwitch';
import { DestinationService } from '../services/DestinationService';
import { PrinterService } from '../services/PrinterService';
import { PrintService } from '../services/PrintService';
import { generateId } from '../../../utils/id';
import type { PrintDestination, PrintFanoutMode } from '../types/destination.types';

export const PrintDestinationPanel: React.FC = () => {
  const [destinations, setDestinations] = useState<PrintDestination[]>(() => DestinationService.getDestinations());
  const printers = PrinterService.getPrinters();
  const [name, setName] = useState('');
  const [selectedPrinterIds, setSelectedPrinterIds] = useState<string[]>([]);
  const [fanoutMode, setFanoutMode] = useState<PrintFanoutMode>('failover');

  const refresh = useCallback(() => setDestinations(DestinationService.getDestinations()), []);

  const togglePrinter = (printerId: string): void => {
    setSelectedPrinterIds((prev) =>
      prev.includes(printerId) ? prev.filter((id) => id !== printerId) : [...prev, printerId],
    );
  };

  const addDestination = (): void => {
    if (name.trim() === '' || selectedPrinterIds.length === 0) return;
    DestinationService.addDestination({
      id: generateId(),
      name: name.trim(),
      printerIds: selectedPrinterIds,
      fanoutMode,
      enabled: true,
    });
    setName('');
    setSelectedPrinterIds([]);
    refresh();
  };

  const toggleEnabled = (destination: PrintDestination, enabled: boolean): void => {
    DestinationService.updateDestination({ ...destination, enabled });
    refresh();
  };

  const testPrint = (destination: PrintDestination): void => {
    void PrintService.print({
      id: generateId(),
      destinationId: destination.id,
      document: { elements: [{ type: 'text', content: 'NDTCore POS - Test Print điểm in', x: 0, y: 0 }] },
      copies: 1,
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Điểm in</Text>

      {destinations.map((destination) => (
        <View key={destination.id} style={styles.row}>
          <Text style={styles.name}>{destination.name}</Text>
          <AppSwitch label="" value={destination.enabled} onValueChange={(enabled) => toggleEnabled(destination, enabled)} />
          <AppButton label="Test Print" onPress={() => testPrint(destination)} />
        </View>
      ))}

      <View style={styles.form}>
        <AppInput label="Tên điểm in" value={name} onChangeText={setName} />
        {printers.map((p) => (
          <AppSwitch
            key={p.id}
            label={p.printerName}
            value={selectedPrinterIds.includes(p.id)}
            onValueChange={() => togglePrinter(p.id)}
          />
        ))}
        <RadioButton.Group onValueChange={(v) => setFanoutMode(v as PrintFanoutMode)} value={fanoutMode}>
          <RadioButton.Item label="Failover" value="failover" />
          <RadioButton.Item label="Broadcast" value="broadcast" />
        </RadioButton.Group>
        <AppButton label="Thêm điểm in" onPress={addDestination} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB' },
  name: { flex: 1, fontSize: 13 },
  form: { gap: 8, marginTop: 16 },
});
```

Check `AppInput`'s actual prop names (`src/components/AppInput.tsx`) before
this step is done — the `label`/`value`/`onChangeText` names above are
inferred from `AppSwitch`'s pattern, not confirmed against that file.

- [ ] **Step 3: Wire into `SettingsContent`**

In `src/features/settings/components/SettingsContent.tsx`:

```tsx
import { PrintDestinationPanel } from '../../printer/components/PrintDestinationPanel';
// ...
{activeSection === 'printDestination' && <PrintDestinationPanel />}
```

- [ ] **Step 4: Verify with type-check and lint**

Run: `npm run type-check`
Run: `npm run lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/components/PrintDestinationPanel.tsx src/features/settings/store/settingsSlice.ts src/features/settings/config/settingsConfig.ts src/features/settings/components/SettingsContent.tsx
git commit -m "feat: add Print Destination panel, wired into Settings"
```

---

### Task 15: `PrintRoutingPanel` + Settings wiring

**Files:**
- Create: `src/features/printer/components/PrintRoutingPanel.tsx`
- Modify: `src/features/settings/store/settingsSlice.ts`
- Modify: `src/features/settings/config/settingsConfig.ts`
- Modify: `src/features/settings/components/SettingsContent.tsx`

**Interfaces:**
- Consumes: `PrintRuleService` (Task 7), `DestinationService.getDestinations()` (Task 6), `selectCategories` (existing, `src/features/catalog/store/catalogSlice.ts`).

No dedicated `.test.ts` (pure presentational + form screen).

- [ ] **Step 1: Register the new settings menu key**

In `src/features/settings/store/settingsSlice.ts`:

```ts
export type SettingsMenuKey =
  | 'printer'
  | 'printDestination'
  | 'printRouting'
  | 'scanner'
  | 'account'
  | 'language'
  | 'sync'
  | 'info';
```

In `settingsConfig.ts`:

```ts
{ key: 'printRouting', icon: 'routes', label: 'Định tuyến in', group: 'device' },
```

- [ ] **Step 2: Implement `PrintRoutingPanel`**

Create `src/features/printer/components/PrintRoutingPanel.tsx`. Condition
builder picks a real category from `selectCategories` (catalog store) and
stores `categoryId`, or a `DineIn`/`TakeAway` `serviceType` radio — matching
`PrintCondition`'s concrete shape (spec §2), not a free-text field:

```tsx
// src/features/printer/components/PrintRoutingPanel.tsx
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { Text, RadioButton } from 'react-native-paper';
import type { RootState } from '../../../store';
import { AppButton } from '../../../components/AppButton';
import { selectCategories } from '../../catalog/store/catalogSlice';
import { PrintRuleService } from '../services/PrintRuleService';
import { DestinationService } from '../services/DestinationService';
import { generateId } from '../../../utils/id';
import type { PrintCondition, PrintRule } from '../types/printRule.types';

export const PrintRoutingPanel: React.FC = () => {
  const categories = useSelector((state: RootState) => selectCategories(state));
  const destinations = DestinationService.getDestinations();
  const [routing, setRouting] = useState(() => PrintRuleService.getRoutingConfiguration());
  const [conditionType, setConditionType] = useState<'categoryId' | 'serviceType'>('categoryId');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);

  const refresh = useCallback(() => setRouting(PrintRuleService.getRoutingConfiguration()), []);

  const addRule = (): void => {
    if (destinationId === null) return;
    const condition: PrintCondition =
      conditionType === 'categoryId' && categoryId !== null
        ? { field: 'categoryId', value: categoryId }
        : { field: 'serviceType', value: 'DineIn' };
    const rule: PrintRule = {
      id: generateId(),
      conditions: [condition],
      destinationId,
      priority: routing.rules.length + 1,
      enabled: true,
    };
    const next = { ...routing, rules: [...routing.rules, rule] };
    PrintRuleService.saveRoutingConfiguration(next);
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Định tuyến in</Text>

      {routing.rules.map((rule) => (
        <Text key={rule.id} style={styles.ruleRow}>
          {rule.conditions.map((c) => `${c.field}=${c.value}`).join(' & ')} → {destinations.find((d) => d.id === rule.destinationId)?.name ?? rule.destinationId}
        </Text>
      ))}

      <View style={styles.form}>
        <RadioButton.Group onValueChange={(v) => setConditionType(v as 'categoryId' | 'serviceType')} value={conditionType}>
          <RadioButton.Item label="Theo danh mục" value="categoryId" />
          <RadioButton.Item label="Theo hình thức phục vụ" value="serviceType" />
        </RadioButton.Group>

        {conditionType === 'categoryId' &&
          categories.map((category) => (
            <RadioButton.Item
              key={category.id}
              label={category.name}
              value={String(category.id)}
              status={categoryId === category.id ? 'checked' : 'unchecked'}
              onPress={() => setCategoryId(category.id)}
            />
          ))}

        {destinations.map((destination) => (
          <RadioButton.Item
            key={destination.id}
            label={destination.name}
            value={destination.id}
            status={destinationId === destination.id ? 'checked' : 'unchecked'}
            onPress={() => setDestinationId(destination.id)}
          />
        ))}

        <AppButton label="Thêm quy tắc" onPress={addRule} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  ruleRow: { fontSize: 13, padding: 8 },
  form: { gap: 8, marginTop: 16 },
});
```

This panel does not yet implement the "reject ambiguous equal-priority
overlapping rules at save time" validation from spec §5 — flag that as a
follow-up if it's needed before this panel ships to real users; the spec
names it as a requirement but this task's UI, as scoped, only appends rules
in priority-by-insertion-order and does not check for overlap.

- [ ] **Step 3: Wire into `SettingsContent`**

```tsx
import { PrintRoutingPanel } from '../../printer/components/PrintRoutingPanel';
// ...
{activeSection === 'printRouting' && <PrintRoutingPanel />}
```

- [ ] **Step 4: Verify with type-check and lint**

Run: `npm run type-check`
Run: `npm run lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/components/PrintRoutingPanel.tsx src/features/settings/store/settingsSlice.ts src/features/settings/config/settingsConfig.ts src/features/settings/components/SettingsContent.tsx
git commit -m "feat: add Print Routing panel, wired into Settings"
```

---

## Post-plan verification

After all 15 tasks:

```bash
npm run verify   # type-check + lint + test
```

Then manually, on a device/emulator: add a printer, create a
`PrintDestination` pointing at it, add a routing rule, run "Test Print" from
the Destination panel, and — once a store has real catalog/cart data —
complete a checkout and confirm the configured destination's printer
receives a ticket.
