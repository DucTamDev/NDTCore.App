# Printer Media UI + Add-Printer Screen (SP-C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI cấu hình `PrintMedia` per-driver + ô số hàng "In tem thử" + màn Thêm máy in inline (không popup) trên điện thoại.

**Architecture:** Media quản qua `drivers` state + callback `onChangeDriverMedia` → `PrinterService.setDriverMedia` (pattern giống `onChangeTsplInternalFont`). Field `paperSize` RHF top-level bị bỏ — mỗi driver card có section media riêng. Cross-field validate (die-cut vừa khổ giấy) trong `utils/mediaValidation.ts`, dùng bởi cả schema lẫn UI. `AddPrinterModal` tách `AddPrinterForm` (nội dung) + wrapper Modal; `PrinterManagementPanel` dùng `useLayoutMode()` → phone render `AddPrinterForm` inline.

**Tech Stack:** React Native 0.86, TypeScript strict, react-hook-form + Zod, react-native-paper, Jest (babel-jest — type errors KHÔNG chặn test; `npm run type-check` riêng).

**Spec:** `docs/superpowers/specs/2026-08-30-printer-media-ui-design.md`

## Global Constraints

- Text hiển thị người dùng: **tiếng Việt**. TypeScript strict, **không `any`**.
- Không comment giải thích WHAT — chỉ WHY khi không rõ.
- Component UI thuần (`components/*`, subcomponent nhỏ) **không** test file riêng — verify qua `type-check` + `lint` + test tay. Chỉ file logic (services/hooks/schemas/utils) có `.test.ts`.
- Test file trong `__tests__/` cùng cấp, đuôi `.test.ts(x)`.
- Commit `<type>: <mô tả ngắn>` kết bằng `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Trước commit: `npm run type-check` sạch + `npx jest` xanh + `npm run lint` 0 error (2 warning cũ ở `BluetoothTransport.test.ts`/`LanTransport.test.ts` chấp nhận).
- Branch `fix/printer-post-merge` (đã ở sẵn). KHÔNG tạo branch mới.
- `PaperSize` = `58 | 80 | 100 | 104`. `PrintMediaType` values `'continuous'`/`'die_cut'`. Default media mới = `{ type: 'continuous', paperSize: 80 }`. Default die_cut fields khi đổi type: `itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3`.
- **KHÔNG làm UI cho `cutterMode` / `capabilities.cutter`** — giữ dormant.
- **KHÔNG đụng engine** (`TsplEncoder` render logic, strategies, `TsplDriver.buildBytes`, `cutter.ts`) — SP-B đã xong. `TsplEncoder.ts` chỉ đổi 1 dòng import (`PRINTABLE_WIDTH_MM`).
- Cross-field die-cut: `columns·itemWidthMm + (columns-1)·horizontalGapMm ≤ PRINTABLE_WIDTH_MM[paperSize]`.

---

## File Structure

**Tạo mới:**

| File | Trách nhiệm |
|------|-------------|
| `src/features/printer/utils/mediaValidation.ts` | `dieCutRowOverflow(media): string \| null` — cross-field die-cut-vừa-khổ, dùng bởi schema + `PrinterInfoCard` |
| `src/features/printer/utils/__tests__/mediaValidation.test.ts` | test cho trên |
| `src/features/printer/components/AddPrinterForm.tsx` | Nội dung form Thêm/Sửa máy in (tách khỏi `AddPrinterModal`) — dùng trực tiếp inline trên phone, hoặc bọc trong Modal trên tablet |
| `src/features/printer/components/DriverMediaSection.tsx` | Section cấu hình `PrintMedia` của 1 driver trong `PrinterInfoCard` — component UI thuần |

**Sửa:**

| File | Thay đổi |
|------|----------|
| `src/features/printer/utils/paperWidth.ts` | + `export const PRINTABLE_WIDTH_MM: Record<PaperSize, number> = { 58: 50, 80: 72, 100: 96, 104: 104 }` |
| `src/features/printer/drivers/tspl/TsplEncoder.ts` | Bỏ `const PRINTABLE_WIDTH_MM = ...` local; import từ `../../utils/paperWidth` (dòng import sẵn có `{ DOTS_PER_MM, PAPER_WIDTH_CHARS }` → thêm `PRINTABLE_WIDTH_MM`) |
| `src/features/printer/schemas/printerFormSchema.ts` | `printerDisplaySchema` bỏ `paperSize` (còn `{ name }`); `printMediaSchema.superRefine` + gọi `dieCutRowOverflow`; import `dieCutRowOverflow` |
| `src/features/printer/printing/PrinterService.ts` | + `setDriverMedia(printerId, driverType, patch)`; `testPrint` + param `options?: PrintOptions` forward xuống driver |
| `src/features/printer/discovery/PrinterDiscoveryService.ts` | `DiscoveryInput` bỏ field `paperSize`; candidate config `{ ...def, media: { ...def.media } }` (bỏ `paperSize: input.paperSize`) |
| `src/features/printer/hooks/useAddPrinterFlow.ts` | `displayForm` defaultValues bỏ `paperSize`; `addDriverToList` config `{ ...def }`; `startDiscovery` bỏ `paperSize`; + `onChangeDriverMedia`; + state `testPrintRowsText` + `onTestPrintRowsChange`; `runTestPrint` truyền `{ rows }` cho Label; `buildDraftPrinter` bỏ `.map` stamp paperSize; `onSave` reconnect nếu connected; return `infoCard` + 4 field mới |
| `src/features/printer/components/PrinterInfoCard.tsx` | Bỏ `<Controller name="paperSize">`; `PrinterInfoCardProps` + `onChangeDriverMedia`/`testPrintRowsText`/`onTestPrintRowsChange`/`hasTsplDriver`; render `<DriverMediaSection>` trong mỗi driver card; ô "Số hàng in thử" cạnh nút "In tem thử" khi `hasTsplDriver` |
| `src/features/printer/components/AddPrinterModal.tsx` | Rút gọn thành wrapper `<Portal><Modal>` quanh `<AddPrinterForm>` |
| `src/features/printer/components/PrinterManagementPanel.tsx` | `useLayoutMode()`; `mode: 'list' \| 'form'`; phone + form → render `<AddPrinterForm>` inline; tablet → `<AddPrinterModal>`; `BackHandler` khi `mode === 'form'` trên phone |
| `src/features/printer/ARCHITECTURE.md` | ~dòng 451: `paperSize: 58 \| 80` trên `Printer` → bỏ, thêm `capabilities` + note `media` ở `PrinterDriver.config` |
| **test**: `printerFormSchema.test.ts`, `PrinterService.test.ts`, `useAddPrinterFlow.test.tsx`, `PrinterDiscoveryService.test.ts` | cập nhật theo |

---

## Task 1: Media validation foundation

**Files:**
- Modify: `src/features/printer/utils/paperWidth.ts`, `src/features/printer/drivers/tspl/TsplEncoder.ts`, `src/features/printer/schemas/printerFormSchema.ts`
- Create: `src/features/printer/utils/mediaValidation.ts`, `src/features/printer/utils/__tests__/mediaValidation.test.ts`
- Test: `src/features/printer/schemas/__tests__/printerFormSchema.test.ts`

**Interfaces:**
- Consumes (SP-A/B): `PrintMedia`, `PrintMediaType`, `PaperSize` từ `types/printer.types`; `printMediaSchema` structure trong `printerFormSchema.ts`.
- Produces:
  ```ts
  // utils/paperWidth.ts
  export const PRINTABLE_WIDTH_MM: Record<PaperSize, number>;   // { 58:50, 80:72, 100:96, 104:104 }
  // utils/mediaValidation.ts
  export const dieCutRowOverflow: (media: PrintMedia) => string | null;
  // schemas/printerFormSchema.ts
  // printerDisplaySchema: z.object({ name }) — NO paperSize
  // PrinterDisplayValues = { name: string }
  ```

- [ ] **Step 1: `PRINTABLE_WIDTH_MM` → `paperWidth.ts`**

`src/features/printer/utils/paperWidth.ts` — thêm sau `DOTS_PER_MM`:
```ts
/**
 * mm in được thật theo khổ đầu in (`@ DOTS_PER_MM`). Số cho 100/104 là tạm —
 * verify khi có phần cứng (spec 2026-08-30). Dùng cho lệnh `SIZE` (TSPL) và
 * validate die-cut vừa khổ giấy.
 */
export const PRINTABLE_WIDTH_MM: Record<PaperSize, number> = { 58: 50, 80: 72, 100: 96, 104: 104 };
```
`src/features/printer/drivers/tspl/TsplEncoder.ts` — dòng ~6 `import { DOTS_PER_MM, PAPER_WIDTH_CHARS } from '../../utils/paperWidth';` → thêm `PRINTABLE_WIDTH_MM`; **xoá** dòng ~86 `const PRINTABLE_WIDTH_MM: Record<PaperSize, number> = { 58: 50, 80: 72, 100: 96, 104: 104 };`.

Run: `npx jest src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts` → vẫn xanh (không đổi hành vi).

- [ ] **Step 2: Viết test `mediaValidation`**

`src/features/printer/utils/__tests__/mediaValidation.test.ts`:
```ts
import { dieCutRowOverflow } from '../mediaValidation';
import { PrintMediaType } from '../../types/printer.types';
import type { PrintMedia } from '../../types/printer.types';

const die = (o: Partial<PrintMedia>): PrintMedia => ({
  type: PrintMediaType.dieCut, paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3, ...o,
});

describe('dieCutRowOverflow', () => {
  it('null khi hàng vừa khổ in (3×30 + 2×2 = 94 ≤ 96)', () => {
    expect(dieCutRowOverflow(die({}))).toBeNull();
  });
  it('message khi vượt (4×30 + 3×2 = 126 > 96)', () => {
    const msg = dieCutRowOverflow(die({ columns: 4 }));
    expect(msg).toContain('126');
    expect(msg).toContain('96');
  });
  it('null cho media continuous', () => {
    expect(dieCutRowOverflow({ type: PrintMediaType.continuous, paperSize: 80 })).toBeNull();
  });
  it('null khi die-cut thiếu field (chưa đủ để tính)', () => {
    expect(dieCutRowOverflow({ type: PrintMediaType.dieCut, paperSize: 100 })).toBeNull();
  });
});
```

- [ ] **Step 3: Chạy — đỏ**

Run: `npx jest src/features/printer/utils/__tests__/mediaValidation.test.ts`
Expected: FAIL — `Cannot find module '../mediaValidation'`.

- [ ] **Step 4: `mediaValidation.ts`**

```ts
import { PrintMediaType } from '../types/printer.types';
import type { PrintMedia } from '../types/printer.types';
import { PRINTABLE_WIDTH_MM } from './paperWidth';

/**
 * Hàng die-cut (`columns` con tem + gap ngang) có rộng hơn vùng in được của
 * khổ giấy không. Trả message tiếng Việt nếu vượt, `null` nếu vừa / không đủ
 * field để tính / media continuous. Dùng ở cả `printMediaSchema` (chặn Save)
 * lẫn `PrinterInfoCard` (cảnh báo inline).
 */
export const dieCutRowOverflow = (media: PrintMedia): string | null => {
  if (media.type !== PrintMediaType.dieCut) return null;
  const { columns, itemWidthMm, horizontalGapMm, paperSize } = media;
  if (columns == null || itemWidthMm == null || horizontalGapMm == null) return null;
  const rowWidthMm = columns * itemWidthMm + (columns - 1) * horizontalGapMm;
  const printableMm = PRINTABLE_WIDTH_MM[paperSize];
  if (rowWidthMm <= printableMm) return null;
  return `Hàng ${columns} cột rộng ${rowWidthMm}mm, vượt khổ in được ${printableMm}mm — giảm số cột / kích thước tem / khoảng cách.`;
};
```

- [ ] **Step 5: Chạy — xanh**

Run: `npx jest src/features/printer/utils/__tests__/mediaValidation.test.ts` → PASS (4/4).

- [ ] **Step 6: Viết test schema (đỏ trước)**

`src/features/printer/schemas/__tests__/printerFormSchema.test.ts`:
- **Xoá** 2 test: `'accepts a numeric paperSize of 58 or 80'` và `'rejects a string paperSize like the old "80mm"'` (field không còn).
- Sửa test `'rejects an empty name'` (dòng ~55): bỏ `, paperSize: 80` khỏi object → `printerDisplaySchema.safeParse({ name: '' })`.
- Thêm test `'accepts { name } không cần paperSize'`: `expect(printerDisplaySchema.safeParse({ name: 'Máy in' }).success).toBe(true)`.
- Trong `describe('printMediaSchema (qua printerSchema)')` thêm:
  ```ts
  it('die_cut vượt khổ giấy → fail', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 4, horizontalGapMm: 2, verticalGapMm: 3 }).success).toBe(false);
  });
  it('die_cut vừa khổ giấy → pass', () => {
    expect(withTsplMedia({ type: 'die_cut', paperSize: 100, itemWidthMm: 30, itemHeightMm: 20, columns: 3, horizontalGapMm: 2, verticalGapMm: 3 }).success).toBe(true);
  });
  ```

- [ ] **Step 7: Chạy — đỏ**

Run: `npx jest src/features/printer/schemas`
Expected: FAIL — `die_cut vượt khổ giấy` vẫn `success: true`; type-check báo `printerDisplaySchema` vẫn có `paperSize` (chưa sửa).

- [ ] **Step 8: Sửa `printerFormSchema.ts`**

```ts
import { dieCutRowOverflow } from '../utils/mediaValidation';
// ...
export const printerDisplaySchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên máy in'),
});
```
Trong `printMediaSchema.superRefine`, sau block `cutterMode` check, thêm:
```ts
const overflow = dieCutRowOverflow(m as PrintMedia);
if (overflow) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: overflow });
```
(`m` trong superRefine đã có đủ field optional — cast `as PrintMedia` an toàn vì `dieCutRowOverflow` tự guard.)

- [ ] **Step 9: Chạy — xanh + commit**

Run: `npm run type-check` (sạch — trừ nơi khác đọc `PrinterDisplayValues.paperSize`; các file đó Task 3-4 sửa, jest vẫn chạy) — **CHÚ Ý:** type-check SẼ đỏ ở `useAddPrinterFlow.ts` (`defaultValues.paperSize`), `PrinterInfoCard.tsx` (`<Controller name="paperSize">`), và vài test. Đó là kỳ vọng — Task 3-4 sửa. Để xác nhận Task 1 đúng phạm vi: lỗi type-check CHỈ được là "`paperSize` không tồn tại trên `PrinterDisplayValues`" — không lỗi nào khác.
Run: `npx jest src/features/printer/utils src/features/printer/schemas` → xanh.
```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: media validation foundation — PRINTABLE_WIDTH_MM + dieCutRowOverflow + schema (SP-C t1)

- PRINTABLE_WIDTH_MM chuyển từ TsplEncoder sang utils/paperWidth.ts
- utils/mediaValidation.ts: dieCutRowOverflow (die-cut vừa khổ giấy)
- printMediaSchema.superRefine gọi dieCutRowOverflow
- printerDisplaySchema bỏ paperSize (chuyển sang per-driver media, Task 3-4)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `PrinterService.setDriverMedia` + `testPrint` options

**Files:**
- Modify: `src/features/printer/printing/PrinterService.ts`
- Test: `src/features/printer/printing/__tests__/PrinterService.test.ts`

**Interfaces:**
- Consumes: `PrintMedia`, `PrinterDriverType` (SP-A); `PrintOptions` từ `types/driver.types` (SP-B).
- Produces:
  ```ts
  setDriverMedia(printerId: string, driverType: PrinterDriverType, patch: Partial<PrintMedia>): void;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
  ```

- [ ] **Step 1: Viết test (đỏ trước)**

`PrinterService.test.ts` — thêm (cạnh test `setTsplInternalFont`):
```ts
it('setDriverMedia() persist media patch cho tspl driver của printer đã lưu', () => {
  const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
  service.addPrinter({ ...basePrinter, drivers: [tsplDriverEntry] });
  service.setDriverMedia(basePrinter.id, PrinterDriverType.tspl, { paperSize: 100 });
  const saved = service.getPrinters()[0].drivers.find((d) => d.type === PrinterDriverType.tspl)!;
  expect(saved.config.media).toMatchObject({ type: 'continuous', paperSize: 100 });
});
it('setDriverMedia() cho escpos driver', () => {
  const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
  service.addPrinter(basePrinter);
  service.setDriverMedia(basePrinter.id, PrinterDriverType.escpos, { paperSize: 58 });
  expect(service.getPrinters()[0].drivers[0].config.media.paperSize).toBe(58);
});
it('setDriverMedia() no-op cho printer chưa lưu', () => {
  const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() }, createResourceLock());
  expect(() => service.setDriverMedia('not-saved', PrinterDriverType.tspl, { paperSize: 100 })).not.toThrow();
});
it('testPrint() forward options xuống driver.testPrint', async () => {
  const tsplDriver = makeMockDriver();
  const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver }, createResourceLock());
  const p = { ...basePrinter, drivers: [tsplDriverEntry] };
  await service.testPrint(p, tsplDriverEntry, { text: { elements: [] } }, PrintType.Label, { rows: 3 });
  expect(tsplDriver.testPrint).toHaveBeenCalledWith(p, tsplDriverEntry, expect.anything(), PrintType.Label, { rows: 3 });
});
```

- [ ] **Step 2: Chạy — đỏ**

Run: `npx jest src/features/printer/printing/__tests__/PrinterService.test.ts`
Expected: FAIL — `setDriverMedia` không tồn tại; `testPrint` mock nhận 4 args (không có options).

- [ ] **Step 3: Implement**

`PrinterService.ts`:
- import `PrintMedia` (type) từ `../types/printer.types`; `PrintOptions` từ `../types/driver.types`.
- Cạnh `setTsplInternalFont`:
```ts
const setDriverMedia = (printerId: string, driverType: PrinterDriverType, patch: Partial<PrintMedia>): void => {
  const printers = getPrinters();
  const printer = printers.find((p) => p.id === printerId);
  const entry = printer?.drivers.find((d) => d.type === driverType);
  if (!printer || !entry) return;
  savePrinters(
    printers.map((p) =>
      p.id !== printerId ? p : {
        ...p,
        drivers: p.drivers.map((d) =>
          d.type !== driverType ? d : { ...d, config: { ...d.config, media: { ...d.config.media, ...patch } } },
        ),
      },
    ),
  );
};
```
- `testPrint`:
```ts
const testPrint = async (printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void> => {
  await lock.runExclusive(resourceKeyFor(printer, driver.type), () => getDriver(driver.type).testPrint(printer, driver, documents, printType, options));
};
```
- Thêm `setDriverMedia` vào object `return { ... }`.

- [ ] **Step 4: Chạy — xanh + commit**

Run: `npm run type-check` (Task 1 residual `paperSize` errors vẫn còn — OK) + `npx jest src/features/printer/printing` (xanh) + `npm run lint`.
```bash
git add src/features/printer/printing/PrinterService.ts src/features/printer/printing/__tests__/PrinterService.test.ts
git commit -m "$(cat <<'EOF'
feat: PrinterService.setDriverMedia + testPrint options passthrough (SP-C t2)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `useAddPrinterFlow` — media/rows wiring + discovery revert + onSave reconnect

**Files:**
- Modify: `src/features/printer/hooks/useAddPrinterFlow.ts`, `src/features/printer/discovery/PrinterDiscoveryService.ts`
- Test: `src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx`, `src/features/printer/printing/__tests__/PrinterService.test.ts`, `src/features/printer/discovery/__tests__/PrinterDiscoveryService.test.ts`

**Interfaces:**
- Consumes: `setDriverMedia` / `testPrint(...,options)` (Task 2); `dieCutRowOverflow` (Task 1); `PrinterDisplayValues = { name }` (Task 1); SP-A `mediaOf`, SP-B `resolveRows` (trong `TsplDriver`, không import).
- Produces (đọc bởi Task 4 qua `infoCard`):
  ```ts
  onChangeDriverMedia: (driverType: PrinterDriverType, patch: Partial<PrintMedia>) => void;
  testPrintRowsText: string;                       // "1" mặc định
  onTestPrintRowsChange: (text: string) => void;
  hasTsplDriver: boolean;
  ```

- [ ] **Step 1: `PrinterDiscoveryService` — bỏ `paperSize`**

`discovery/PrinterDiscoveryService.ts`:
- `DiscoveryInput`: **xoá** field `paperSize: PaperSize;` + import `PaperSize` nếu chỉ nó dùng.
- Trong candidate loop (nơi `const draftDriver = { ..., config: { ...def, media: { ...def.media, paperSize: input.paperSize } } }`) → `config: { ...def, media: { ...def.media } }`.
- Cập nhật doc comment `draftPrinter` (nhắc `input.paperSize`) → bỏ nhắc.

`PrinterDiscoveryService.test.ts` + `PrinterService.test.ts:339`: bỏ `paperSize: 80` / `paperSize: 58` khỏi input dựng `discoverDriver({...})`. Test `does not mutate the shared defaultConfig` (SP-A finalfix) giữ — vẫn assert `getDriverDefinition(...).defaultConfig.media.paperSize === 80` không đổi.

- [ ] **Step 2: `useAddPrinterFlow` — bỏ form paperSize + discovery revert**

- `displayForm` `defaultValues`: bỏ `paperSize: initialValues?.drivers[0]?.config.media.paperSize ?? 80` → chỉ `{ name: initialValues?.name ?? '' }`.
- `addDriverToList` (dòng ~186): `config: { ...getDriverDefinition(type).defaultConfig }` (spread phá shared-ref; SP-A finalfix từng stamp `media.paperSize` từ form — bỏ).
- `startDiscovery` (dòng ~244): `PrinterService.discoverDriver({ draftPrinter: buildDraftPrinter(), excludedDrivers: drivers.map((d) => d.type) }, ...)` — bỏ `paperSize: displayForm.getValues('paperSize')`.
- `buildDraftPrinter`: `drivers: drivers.map((d) => ({ ...d, config: { ...d.config, media: { ...d.config.media, paperSize: displayForm.getValues('paperSize') } } }))` → `drivers,`.

- [ ] **Step 3: `useAddPrinterFlow` — `onChangeDriverMedia` + rows state**

Thêm (cạnh `onChangeTsplInternalFont`):
```ts
const onChangeDriverMedia = (driverType: PrinterDriverType, patch: Partial<PrintMedia>): void => {
  setDrivers((prev) => prev.map((d) => {
    if (d.type !== driverType) return d;
    let media = { ...d.config.media, ...patch } as PrintMedia;
    if (media.type === PrintMediaType.dieCut) {
      media = { itemWidthMm: 30, itemHeightMm: 20, columns: 2, horizontalGapMm: 2, verticalGapMm: 3, ...media };
    }
    return { ...d, config: { ...d.config, media } };
  }));
  PrinterService.setDriverMedia(printerId, driverType, patch);
};
```
State + handler:
```ts
const [testPrintRowsText, setTestPrintRowsText] = useState('1');
```
`runTestPrint` (dòng ~434) — nhánh gọi `testPrint`:
```ts
const options = printType === PrintType.Label ? { rows: Number(testPrintRowsText) } : undefined;
await PrinterService.testPrint(printer, driver, documents, printType, options);
```
Import thêm: `PrintMediaType` (value) + `PrintMedia` (type) từ `../types/printer.types`.

- [ ] **Step 4: `useAddPrinterFlow` — `onSave` reconnect**

`onSave` (dòng ~438) — nhánh sau `onSaved()`:
```ts
// hiện tại:
if (printer.autoReconnect && liveStatus !== PrinterStatus.connected) {
  PrinterService.connect(printer.id).catch(() => undefined);
}
// đổi thành:
if (liveStatus === PrinterStatus.connected) {
  PrinterService.reconnect(printer.id).catch(() => undefined);   // context lấy config media đã lưu
} else if (printer.autoReconnect) {
  PrinterService.connect(printer.id).catch(() => undefined);
}
```
(`PrinterService.reconnect` đã export — xem `PrinterService.ts` return object.)

- [ ] **Step 5: `useAddPrinterFlow` return — infoCard fields + saveDisabled overflow**

Import (đầu file): `dieCutRowOverflow` từ `../utils/mediaValidation`. `mediaOf` đã import sẵn.
Trong object `infoCard: { ... }` thêm:
```ts
onChangeDriverMedia,
testPrintRowsText,
onTestPrintRowsChange: setTestPrintRowsText,
hasTsplDriver: drivers.some((d) => d.type === PrinterDriverType.tspl),
```
Và sửa `saveDisabled`:
```ts
saveDisabled:
  drivers.length === 0 ||
  connectionDirty ||
  hasEmptyContentTypeDriver ||
  drivers.some((d) => dieCutRowOverflow(mediaOf(d)) != null),
```

- [ ] **Step 6: Cập nhật `useAddPrinterFlow.test.tsx`**

- Test `manual protocol pick ... media.paperSize matches the form` (dòng 181) + `... both entries at the form paperSize` (193): **viết lại** — không còn "form paperSize". Thay bằng: gọi `get().infoCard.onChangeDriverMedia(PrinterDriverType.tspl, { paperSize: 100 })` sau khi có driver tspl → assert driver state `media.paperSize === 100`; và `buildDraftPrinter`/draft giữ `media.paperSize === 100` (không bị đè). Xoá đoạn `(control as ...)._formValues.paperSize = 58`.
- Test dòng 130 (`saved.drivers.every(d => d.config.media.paperSize === 80)`) + 245: giữ (default 80 vẫn đúng khi không đổi media).
- Test `savedTspl` fixture (dòng 42) + dòng 264: media `{ type: 'continuous', paperSize: 80 }` giữ.
- Thêm test:
  ```ts
  it('onChangeDriverMedia type=die_cut điền 5 field default', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { get().infoCard.onChangeDriverMedia(PrinterDriverType.tspl, { type: 'die_cut' }); });
    const tspl = get().infoCard.drivers[0];
    expect(tspl.config.media).toMatchObject({ type: 'die_cut', itemWidthMm: 30, columns: 2, verticalGapMm: 3 });
  });
  it('runTestPrint(Label) với testPrintRowsText=3 → testPrint nhận { rows: 3 }', async () => {
    const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
    await act(async () => { get().infoCard.onTestPrintRowsChange('3'); });
    await act(async () => { await get().infoCard.onTestPrintLabel(); });
    expect(PrinterService.testPrint).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), PrintType.Label, { rows: 3 });
  });
  ```
  (Mock `PrinterService` trong file này cần `setDriverMedia: jest.fn()`, `reconnect: jest.fn(() => Promise.resolve())` — thêm nếu thiếu.)

- [ ] **Step 7: Verify + commit**

Run: `npm run type-check` — giờ CHỈ còn đỏ ở `PrinterInfoCard.tsx` (`<Controller name="paperSize">` + props thiếu) → Task 4. Không lỗi nào khác.
Run: `npx jest src/features/printer/hooks src/features/printer/discovery src/features/printer/printing` → xanh.
Run: `npm run lint`.
```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: useAddPrinterFlow media/rows wiring + revert discovery paperSize threading (SP-C t3)

- onChangeDriverMedia (per-driver media, die_cut auto-fill defaults)
- testPrintRowsText + runTestPrint(Label) truyền { rows }
- bỏ form paperSize field; DiscoveryInput bỏ paperSize; buildDraftPrinter bỏ stamp
- onSave: reconnect nếu đang connected (context lấy media đã lưu)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `PrinterInfoCard` — media form + row input

**Files:**
- Create: `src/features/printer/components/DriverMediaSection.tsx`
- Modify: `src/features/printer/components/PrinterInfoCard.tsx`
- Không test riêng (component UI thuần) — verify `type-check` + `lint`.

**Interfaces:**
- Consumes: `infoCard` fields từ Task 3 (`onChangeDriverMedia`/`testPrintRowsText`/`onTestPrintRowsChange`/`hasTsplDriver`); `dieCutRowOverflow` (Task 1); `mediaOf` (SP-A).
- Produces: `PrinterInfoCardProps` mở rộng (đọc bởi `AddPrinterForm` Task 5 qua `{...flow.infoCard}` — tự khớp).

- [ ] **Step 1: `DriverMediaSection.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppSelect } from '../../../components/AppSelect';
import { AppInput } from '../../../components/AppInput';
import { PrintMediaType, PrinterDriverType, type PaperSize, type PrintMedia } from '../types/printer.types';
import { dieCutRowOverflow } from '../utils/mediaValidation';

const PAPER_SIZE_OPTIONS = [58, 80, 100, 104].map((n) => ({ label: `${n}mm`, value: String(n) }));
const MEDIA_TYPE_OPTIONS = [
  { label: 'Giấy cuộn liên tục', value: PrintMediaType.continuous },
  { label: 'Die-cut (tem rời, nhiều cột)', value: PrintMediaType.dieCut },
];

export interface DriverMediaSectionProps {
  driverType: PrinterDriverType;
  media: PrintMedia;
  disabled: boolean;
  onChange: (patch: Partial<PrintMedia>) => void;
}

const parseNum = (t: string): number | undefined => (t.trim() === '' ? undefined : Number(t));
const numStr = (n: number | undefined): string => (n == null ? '' : String(n));

export const DriverMediaSection: React.FC<DriverMediaSectionProps> = ({ driverType, media, disabled, onChange }) => {
  const isTspl = driverType === PrinterDriverType.tspl;
  const isDieCut = media.type === PrintMediaType.dieCut;
  const overflow = dieCutRowOverflow(media);
  return (
    <View style={styles.block}>
      <AppSelect
        label="Khổ giấy"
        value={String(media.paperSize)}
        onSelect={(v) => onChange({ paperSize: Number(v) as PaperSize })}
        options={PAPER_SIZE_OPTIONS}
        disabled={disabled}
      />
      {isTspl ? (
        <>
          <AppSelect
            label="Loại giấy"
            value={media.type}
            onSelect={(v) => onChange({ type: v as PrintMedia['type'] })}
            options={MEDIA_TYPE_OPTIONS}
            disabled={disabled}
          />
          {isDieCut ? (
            <>
              <AppInput label="Rộng tem (mm)" keyboardType="numeric" value={numStr(media.itemWidthMm)} onChangeText={(t) => onChange({ itemWidthMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Cao tem (mm)" keyboardType="numeric" value={numStr(media.itemHeightMm)} onChangeText={(t) => onChange({ itemHeightMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Số cột" keyboardType="numeric" value={numStr(media.columns)} onChangeText={(t) => onChange({ columns: parseNum(t) })} disabled={disabled} />
              <AppInput label="Khoảng cách ngang (mm)" keyboardType="numeric" value={numStr(media.horizontalGapMm)} onChangeText={(t) => onChange({ horizontalGapMm: parseNum(t) })} disabled={disabled} />
              <AppInput label="Khoảng cách dọc (mm)" keyboardType="numeric" value={numStr(media.verticalGapMm)} onChangeText={(t) => onChange({ verticalGapMm: parseNum(t) })} disabled={disabled} />
              {overflow ? <Text style={styles.error}>{overflow}</Text> : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  error: { color: '#B91C1C' },
});
```

- [ ] **Step 2: `PrinterInfoCard.tsx`**

- **Xoá** `<Controller control={control} name="paperSize" render={...}>` block (dòng ~119-133).
- `PrinterInfoCardProps` thêm:
  ```ts
  onChangeDriverMedia: (driverType: PrinterDriverType, patch: Partial<PrintMedia>) => void;
  testPrintRowsText: string;
  onTestPrintRowsChange: (text: string) => void;
  hasTsplDriver: boolean;
  ```
  import `DriverMediaSection`, `mediaOf`, `PrintMedia` type.
- Trong `drivers.map((driver) => ...)`, sau `<View style={styles.row}>` chip block, TRƯỚC content-type switches:
  ```tsx
  <DriverMediaSection
    driverType={driver.type}
    media={mediaOf(driver)}
    disabled={locked}
    onChange={(patch) => onChangeDriverMedia(driver.type, patch)}
  />
  ```
- Trong `<View style={styles.testPrintRow}>`, thêm trước nút "In tem thử" (chỉ khi `hasTsplDriver`):
  ```tsx
  {hasTsplDriver ? (
    <AppInput label="Số hàng in thử" keyboardType="numeric" value={testPrintRowsText} onChangeText={onTestPrintRowsChange} disabled={locked} />
  ) : null}
  ```
  (Cân nhắc layout: đặt ô số hàng ra 1 dòng riêng trên `testPrintRow` thay vì chen ngang 2 nút — dùng 1 `<View>` bọc. Giữ đơn giản: ô số hàng 1 dòng, 2 nút 1 dòng.)
- `saveDisabled` KHÔNG đổi ở component — Task 3 Step 5 đã thêm điều kiện `dieCutRowOverflow` vào `infoCard.saveDisabled`.

- [ ] **Step 3: Verify + commit**

Run: `npm run type-check` — giờ chỉ còn đỏ ở `AddPrinterModal.tsx`/`PrinterManagementPanel.tsx` nếu Task 5 chưa làm... KHÔNG — `PrinterInfoCard` props mới được truyền qua `{...flow.infoCard}` ở `AddPrinterModal` hiện tại, `flow.infoCard` (Task 3) đã có đủ field → type-check **sạch** sau Task 4.
Run: `npx jest` (toàn bộ) → xanh (không có test UI mới; test cũ không đụng).
Run: `npm run lint`.
```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: PrinterInfoCard media form per-driver + số hàng in thử (SP-C t4)

- DriverMediaSection: khổ giấy (mọi driver); TSPL + loại giấy + die-cut dims/cột/gap
- cảnh báo inline khi hàng die-cut vượt khổ
- bỏ Controller paperSize top-level; ô "Số hàng in thử" cho driver TSPL

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `AddPrinterForm` split + `PrinterManagementPanel` inline + SP-B debt

**Files:**
- Create: `src/features/printer/components/AddPrinterForm.tsx`
- Modify: `src/features/printer/components/AddPrinterModal.tsx`, `src/features/printer/components/PrinterManagementPanel.tsx`, `src/features/printer/ARCHITECTURE.md`
- Test: `src/features/printer/hooks/__tests__/useAddPrinterFlow.test.tsx` (capture-arg assertion — SP-B debt)

**Interfaces:**
- Consumes: `useAddPrinterFlow` (Task 3 shape), `PrinterInfoCard` (Task 4 shape), `useLayoutMode` từ `../../../hooks/useLayoutMode`.
- Produces: `AddPrinterForm` component; `PrinterManagementPanel` layout-aware.

- [ ] **Step 1: `AddPrinterForm.tsx`**

Chuyển toàn bộ JSX bên trong `<Modal>` của `AddPrinterModal` (ScrollView + 2 Snackbar) sang đây; thêm header có nút back:
```tsx
import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useAddPrinterFlow } from '../hooks/useAddPrinterFlow';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { Printer } from '../types/printer.types';

export interface AddPrinterFormProps {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
  onBack: () => void;
}

export const AddPrinterForm: React.FC<AddPrinterFormProps> = ({ visible, initialValues, onSaved, onBack }) => {
  const flow = useAddPrinterFlow({ visible, initialValues, onSaved });
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppButton mode="text" label="‹ Quay lại" onPress={onBack} />
        <Text variant="titleMedium">{flow.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ConnectionSection {...flow.connectionSection} />
        {flow.identityErrorMessage ? <Text style={styles.identityError}>{flow.identityErrorMessage}</Text> : null}
        <StatusPanel {...flow.statusPanel} />
        {flow.showAddDriverHint ? <Text variant="bodySmall" style={styles.addDriverHint}>Máy in này còn hỗ trợ thêm driver khác — bấm "Kết nối" để dò tiếp.</Text> : null}
        {flow.hasEmptyContentTypeDriver ? <Text variant="bodySmall" style={styles.identityError}>Mỗi driver phải nhận in ít nhất 1 loại nội dung (Hoá đơn/Tem) — chọn ở phần bên dưới trước khi lưu.</Text> : null}
        <PrinterInfoCard {...flow.infoCard} />
        {flow.captureNode}
      </ScrollView>
      <Snackbar visible={flow.testPrintErrorMessage !== null} onDismiss={flow.clearTestPrintError} duration={5000}>{flow.testPrintErrorMessage}</Snackbar>
      <Snackbar visible={flow.saveErrorMessage !== null} onDismiss={flow.clearSaveError} duration={5000}>{flow.saveErrorMessage}</Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollContent: { gap: 12, paddingBottom: 24 },
  identityError: { color: '#B91C1C' },
  addDriverHint: { color: '#6B7280' },
});
```
(Bỏ dòng `<Text variant="titleMedium">{flow.title}</Text>` cũ trong ScrollView — đã lên header.)

- [ ] **Step 2: `AddPrinterModal.tsx` — wrapper mỏng**

```tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { AddPrinterForm } from './AddPrinterForm';
import type { Printer } from '../types/printer.types';

export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: Printer;
  onDismiss: () => void;
  onSaved: () => void;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => (
  <Portal>
    <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
      <AddPrinterForm visible={visible} initialValues={initialValues} onSaved={onSaved} onBack={onDismiss} />
    </Modal>
  </Portal>
);

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
});
```

- [ ] **Step 3: `PrinterManagementPanel.tsx` — layout-aware**

```tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { usePrinterList } from '../hooks/usePrinterList';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import { AddPrinterForm } from './AddPrinterForm';
import type { Printer } from '../types/printer.types';

export const PrinterManagementPanel: React.FC = () => {
  const { printers, reload, ...actions } = usePrinterList();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(undefined);
  const [addSessionId, setAddSessionId] = useState(0);
  const isPhone = useLayoutMode() === 'phone';

  const openAdd = (): void => { setAddSessionId((n) => n + 1); setEditingPrinter(undefined); setMode('form'); };
  const openEdit = (printer: Printer): void => { setEditingPrinter(printer); setMode('form'); };
  const backToList = (): void => setMode('list');
  const onSaved = (): void => { setMode('list'); reload(); };

  useEffect(() => {
    if (!(isPhone && mode === 'form')) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setMode('list'); return true; });
    return () => sub.remove();
  }, [isPhone, mode]);

  const formKey = editingPrinter?.id ?? `add-${addSessionId}`;

  if (isPhone && mode === 'form') {
    return <AddPrinterForm key={formKey} visible initialValues={editingPrinter} onSaved={onSaved} onBack={backToList} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall">Quản lý máy in</Text>
        <AppButton label="Thêm máy in" onPress={openAdd} />
      </View>
      <PrinterList printers={printers} actions={actions} onEdit={openEdit} />
      {!isPhone && (
        <AddPrinterModal key={formKey} visible={mode === 'form'} initialValues={editingPrinter} onDismiss={backToList} onSaved={onSaved} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
```

- [ ] **Step 4: SP-B debt — `useAddPrinterFlow.test.tsx` capture-arg**

Trong mock `jest.mock('../useBillImageCapture', ...)`: hoist mock fn ra ngoài factory:
```ts
const captureBillImageMock = jest.fn(() => Promise.resolve(null));
jest.mock('../useBillImageCapture', () => ({
  useBillImageCapture: () => ({ captureNode: null, captureBillImage: captureBillImageMock }),
}));
// beforeEach: captureBillImageMock.mockClear();
```
Thêm test:
```ts
it('runTestPrint(Label) bitmap-mode gọi captureBillImage với media của driver (die_cut)', async () => {
  const { get } = render({ visible: true, initialValues: savedTspl, onSaved: jest.fn() });
  await act(async () => { get().infoCard.onChangeDriverMedia(PrinterDriverType.tspl, { type: 'die_cut' }); });
  await act(async () => { await get().infoCard.onTestPrintLabel(); });
  expect(captureBillImageMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'die_cut', columns: expect.any(Number) }));
});
```
(`savedTspl` driver renderMode phải là `bitmap` cho nhánh này — nếu fixture đang `truetype`, dùng `bitmapTspl` fixture hoặc `onSelectTsplRenderMode('bitmap')` trước.)

- [ ] **Step 5: `ARCHITECTURE.md`**

`src/features/printer/ARCHITECTURE.md` ~dòng 451 (`grep -n "paperSize: 58" src/features/printer/ARCHITECTURE.md`): shape `Printer` bỏ `paperSize: 58 | 80`, thêm `capabilities: PrinterCapabilities` và ghi `media: PrintMedia` nằm trong mỗi `PrinterDriver.config` (không phải trên `Printer`). Sửa mọi câu văn xung quanh nhắc "khổ giấy của máy in" → "khổ giấy của driver".

- [ ] **Step 6: Verify + commit**

Run: `npm run type-check` sạch + `npx jest` xanh + `npm run lint` 0 error.
Test tay (ghi vào report, không tự chạy được): trên emulator phone → "Thêm máy in" mở inline, nút back vật lý về list; trên tablet → Modal.
```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: AddPrinterForm inline trên điện thoại + AddPrinterModal wrapper (SP-C t5)

- tách AddPrinterForm khỏi AddPrinterModal; Modal thành wrapper mỏng
- PrinterManagementPanel: useLayoutMode → phone render form inline + BackHandler; tablet giữ Modal
- SP-B debt: useAddPrinterFlow capture-arg assertion; ARCHITECTURE.md paperSize → media

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec § | Task |
|--------|------|
| §2 `setDriverMedia` | T2 |
| §3.1 bỏ `paperSize` RHF | T1 (schema) + T3 (form defaultValue) + T4 (Controller) |
| §3.2 media section per-driver | T4 (`DriverMediaSection`) |
| §3.3 chuyển giá trị khi đổi type | T3 (`onChangeDriverMedia` auto-fill die_cut) |
| §4.1 `PRINTABLE_WIDTH_MM` → paperWidth | T1 Step 1 |
| §4.1 `dieCutRowOverflow` util | T1 Step 4 |
| §4 cross-field schema | T1 Step 8 |
| §4.2 inline warning + saveDisabled | T4 Step 1 (warning trong DriverMediaSection) + T3 Step 5 (saveDisabled) |
| §5.1 `onChangeDriverMedia` | T3 Step 3 |
| §5.2 số hàng + `runTestPrint` | T3 Step 3 + T4 Step 2 |
| §5.3 revert discovery paperSize threading | T3 Step 1-2 |
| §5.4 `onSave` reconnect | T3 Step 4 |
| §6 `PrinterService.testPrint` options | T2 |
| §7.1 `AddPrinterForm` | T5 Step 1 |
| §7.2 `AddPrinterModal` wrapper | T5 Step 2 |
| §7.3 `PrinterManagementPanel` inline + BackHandler | T5 Step 3 |
| §8 SP-B debt (capture-arg test, ARCHITECTURE.md) | T5 Step 4-5 |
| §9 testing | rải khắp |

Không gap.

**2. Placeholder scan:** Không "TBD"/"handle edge cases". "PLAN CORRECTION" ở T4 Step 2 là 1 chỉnh sửa tường minh trỏ ngược T3 Step 5 (reviewer T3 phải kiểm) — không phải placeholder. Snippet có code thật.

**3. Type consistency:**
- `dieCutRowOverflow(media): string | null` — T1, dùng T1 (schema) + T4 (`DriverMediaSection`) + T3 (`saveDisabled` qua PLAN CORRECTION).
- `PRINTABLE_WIDTH_MM` — T1 chuyển sang `paperWidth.ts`, dùng T1 (`mediaValidation`, `TsplEncoder` import). Nhất quán.
- `setDriverMedia(printerId, driverType, patch)` — T2, dùng T3 (`onChangeDriverMedia`).
- `testPrint(..., options?)` — T2, dùng T3 (`runTestPrint`).
- `onChangeDriverMedia` / `testPrintRowsText` / `onTestPrintRowsChange` / `hasTsplDriver` — T3 return, đọc T4 (`PrinterInfoCardProps`).
- `DriverMediaSectionProps { driverType, media, disabled, onChange }` — T4, chỉ dùng nội bộ `PrinterInfoCard`.
- `AddPrinterFormProps { visible, initialValues, onSaved, onBack }` — T5, dùng `AddPrinterModal` + `PrinterManagementPanel`.
- `printerDisplaySchema` = `{ name }` / `PrinterDisplayValues = { name }` — T1, đọc T3 (defaultValues), T4 (`control` typing).

---

## Execution Handoff

Sau khi lưu plan, chọn cách thực thi.
