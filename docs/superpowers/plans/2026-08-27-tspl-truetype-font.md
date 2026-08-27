# TSPL TrueType Font Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a switchable, experimental TrueType-font render mode to the TSPL driver — bitmap stays the default and the only verified path; TrueType is opt-in per printer and falls back to bitmap on any failure.

**Architecture:** `TsplDriverConfig.renderMode` gains a `'truetype'` value alongside the existing `'bitmap'`. A new `TsplFontManager` performs the one-time `DOWNLOAD` of a bundled `.ttf` font to the printer (via `react-native-fs` reading an Android asset) — it only executes the action and reports success/failure; the caller (UI state) decides what `renderMode`/`font.fontInstalled` becomes. `TsplDriver.encode()` resolves an *effective* render mode from `renderMode` + `font.fontInstalled` on every call — never trusting `renderMode` alone — so a half-configured or failed font install can never produce anything but the proven bitmap path.

**Tech Stack:** React Native CLI, TypeScript strict, `react-native-fs` (new dependency, Android-only usage), existing `TsplEncoder`/`TsplDriver`.

**Spec:** `docs/superpowers/specs/2026-08-27-tspl-truetype-font-design.md` — this plan implements that spec section-by-section; read both together.

## Global Constraints

- TrueType is optional/experimental — a failure anywhere in its path (invalid font name, install failure, unsupported platform) must NEVER fail a print job. Bitmap is the hard fallback (spec §7's table is the source of truth).
- `TsplFontManager.ensureFontInstalled` only performs the DOWNLOAD action (resolve/throw) — it never mutates `renderMode`/`fontInstalled` itself. The caller (UI) owns that decision (spec §6).
- `font.name` must match `/^[A-Za-z0-9_-]+$/` before any DOWNLOAD attempt — validated before calling `ensureFontInstalled`, not just at persist time.
- `react-native-fs`'s `readFileAssets` is Android-only — `TsplFontManager` must reject with `UNSUPPORTED_CONNECTION` on any other platform, matching the existing USB-Android-only precedent in this codebase.
- The actual `.ttf` font file cannot be produced by an implementer subagent (it's a binary asset requiring manual download) — Task 1 flags this explicitly as a manual step for the human operator, not something to fake or skip silently.
- DOWNLOAD command syntax (`DOWNLOAD "<name>",<byteCount>` + raw bytes) is UNVERIFIED on real hardware — every task touching it must say so in comments, not assert it as proven.
- This plan continues on the existing `refactor/printer-architecture` branch (per user decision) — do not create a new branch.

---

### Task 1: Add `react-native-fs` dependency + font asset (manual step required)

**Files:**
- Modify: `package.json` (add dependency)
- Create (MANUAL, cannot be done by an implementer subagent — see Step 2): `android/app/src/main/assets/fonts/NotoSans-Regular.ttf`

**Interfaces:**
- Produces: the `react-native-fs` package importable as `import RNFS from 'react-native-fs';`, and a real Android asset at `fonts/NotoSans-Regular.ttf` readable via `RNFS.readFileAssets('fonts/NotoSans-Regular.ttf', 'base64')`.

- [ ] **Step 1: Install the dependency**

Run: `npm install react-native-fs`

Since this project uses React Native 0.86 (New Architecture), no manual native linking step is needed for Android via autolinking — but a native rebuild IS required for the new module to be available:

Run: `cd android && ./gradlew clean && cd ..` (clears any stale autolinking cache), then the next `npm run android` will pick up the new native module.

- [ ] **Step 2: STOP — manual step, do not fake this**

This implementer (whether human or subagent) cannot fetch a real binary `.ttf` file through this plan's tooling. **A human operator must**:
1. Download a real Noto Sans Regular TTF file (e.g. from Google Fonts: https://fonts.google.com/noto/specimen/Noto+Sans — or substitute any `.ttf` with full Vietnamese Unicode coverage).
2. Create the directory `android/app/src/main/assets/fonts/` if it doesn't exist.
3. Place the file there named exactly `NotoSans-Regular.ttf`.

**If you are an implementer subagent and this file does not exist when you reach this step, STOP and report BLOCKED** — do not create a placeholder/empty file, do not skip this task, and do not invent font bytes. Report back to the controller that this manual step is outstanding and wait for it to be completed before continuing to any task that depends on the font actually existing (Tasks 5+).

- [ ] **Step 3: Verify the asset is readable (only after Step 2 is genuinely done)**

This can only be verified by running the app on an Android device/emulator (not via `npm test`, since `react-native-fs`'s native module isn't available in the Jest environment without mocking — Task 5 covers mocking it for unit tests). Manual verification: add a temporary `console.log` in any screen that calls `RNFS.readFileAssets('fonts/NotoSans-Regular.ttf', 'base64').then(b64 => console.log('font bytes:', b64.length))`, run the app, confirm a large positive number logs (a real Noto Sans TTF is typically 200-600 KB, so the base64 string length should be in the hundreds of thousands of characters). Remove the temporary log afterward. If this step cannot be run (no device/emulator), note it as unverified and move on — later tasks' unit tests use a mocked `RNFS`, not the real one.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(printer): add react-native-fs dependency for TSPL font asset reading"
```

(The font file itself, once placed by the human operator, should be committed separately — binary asset, not generated by this task's automated steps. If Step 2 was completed before this commit, `git add android/app/src/main/assets/fonts/NotoSans-Regular.ttf` too and mention it in the commit message.)

---

### Task 2: `types/printer.types.ts` — `TsplFontConfig` + extended `TsplRenderMode`

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`

**Interfaces:**
- Produces: `TsplRenderMode` (now `'bitmap' | 'truetype'`), `TsplFontConfig`, updated `TsplDriverConfig` — every later task imports these.

- [ ] **Step 1: Update the file**

Find the existing block:

```ts
export type TsplRenderMode = 'bitmap';

export interface TsplDriverConfig {
  type: 'tspl';
  renderMode: TsplRenderMode;
  labelHeightMm?: number;
}
```

Replace with:

```ts
export type TsplRenderMode = 'bitmap' | 'truetype';

export interface TsplFontConfig {
  /**
   * Tên logical dùng trong CẢ lệnh `DOWNLOAD "<name>",...` (tên file lưu
   * trên máy in) LẪN lệnh `TEXT x,y,"<name>",...` (chọn font khi in) —
   * hai lệnh này dùng chung 1 định danh theo tài liệu TSPL2 phổ biến.
   * Phải khớp `/^[A-Za-z0-9_-]+$/` để không tạo command TSPL hỏng nếu
   * chứa dấu ngoặc kép/ký tự đặc biệt.
   */
  name: string;
  /** Tên file `.ttf` trong `android/app/src/main/assets/fonts/` — CHỈ dùng để đọc byte qua `RNFS.readFileAssets`, không gửi lên máy in. */
  fileName: string;
  /**
   * Chỉ nghĩa "lệnh DOWNLOAD đã gửi xong không lỗi ở tầng transport" —
   * KHÔNG đảm bảo máy in thật sự lưu/nhận diện được font (không có cách
   * nào từ phần mềm xác nhận điều đó, tương tự giới hạn identityKey USB).
   */
  fontInstalled: boolean;
}

export interface TsplDriverConfig {
  type: 'tspl';
  /** Mặc định 'bitmap' — hành vi đã verify trên phần cứng thật. 'truetype' là thử nghiệm, xem spec 2026-08-27. */
  renderMode: TsplRenderMode;
  /** Chỉ có khi renderMode từng được đặt 'truetype' ít nhất 1 lần. */
  font?: TsplFontConfig;
  labelHeightMm?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/printer/types/printer.types.ts
git commit -m "feat(printer): add TsplFontConfig, extend TsplRenderMode with 'truetype'"
```

---

### Task 3: `schemas/printerFormSchema.ts` — validate `font.name` and the extended `renderMode`

**Files:**
- Modify: `src/features/printer/schemas/printerFormSchema.ts`
- Test: `src/features/printer/schemas/__tests__/printerFormSchema.test.ts`

**Interfaces:**
- Consumes: `TsplFontConfig`, `TsplRenderMode` (Task 2).
- Produces: updated `tsplDriverConfigSchema` (exported as part of the existing `printerDriverConfigSchema` discriminated union) — used by `printerSchema` (already existing, safety-net validation in `PrinterService`).

- [ ] **Step 1: Write the failing tests**

Add these `it(...)` blocks inside the existing `describe('printerDriverSchema', ...)` block (or a new `describe('tsplDriverConfigSchema via printerDriverSchema', ...)` block — your choice, keep it near the existing TSPL-related tests):

```ts
it('accepts a tspl driver with renderMode bitmap and no font', () => {
  const driver: PrinterDriver = { type: 'tspl', source: 'auto', contentTypes: ['Label'], config: { type: 'tspl', renderMode: 'bitmap' } };
  expect(printerDriverSchema.safeParse(driver).success).toBe(true);
});

it('accepts a tspl driver with renderMode truetype and a valid font config', () => {
  const driver: PrinterDriver = {
    type: 'tspl', source: 'auto', contentTypes: ['Label'],
    config: { type: 'tspl', renderMode: 'truetype', font: { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
  };
  expect(printerDriverSchema.safeParse(driver).success).toBe(true);
});

it('rejects a font name containing invalid characters', () => {
  const driver: PrinterDriver = {
    type: 'tspl', source: 'auto', contentTypes: ['Label'],
    config: { type: 'tspl', renderMode: 'truetype', font: { name: 'VIET FONT"', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
  };
  expect(printerDriverSchema.safeParse(driver).success).toBe(false);
});

it('rejects an empty font name', () => {
  const driver: PrinterDriver = {
    type: 'tspl', source: 'auto', contentTypes: ['Label'],
    config: { type: 'tspl', renderMode: 'truetype', font: { name: '', fileName: 'NotoSans-Regular.ttf', fontInstalled: true } },
  };
  expect(printerDriverSchema.safeParse(driver).success).toBe(false);
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- printerFormSchema.test.ts`
Expected: FAIL — `renderMode: 'truetype'` and the `font` field are currently rejected/stripped by the schema (schema only allows the literal `'bitmap'` today).

- [ ] **Step 3: Implement**

Find the existing block in `printerFormSchema.ts`:

```ts
const tsplDriverConfigSchema = z.object({
  type: z.literal('tspl'),
  renderMode: z.literal('bitmap'),
  labelHeightMm: z.number().positive().optional(),
});
```

Replace with:

```ts
const tsplFontConfigSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]+$/, 'Tên font chỉ được chứa chữ, số, gạch dưới, gạch ngang'),
  fileName: z.string().min(1),
  fontInstalled: z.boolean(),
});

const tsplDriverConfigSchema = z.object({
  type: z.literal('tspl'),
  renderMode: z.enum(['bitmap', 'truetype']),
  font: tsplFontConfigSchema.optional(),
  labelHeightMm: z.number().positive().optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- printerFormSchema.test.ts`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/schemas/printerFormSchema.ts src/features/printer/schemas/__tests__/printerFormSchema.test.ts
git commit -m "feat(printer): validate TSPL font name and extended renderMode via Zod"
```

---

### Task 4: `drivers/tspl/TsplEncoder.ts` — `text()` accepts a font name

**Files:**
- Modify: `src/features/printer/drivers/tspl/TsplEncoder.ts`
- Test: `src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts`

**Interfaces:**
- Produces: `TsplEncoder.text(x, y, content, fontName?)` — `fontName` defaults to `'3'` (today's hardcoded built-in bitmap font), so every existing call site (`encoder.text(x, y, content)`, no 4th arg) keeps identical behavior. `drivers/tspl/TsplDriver.ts` (Task 6) is the only caller that will ever pass a real custom font name.

- [ ] **Step 1: Write the failing test**

Add to the existing test file:

```ts
it('text() uses the given fontName instead of the built-in "3" when provided', () => {
  const encoder = new TsplEncoder();
  encoder.text(0, 0, 'Trà sữa', 'VIETFONT');
  const bytes = encoder.encode();
  const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
  expect(ascii).toContain('"VIETFONT"');
});

it('text() still defaults to font "3" when no fontName is given (unchanged behavior)', () => {
  const encoder = new TsplEncoder();
  encoder.text(0, 0, 'Trà sữa');
  const bytes = encoder.encode();
  const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
  expect(ascii).toContain('"3"');
});
```

- [ ] **Step 2: Run to confirm the first test fails**

Run: `npm test -- TsplEncoder.test.ts`
Expected: the new "uses the given fontName" test FAILS (current `text()` always hardcodes `"3"`); the "still defaults" test already PASSES (no regression yet).

- [ ] **Step 3: Implement**

Find:

```ts
text(x: number, y: number, content: string): this {
  const escaped = content.replace(/"/g, '\\"');
  this.pushLine(`TEXT ${x},${y},"3",0,1,1,"${escaped}"`);
  return this;
}
```

Replace with:

```ts
text(x: number, y: number, content: string, fontName: string = '3'): this {
  const escaped = content.replace(/"/g, '\\"');
  this.pushLine(`TEXT ${x},${y},"${fontName}",0,1,1,"${escaped}"`);
  return this;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TsplEncoder.test.ts`
Expected: PASS (all tests, both new ones plus every pre-existing one — pre-existing tests never pass a 4th argument, so they exercise the unchanged default)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/drivers/tspl/TsplEncoder.ts src/features/printer/drivers/tspl/__tests__/TsplEncoder.test.ts
git commit -m "feat(printer): TsplEncoder.text() accepts an optional custom font name"
```

---

### Task 5: `drivers/tspl/TsplFontManager.ts` — new (DOWNLOAD action, no state)

**Files:**
- Create: `src/features/printer/drivers/tspl/TsplFontManager.ts`
- Test: `src/features/printer/drivers/tspl/__tests__/TsplFontManager.test.ts`

**Interfaces:**
- Consumes: `TsplFontConfig` (Task 2), `TsplTransport` (exported from Task 6 — since Task 6 also needs to import `TsplFontManager`, implement Task 6's `export type TsplTransport = ...;` line FIRST if working strictly in order, or implement both together; the type itself is trivial — see Task 6's Step 1 for its exact definition, `LanTransport | BluetoothTransport | UsbTransport`).
- Produces: `TsplFontManager` class with `ensureFontInstalled(transport, font): Promise<void>`, and `DEFAULT_TSPL_FONT: TsplFontConfig` constant — consumed by `TsplDriver.ts` (Task 6) and `AddPrinterModal.tsx` (Task 9).

This is the ONE place that reads the real font file and builds the `DOWNLOAD` command — genuinely unverified against real hardware, say so in the file's doc comment.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/drivers/tspl/__tests__/TsplFontManager.test.ts
import { Platform } from 'react-native';
import { TsplFontManager, DEFAULT_TSPL_FONT } from '../TsplFontManager';
import { AppErrorException } from '../../../types/AppError';

jest.mock('react-native-fs', () => ({
  readFileAssets: jest.fn(),
}));

const makeTransport = (overrides: Partial<{ write: jest.Mock }> = {}) => ({
  write: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('TsplFontManager.ensureFontInstalled', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { get: () => originalOS });
  });

  it('rejects with UNSUPPORTED_CONNECTION on non-Android platforms', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios' });
    const manager = new TsplFontManager();
    const transport = makeTransport();
    await expect(manager.ensureFontInstalled(transport as never, DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: 'UNSUPPORTED_CONNECTION',
    });
    expect(transport.write).not.toHaveBeenCalled();
  });

  it('reads the font asset as base64 and writes a DOWNLOAD command containing the font name and byte count', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const RNFS = jest.requireMock('react-native-fs') as { readFileAssets: jest.Mock };
    RNFS.readFileAssets.mockResolvedValue(Buffer.from('fake-font-bytes').toString('base64'));
    const manager = new TsplFontManager();
    const transport = makeTransport();

    await manager.ensureFontInstalled(transport as never, DEFAULT_TSPL_FONT);

    expect(RNFS.readFileAssets).toHaveBeenCalledWith(`fonts/${DEFAULT_TSPL_FONT.fileName}`, 'base64');
    expect(transport.write).toHaveBeenCalledTimes(1);
    const bytes = transport.write.mock.calls[0][0] as Uint8Array;
    const ascii = Array.from(bytes.slice(0, 60)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain(`DOWNLOAD "${DEFAULT_TSPL_FONT.name}",15`); // 'fake-font-bytes' is 15 bytes
  });

  it('rejects with VALIDATION_ERROR when the font asset cannot be read', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const RNFS = jest.requireMock('react-native-fs') as { readFileAssets: jest.Mock };
    RNFS.readFileAssets.mockRejectedValue(new Error('file not found'));
    const manager = new TsplFontManager();
    const transport = makeTransport();

    await expect(manager.ensureFontInstalled(transport as never, DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(transport.write).not.toHaveBeenCalled();
  });

  it('rejects with CONNECTION_ERROR when the transport write fails', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const RNFS = jest.requireMock('react-native-fs') as { readFileAssets: jest.Mock };
    RNFS.readFileAssets.mockResolvedValue(Buffer.from('x').toString('base64'));
    const manager = new TsplFontManager();
    const transport = makeTransport({ write: jest.fn().mockRejectedValue(new Error('socket closed')) });

    await expect(manager.ensureFontInstalled(transport as never, DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: 'CONNECTION_ERROR',
    });
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- TsplFontManager.test.ts`
Expected: FAIL with "Cannot find module '../TsplFontManager'"

- [ ] **Step 3: Implement**

```ts
// src/features/printer/drivers/tspl/TsplFontManager.ts
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { AppErrorException } from '../../types/AppError';
import type { TsplFontConfig } from '../../types/printer.types';
import type { TsplTransport } from './TsplDriver';

/** Font mặc định bundle sẵn trong app — chỉ 1 font ở phase này, xem spec §4/§10. */
export const DEFAULT_TSPL_FONT: TsplFontConfig = {
  name: 'VIETFONT',
  fileName: 'NotoSans-Regular.ttf',
  fontInstalled: false,
};

/**
 * Cài font TrueType lên máy in TSPL qua lệnh `DOWNLOAD` — cú pháp theo tài
 * liệu TSPL2 phổ biến (`DOWNLOAD "<name>",<byteCount>` + byte nhị phân thô
 * theo sau), CHƯA xác nhận trên phần cứng thật (xem spec 2026-08-27 §2).
 *
 * CHỈ chịu trách nhiệm THỰC HIỆN hành động gửi (resolve/throw) — KHÔNG tự
 * quyết định `renderMode`/`fontInstalled` sau khi xong, đó là việc của
 * caller (xem spec §6). Đọc file font qua `react-native-fs` — chỉ hoạt
 * động trên Android (asset ở `android/app/src/main/assets/fonts/`), giống
 * giới hạn USB-chỉ-Android đã có trong module này.
 */
export class TsplFontManager {
  async ensureFontInstalled(transport: TsplTransport, font: TsplFontConfig): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: 'Cài font TrueType chỉ hỗ trợ trên Android' });
    }

    let base64: string;
    try {
      base64 = await RNFS.readFileAssets(`fonts/${font.fileName}`, 'base64');
    } catch {
      throw new AppErrorException({ code: 'VALIDATION_ERROR', message: `Không đọc được file font "${font.fileName}" từ assets` });
    }

    const fontBytes = Buffer.from(base64, 'base64');
    const header = Buffer.from(`DOWNLOAD "${font.name}",${fontBytes.length}\r\n`, 'utf8');
    const footer = Buffer.from('\r\n', 'utf8');
    const payload = new Uint8Array(Buffer.concat([header, fontBytes, footer]));

    try {
      await transport.write(payload);
    } catch (error) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- TsplFontManager.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/drivers/tspl/TsplFontManager.ts src/features/printer/drivers/tspl/__tests__/TsplFontManager.test.ts
git commit -m "feat(printer): add TsplFontManager (DOWNLOAD action only, no state mutation)"
```

---

### Task 6: `drivers/tspl/TsplDriver.ts` — wire font manager, effective render mode, `installTrueTypeFont`

**Files:**
- Modify: `src/features/printer/drivers/tspl/TsplDriver.ts`
- Test: `src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `TsplFontManager`, `DEFAULT_TSPL_FONT` (Task 5 — circular with Task 5's own dependency on this file's `TsplTransport` type; implement the `export type TsplTransport = ...` line first, then both files compile against each other).
- Produces: `TsplDriver.installTrueTypeFont(printerId, font): Promise<void>` — consumed by `printing/PrinterService.ts` (Task 7). Updated `encode()` behavior — consumed nowhere new, but must not regress existing bitmap-mode callers.

- [ ] **Step 1: Export the `TsplTransport` type**

Find:

```ts
type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;
```

Change to:

```ts
export type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;
```

- [ ] **Step 2: Write the failing tests**

Add these to the existing test file (import `PrinterDriver`'s `config` shape already used elsewhere in this file for `tsplDriverEntry`):

```ts
import { TsplFontManager, DEFAULT_TSPL_FONT } from '../TsplFontManager';

jest.mock('../TsplFontManager');

// ... inside describe('TsplDriver', () => { ... }), add:

describe('TsplDriver.installTrueTypeFont', () => {
  it('delegates to TsplFontManager.ensureFontInstalled using the connected transport', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanPrinter, tsplDriverEntry);
    const ensureFontInstalledMock = (TsplFontManager as jest.Mock).mock.instances[0].ensureFontInstalled as jest.Mock;
    ensureFontInstalledMock.mockResolvedValue(undefined);

    await driver.installTrueTypeFont(lanPrinter.id, DEFAULT_TSPL_FONT);

    expect(ensureFontInstalledMock).toHaveBeenCalledWith(expect.anything(), DEFAULT_TSPL_FONT);
  });

  it('throws CONNECTION_ERROR when the printer is not connected', async () => {
    const driver = new TsplDriver();
    await expect(driver.installTrueTypeFont('never-connected', DEFAULT_TSPL_FONT)).rejects.toMatchObject({
      code: 'CONNECTION_ERROR',
    });
  });
});

describe('TsplDriver renderMode resolution (via encode())', () => {
  it('encode() uses bitmap (image variant) when renderMode is bitmap, ignoring any font config', () => {
    const driver = new TsplDriver();
    const driverWithFont: PrinterDriver = {
      ...tsplDriverEntry,
      config: { type: 'tspl', renderMode: 'bitmap', font: { ...DEFAULT_TSPL_FONT, fontInstalled: true } },
    };
    const withImage = { text: sampleDocuments.text, image: { elements: [{ type: 'image' as const, data: 'AAAA', x: 0, y: 0 }] } };
    const bytes = driver.encode(lanPrinter, driverWithFont, withImage);
    const ascii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('BITMAP');
  });

  it('encode() uses truetype (text variant + custom font name) only when renderMode is truetype AND font.fontInstalled is true', () => {
    const driver = new TsplDriver();
    const driverWithInstalledFont: PrinterDriver = {
      ...tsplDriverEntry,
      config: { type: 'tspl', renderMode: 'truetype', font: { ...DEFAULT_TSPL_FONT, fontInstalled: true } },
    };
    const bytes = driver.encode(lanPrinter, driverWithInstalledFont, sampleDocuments);
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain(`"${DEFAULT_TSPL_FONT.name}"`);
    expect(ascii).not.toContain('BITMAP');
  });

  it('encode() falls back to bitmap when renderMode is truetype but font.fontInstalled is false', () => {
    const driver = new TsplDriver();
    const driverWithUninstalledFont: PrinterDriver = {
      ...tsplDriverEntry,
      config: { type: 'tspl', renderMode: 'truetype', font: { ...DEFAULT_TSPL_FONT, fontInstalled: false } },
    };
    const withImage = { text: sampleDocuments.text, image: { elements: [{ type: 'image' as const, data: 'AAAA', x: 0, y: 0 }] } };
    const bytes = driver.encode(lanPrinter, driverWithUninstalledFont, withImage);
    const ascii = Array.from(bytes.slice(0, 200)).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('BITMAP');
  });

  it('encode() falls back to bitmap when renderMode is truetype but no font config exists at all', () => {
    const driver = new TsplDriver();
    const driverNoFont: PrinterDriver = { ...tsplDriverEntry, config: { type: 'tspl', renderMode: 'truetype' } };
    const bytes = driver.encode(lanPrinter, driverNoFont, sampleDocuments);
    const ascii = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    expect(ascii).toContain('"3"'); // built-in bitmap font, the bitmap-mode default
  });
});
```

(`sampleDocuments`/`lanPrinter`/`tsplDriverEntry` already exist in this test file from Task 12 of the printer-architecture-refactor plan — reuse them, don't redefine.)

- [ ] **Step 3: Run to confirm failures**

Run: `npm test -- TsplDriver.test.ts`
Expected: FAIL — `installTrueTypeFont` doesn't exist yet; `encode()` doesn't yet branch on `renderMode`/`font.fontInstalled`.

- [ ] **Step 4: Implement**

Add the import at the top of `TsplDriver.ts`:

```ts
import { TsplFontManager } from './TsplFontManager';
```

Add a private field to the class:

```ts
private fontManager = new TsplFontManager();
```

Add this method to the `TsplDriver` class (anywhere among the public methods, e.g. right after `identify()`):

```ts
async installTrueTypeFont(printerId: string, font: TsplFontConfig): Promise<void> {
  const transport = this.connections.get(printerId);
  if (!transport) {
    throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
  }
  await this.fontManager.ensureFontInstalled(transport, font);
}
```

Add the `TsplFontConfig` import to the type-only import line that already brings in `Printer`/`PrinterDriver`/etc:

```ts
import type { ConnectionType, DeviceScanEvent, Printer, PrinterDeviceInfo, PrinterDriver, PrinterStatus, TsplFontConfig } from '../../types/printer.types';
```

Add this private method (place it right before `encode()`):

```ts
/**
 * `truetype` chỉ có hiệu lực khi `renderMode === 'truetype'` VÀ
 * `font.fontInstalled === true` — mọi trường hợp khác (chưa cài, cài
 * thất bại, không có config font) đều fallback `'bitmap'`. Fallback CỨNG,
 * không có nhánh nào khác — xem spec 2026-08-27 §7.
 */
private resolveDocumentAndFont(driver: PrinterDriver, documents: PrintDocumentVariants): { document: PrintDocument; fontName: string } {
  const config = driver.config;
  if (config.type === 'tspl' && config.renderMode === 'truetype' && config.font?.fontInstalled) {
    return { document: documents.text, fontName: config.font.name };
  }
  return { document: documents.image ?? documents.text, fontName: '3' };
}
```

Replace the existing `encode()` method:

```ts
encode(printer: Printer, driver: PrinterDriver, documents: PrintDocumentVariants, printType?: PrintType): Uint8Array {
  const heightMm = resolveHeightMm(driver, printType);
  const { document, fontName } = this.resolveDocumentAndFont(driver, documents);
  const encoder = new TsplEncoder().initialize(printer.paperSize, printType, heightMm);
  this.encodeElements(encoder, document, printer.paperSize, heightMm, fontName);
  return encoder.cut().encode();
}
```

Update `encodeElements`'s signature and its `text()`/`line`/`row` call sites to pass `fontName` through:

```ts
private encodeElements(
  encoder: TsplEncoder,
  document: PrintDocument,
  paperSize: Printer['paperSize'],
  heightMm: number,
  fontName: string,
): void {
  const paperWidth = PAPER_WIDTH_CHARS[paperSize];
  for (const element of document.elements) {
    if (element.type === 'text') {
      encoder.text(element.x, element.y, element.content, fontName);
    } else if (element.type === 'line') {
      encoder.text(element.x, element.y, '-'.repeat(paperWidth), fontName);
    } else if (element.type === 'table') {
      element.rows.forEach((row, i) => encoder.text(element.x, element.y + i * 20, row.join('  '), fontName));
    } else if (element.type === 'row') {
      encoder.text(element.x, element.y, formatRow(element.left, element.right, paperWidth), fontName);
    } else if (element.type === 'image') {
      const bitmap = decodePngBase64ToMonochrome(element.data, PAPER_IMAGE_WIDTH_PX[paperSize]);
      const maxHeightPx = heightMm * DOTS_PER_MM;
      if (bitmap.heightPx > maxHeightPx) {
        throw new AppErrorException({
          code: 'ENCODING_FAILED',
          message: `Nội dung cao khoảng ${Math.ceil(bitmap.heightPx / DOTS_PER_MM)}mm, vượt khổ giấy đang khai báo (${heightMm}mm) — dùng giấy dài hơn hoặc rút gọn nội dung.`,
        });
      }
      encoder.image(element.x, element.y, bitmap);
    } else if (element.type === 'barcode') {
      encoder.barcode(element.x, element.y, element.content);
    } else if (element.type === 'qrCode') {
      encoder.qrcode(element.x, element.y, element.content);
    } else {
      throw new AppErrorException({ code: 'ENCODING_FAILED', message: `Loại nội dung in không được hỗ trợ: ${(element as { type: string }).type}` });
    }
  }
}
```

Find every OTHER call site of `this.encodeElements(...)` in this file (inside `testPrint()`'s and `print()`'s bodies now call `this.encode(...)` already per the current file's structure from the printer-architecture-refactor plan — if `encode()` is the only caller of `encodeElements`, no other call sites need updating; verify this by searching the file for `encodeElements(` before editing).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- TsplDriver.test.ts`
Expected: PASS (all pre-existing tests plus the new ones — pre-existing tests never set `renderMode: 'truetype'`, so they all exercise the unchanged bitmap default path)

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/drivers/tspl/TsplDriver.ts src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts
git commit -m "feat(printer): TsplDriver resolves effective render mode with hard bitmap fallback"
```

---

### Task 7: `printing/PrinterService.ts` — `installTsplFont` passthrough

**Files:**
- Modify: `src/features/printer/printing/PrinterService.ts`
- Test: `src/features/printer/printing/__tests__/PrinterService.test.ts`

**Interfaces:**
- Consumes: `TsplDriver.installTrueTypeFont` (Task 6), `TsplFontConfig` (Task 2).
- Produces: `PrinterService.installTsplFont(printerId, font): Promise<void>` — consumed by `AddPrinterModal.tsx` (Task 9). This is a TSPL-specific method, NOT part of the generic `IPrinterDriver` interface (ESC/POS has no font-install concept).

- [ ] **Step 1: Write the failing test**

```ts
// add to the existing describe('PrinterService', ...) block
it('installTsplFont() delegates to the tspl driver instance directly (not through the generic IPrinterDriver interface)', async () => {
  const tsplDriver = { ...makeMockDriver(), installTrueTypeFont: jest.fn().mockResolvedValue(undefined) };
  const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver as never }, createResourceLock());
  const font = { name: 'VIETFONT', fileName: 'NotoSans-Regular.ttf', fontInstalled: false };

  await service.installTsplFont('p1', font);

  expect(tsplDriver.installTrueTypeFont).toHaveBeenCalledWith('p1', font);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test -- printing/__tests__/PrinterService.test.ts`
Expected: FAIL with "service.installTsplFont is not a function"

- [ ] **Step 3: Implement**

Add the import at the top of `PrinterService.ts`:

```ts
import type { TsplDriver } from '../drivers/tspl/TsplDriver';
import type { TsplFontConfig } from '../types/printer.types';
```

Add this function inside `createPrinterService`, near `discoverDriver`:

```ts
/**
 * Passthrough TSPL-riêng — KHÔNG đưa vào `IPrinterDriver` chung vì tính
 * năng này chỉ có nghĩa với TSPL, ESC/POS không có khái niệm font custom.
 * Cast trực tiếp sang `TsplDriver` vì `registry.tspl` luôn là instance đó.
 */
const installTsplFont = async (printerId: string, font: TsplFontConfig): Promise<void> => {
  const tsplDriver = getDriver('tspl') as TsplDriver;
  await tsplDriver.installTrueTypeFont(printerId, font);
};
```

Add `installTsplFont` to the returned object at the bottom of `createPrinterService`, alongside the other exported functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- printing/__tests__/PrinterService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/printing/PrinterService.ts src/features/printer/printing/__tests__/PrinterService.test.ts
git commit -m "feat(printer): add PrinterService.installTsplFont passthrough"
```

---

### Task 8: `components/PrinterInfoCard.tsx` — TrueType switch (no dedicated test file, per project convention)

**Files:**
- Modify: `src/features/printer/components/PrinterInfoCard.tsx`

**Interfaces:**
- Consumes: `TsplFontConfig` (Task 2).
- Produces: new props `onToggleTsplFont: (enabled: boolean) => void`, `tsplFontPending: boolean` — consumed by `AddPrinterModal.tsx` (Task 9).

- [ ] **Step 1: Update the props interface**

Find:

```tsx
export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: ConnectionType;
  drivers: PrinterDriver[];
  onUpdateDriverContentTypes: (type: PrinterDriverType, contentTypes: PrintType[]) => void;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  testPrintReceiptPending: boolean;
  onTestPrintReceipt: () => void;
  testPrintLabelPending: boolean;
  onTestPrintLabel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}
```

Add two new props:

```tsx
export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: ConnectionType;
  drivers: PrinterDriver[];
  onUpdateDriverContentTypes: (type: PrinterDriverType, contentTypes: PrintType[]) => void;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  testPrintReceiptPending: boolean;
  onTestPrintReceipt: () => void;
  testPrintLabelPending: boolean;
  onTestPrintLabel: () => void;
  /** Bật/tắt renderMode truetype cho driver TSPL (chỉ có ý nghĩa khi có driver type 'tspl' trong `drivers`). */
  onToggleTsplFont: (enabled: boolean) => void;
  /** true trong lúc đang chạy `ensureFontInstalled` — vô hiệu hoá switch để tránh double-tap. */
  tsplFontPending: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
}
```

- [ ] **Step 2: Update the function signature to destructure the new props**

Find the destructuring in the component's parameter list and add `onToggleTsplFont, tsplFontPending,` alongside the existing props (insert after `onTestPrintLabel,` and before `onSave,`).

- [ ] **Step 3: Replace the static TSPL render-mode line with a switch**

Find:

```tsx
{driver.type === 'tspl' ? <Text variant="bodySmall" style={styles.renderModeLabel}>Chế độ render: Bitmap</Text> : null}
```

Replace with:

```tsx
{driver.type === 'tspl' ? (
  <AppSwitch
    label="In bằng font TrueType (thử nghiệm)"
    value={driver.config.type === 'tspl' && driver.config.renderMode === 'truetype'}
    onValueChange={onToggleTsplFont}
    disabled={locked || tsplFontPending}
  />
) : null}
```

- [ ] **Step 4: Type-check + lint**

Run: `npm run type-check && npm run lint`
Expected: type errors in `AddPrinterModal.tsx` (doesn't pass the two new required props yet) — expected until Task 9 lands; confirm THIS file (`PrinterInfoCard.tsx`) itself has no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/components/PrinterInfoCard.tsx
git commit -m "feat(printer): PrinterInfoCard shows a TrueType font switch for TSPL drivers"
```

---

### Task 9: `components/AddPrinterModal.tsx` — wire the TrueType toggle handler

**Files:**
- Modify: `src/features/printer/components/AddPrinterModal.tsx`

**Interfaces:**
- Consumes: `PrinterService.installTsplFont` (Task 7), `DEFAULT_TSPL_FONT` (Task 5), `onToggleTsplFont`/`tsplFontPending` props (Task 8).

- [ ] **Step 1: Add the import**

Add alongside the existing imports:

```tsx
import { DEFAULT_TSPL_FONT } from '../drivers/tspl/TsplFontManager';
```

- [ ] **Step 2: Add pending state**

Add alongside the other `useState` declarations near the top of the component:

```tsx
const [tsplFontPending, setTsplFontPending] = useState(false);
```

- [ ] **Step 3: Add the toggle handler**

Add this function near `onUpdateDriverContentTypes` (reuse the same `setDrivers` pattern already used there):

```tsx
const onToggleTsplFont = async (enabled: boolean): Promise<void> => {
  const tsplDriverEntry = drivers.find((d) => d.type === 'tspl');
  if (!tsplDriverEntry || tsplDriverEntry.config.type !== 'tspl') return;

  if (!enabled) {
    setDrivers((prev) => prev.map((d) => (d.type === 'tspl' && d.config.type === 'tspl' ? { ...d, config: { ...d.config, renderMode: 'bitmap' } } : d)));
    return;
  }

  const font = tsplDriverEntry.config.font ?? DEFAULT_TSPL_FONT;
  setTsplFontPending(true);
  try {
    await PrinterService.installTsplFont(printerId, font);
    setDrivers((prev) =>
      prev.map((d) =>
        d.type === 'tspl' && d.config.type === 'tspl'
          ? { ...d, config: { ...d.config, renderMode: 'truetype', font: { ...font, fontInstalled: true } } }
          : d,
      ),
    );
  } catch (error) {
    setTestPrintErrorMessage(error instanceof AppErrorException ? error.message : 'Cài font TrueType thất bại — vẫn dùng chế độ Bitmap');
    // renderMode stays 'bitmap' (default) — never set to 'truetype' on failure, per spec §6/§7.
  } finally {
    setTsplFontPending(false);
  }
};
```

- [ ] **Step 4: Pass the new props to `PrinterInfoCard`**

Find the `<PrinterInfoCard ... />` JSX block and add the two new props (anywhere among the existing prop list, e.g. right after `onTestPrintLabel={onTestPrintLabel}`):

```tsx
onToggleTsplFont={onToggleTsplFont}
tsplFontPending={tsplFontPending}
```

- [ ] **Step 5: Skip the bill-image capture when the target driver is TSPL in truetype mode with an installed font**

Find `resolveTestPrintDocuments`:

```tsx
const resolveTestPrintDocuments = async (driver: PrinterDriver, printer: Printer, document: import('../types/printDocument.types').PrintDocument): Promise<PrintDocumentVariants> => {
  if (driver.type !== 'tspl') return { text: document };
  const base64 = await captureBillImage(document, printer.paperSize);
  if (!base64) return { text: document };
  return { text: document, image: { elements: [{ type: 'image', data: base64, x: 0, y: 0 }] } };
};
```

Replace with:

```tsx
const resolveTestPrintDocuments = async (driver: PrinterDriver, printer: Printer, document: import('../types/printDocument.types').PrintDocument): Promise<PrintDocumentVariants> => {
  const usesTrueType = driver.type === 'tspl' && driver.config.type === 'tspl' && driver.config.renderMode === 'truetype' && driver.config.font?.fontInstalled;
  if (driver.type !== 'tspl' || usesTrueType) return { text: document };
  const base64 = await captureBillImage(document, printer.paperSize);
  if (!base64) return { text: document };
  return { text: document, image: { elements: [{ type: 'image', data: base64, x: 0, y: 0 }] } };
};
```

(When `usesTrueType` is true, the driver's `encode()` will use `documents.text` directly — capturing a bill image would be wasted work, per spec §7's fallback table interacting with this call site.)

- [ ] **Step 6: Type-check + lint the whole repo**

Run: `npm run type-check && npm run lint`
Expected: PASS (0 errors) — this closes out the last file touched by this plan.

- [ ] **Step 7: Manual verification**

Not possible without a real TSPL printer supporting `DOWNLOAD` (unverified, per spec §2) — note this explicitly rather than claiming it works. If a printer becomes available: add a printer, connect a TSPL driver, toggle "In bằng font TrueType (thử nghiệm)" on, confirm no crash either way (success or failure), and if it reports success, run "In tem thử" and visually inspect the printed output for readable Vietnamese text using the custom font instead of a bitmap image.

- [ ] **Step 8: Commit**

```bash
git add src/features/printer/components/AddPrinterModal.tsx
git commit -m "feat(printer): AddPrinterModal wires the TrueType font toggle end-to-end"
```

---

## Final checklist

- [ ] `npm run type-check` — 0 errors, whole repo.
- [ ] `npm test` — no regressions vs. the pre-existing baseline (456/456 individual tests passing before this plan started, plus this plan's new tests).
- [ ] `npm run lint` — clean on all touched files.
- [ ] Task 1's manual font-file step is genuinely done (not skipped/faked) before Tasks 5+ are considered complete.
- [ ] Nothing in this plan changed `renderMode`'s default (`'bitmap'`) or altered bitmap-mode output for any printer that never touches the new switch — confirm by re-running the full pre-existing TSPL-related test suites (`TsplDriver.test.ts`, `TsplEncoder.test.ts`) and confirming every pre-existing test (not just the new ones) still passes unmodified in intent.
