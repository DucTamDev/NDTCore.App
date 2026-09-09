# NDTCore.POS Printer Architecture

**Loại tài liệu:** Kiến trúc lý tưởng (target), không phải nhật ký thay đổi.
**Coding style:** [`CODING_STYLE.md`](CODING_STYLE.md) (riêng feature này), mở
rộng [`docs/CODING_STANDARDS_TS.md`](../../../docs/CODING_STANDARDS_TS.md).

Tài liệu này mô tả feature printer *nên* trông như thế nào khi hoàn thiện.
Nếu code hiện tại chưa khớp 100%, đó là việc còn lại cần làm, không phải lỗi
tài liệu.

## 1. Purpose

This document defines the production architecture for the NDTCore.POS
printer feature.

The architecture is designed for:

* Android POS devices.
* Multiple printer connection types.
* Multiple printer protocols/drivers.
* Receipt and label printing.
* USB, Bluetooth, and LAN printers.
* Printer discovery and identification.
* Concurrent print jobs.
* Native Android printer integrations.
* Future printer vendors and protocols.
* Strict separation of connection, printing, routing, discovery, storage,
  and platform-specific code.

The architecture prioritizes:

1. Clear responsibility boundaries.
2. Low coupling.
3. Reusability.
4. Testability.
5. Predictable concurrency.
6. Platform isolation.
7. Extensibility without unnecessary abstraction.
8. Production-grade failure handling.

---

# 2. Core Architecture Principles

## 2.1 Responsibility over abstraction

Create a class when it owns a meaningful responsibility.

Do not create classes merely to:

* wrap another class;
* forward method calls;
* satisfy an abstraction pattern;
* create generic managers;
* create factories without multiple meaningful implementations;
* hide simple logic behind unnecessary layers.

Example: `PrinterPrintService` is justified because printing execution is a
different responsibility from connection lifecycle.

## 2.2 Independent axes

Printer capabilities are modeled using independent concepts.

```text
PrintType (content)
        +
PrinterDriverType (protocol)
        +
ConnectionType (transport)
        +
renderMode (per-driver encoding choice)
```

They must not be implicitly coupled. For example:

```text
Receipt ≠ ESC/POS
Label  ≠ TSPL
```

A printer may support:

```text
ESC/POS → Receipt
TSPL    → Receipt
TSPL    → Label
```

`PrintType` defines **what is being printed**; `PrinterDriverType` defines
**how the printer understands the print data**.

## 2.3 No fallback

`renderMode` is a hard rendering contract. If a configured mode cannot
execute (missing image, font not installed, missing config), the operation
**fails explicitly** — it never silently substitutes another render mode.
This applies to every render mode of every driver, no exceptions.

---

# 3. High-Level Architecture

```text
┌─────────────────────────────────────────────┐
│                   UI / Hooks                 │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│                PrintService                  │
│          Public printing API                 │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│            PrintRoutingService               │
│        Resolve target printers               │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│               PrintScheduler                 │
│   Queue / ordering / concurrency / lock      │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│            PrinterPrintService               │
│       Execute print / test print             │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│          PrinterConnectionService            │
│       Connection lifecycle only              │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│               PrinterDriver                  │
│     ESC/POS / TSPL / future protocols        │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│              IPrinterAdapter                 │
│    NativeAdapter / LibraryAdapter / Vendor   │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│                 Transport                    │
│       USB / Bluetooth / LAN                  │
└──────────────────────┬───────────────────────┘
                        ▼
┌─────────────────────────────────────────────┐
│               Native / Vendor SDK            │
│              Android platform APIs           │
└─────────────────────────────────────────────┘
```

---

# 4. Directory Structure

```text
src/features/printer/
├── ARCHITECTURE.md
├── CODING_STYLE.md
│
├── models/
│   ├── printer/       # Printer, PrinterConnection, PrinterDevice,
│   │                    PrinterDriver, PrinterCapabilities, PrinterStatus
│   ├── printing/      # PrintType, PrintDocument, PrintJob, PrintTarget
│   └── media/         # PrintMedia, PrintMediaType, CutterMode, PaperSize
│
├── errors/             # PrinterError, PrinterErrorCode, errorCodeOf
│
├── drivers/
│   ├── IPrinterDriver.ts
│   ├── DriverRegistry.ts (+ .web.ts)
│   ├── DriverCapabilities.ts
│   ├── driverConfig.ts  # mediaOf/paperSizeOf(printer), renderMode accessors
│   ├── escpos/
│   │   ├── EscPosDriver.ts
│   │   ├── EscPosTextBuilder.ts     # renderMode: 'text'
│   │   └── EscPosBitmapEncoder.ts   # renderMode: 'bitmap' (GS v 0)
│   └── tspl/
│       ├── TsplDriver.ts
│       ├── TsplEncoder.ts
│       ├── TsplFontManager.ts
│       ├── TsplStrategyRegistry.ts
│       └── strategies/    # Bitmap / TrueType / InternalFont
│
├── adapters/
│   ├── IPrinterAdapter.ts
│   ├── resolvePrinterAdapter.ts
│   ├── native/          # NativeAdapter, PrinterNativeModule, EPToolkit
│   ├── library/          # LibraryAdapter
│   ├── vendor/           # VendorAdapter (skeleton)
│   └── testing/          # MockPrinterAdapter
│
├── transports/           # UsbTransport, BluetoothTransport, LanTransport
│
├── discovery/
│   ├── DeviceScanService.ts
│   ├── NetworkInfoService.ts
│   ├── PrinterDiscoveryService.ts
│   └── PrinterResolver.ts
│
├── printing/
│   ├── PrintService.ts          # entry point cho production printing
│   ├── PrintRoutingService.ts   # resolve targets
│   ├── PrintScheduler.ts        # queue + lock
│   └── PrinterPrintService.ts   # print()/testPrint() cho 1 printer
│
├── connection/
│   ├── PrinterConnectionService.ts  # connect/disconnect/reconnect/status
│   └── PrinterConnectionLock.ts     # resource concurrency
│
├── permissions/
│   └── PrinterPermissionService.ts
│
├── management/
│   └── PrinterConfigService.ts   # renderMode/font/media configuration
│
├── logging/
│   └── PrinterLogger.ts
│
├── storage/
│   ├── PrinterRepository.ts
│   ├── PrinterStorage.ts
│   └── PrinterWriteInput.ts
│
├── media/
│   ├── paperSpec.ts       # PAPER_SIZE_SPECS, DOTS_PER_MM, CONTINUOUS_HEIGHT_MM
│   ├── cutter.ts
│   └── validation.ts
│
├── components/
├── hooks/
├── forms/
├── store/
├── utils/
│
└── testing/               # fixture/mock dùng chung — KHÔNG có đuôi `.test.`
    ├── printerFixtures.ts
    └── printerServiceTestKit.ts
```

File logic có test đặt trong `__tests__/` cùng cấp file đó (Jest tự nhận
diện, không cấu hình thêm) — không gom về 1 cây test tập trung.

---

# 5. Layer Responsibilities — Models

Location: `models/`. Contains domain data structures and contracts.

Models must not contain: Android API calls, printer SDK calls, network
calls, storage operations, React logic, Redux logic.

---

# 6. Printer Model

`Printer` represents a configured physical printer.

```ts
export interface Printer {
  id: string;
  name: string;
  vendor?: string;
  model?: string;

  connection: PrinterConnection;

  /** Giấy vật lý đang nạp — thuộc Printer, KHÔNG thuộc driver (§13). */
  media: PrintMedia;

  capabilities: PrinterCapabilities;

  /** 1..2 phần tử — tối đa 1 ESC/POS + 1 TSPL, enforce ở schema. */
  drivers: PrinterDriver[];

  identityKey: string;
  autoReconnect: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## Rules

### No `isDefault`

Printer selection is determined by routing configuration (`contentTypes`
per driver). Do not store `isDefault: boolean` — it creates unnecessary
global state and does not scale for multi-printer routing.

---

## 6.1 `identityKey`

`identityKey` identifies the physical printer for configuration purposes.
Used for duplicate detection, printer matching, discovery-to-configuration
mapping. It is **not** a concurrency lock, and depends only on `connection`
— never on driver/protocol/renderMode/font.

## 6.2 `resourceKey`

`resourceKey` represents the runtime concurrency boundary of the
native/driver layer. Derived from the actual runtime constraint. Must not
be confused with `identityKey`.

---

# 7. Identity Key vs Resource Key

## 7.1 Identity

`identityKey` answers: *"Is this the same physical printer?"* Used for
duplicate prevention, configuration matching, printer resolution.

## 7.2 Resource

`resourceKey` answers: *"Can these operations safely use the underlying
printer/native resource concurrently?"* Used for locking, scheduling,
preventing native SDK conflicts.

---

# 8. Resource Key Rules

| Case | `resourceKey` | Lý do |
|---|---|---|
| USB (mọi driver) | `"usb"` | Native module dùng chung 1 singleton — ESC/POS và TSPL qua USB không được chạy đồng thời |
| ESC/POS Bluetooth | `"escpos:bluetooth"` | Native module singleton theo connectionType |
| ESC/POS LAN | `"escpos:lan"` | Native module singleton theo connectionType |
| TSPL Bluetooth | `"tspl:bluetooth:<deviceId>"` | Transport riêng theo device — song song được giữa các device khác nhau |
| TSPL LAN | `"tspl:lan:<ip>:<port>"` | Transport riêng theo endpoint — song song được giữa các endpoint khác nhau |

---

# 9. PrinterConnection

Connection type is modeled as a discriminated union — TypeScript blocks
invalid states (e.g. `type: 'lan'` with a `device` field) at compile time.

```ts
export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>; // USB: vendorId/productId/serialNumber bên trong
}

export interface PrinterLanConfig {
  ip: string;
  port: number;
}

export type PrinterConnection =
  | { type: 'usb'; device: PrinterDevice }
  | { type: 'bluetooth'; device: PrinterDevice }
  | { type: 'lan'; lan: PrinterLanConfig };
```

USB và Bluetooth dùng chung 1 shape `PrinterDevice` (không tách
`UsbPrinterConnection`/`BluetoothPrinterConnection` với field riêng) vì cả
2 hiện có cùng dữ liệu cần thiết (`deviceId`/`displayName`/`rawDevice`) —
tách thêm không giải quyết invalid-state nào cả. Zod schema dùng
`z.discriminatedUnion('type', ...)` tương ứng để validate dữ liệu đọc từ
storage (không qua type-check).

---

# 10. Printer Drivers

Drivers represent printer protocols. Current drivers: `escpos`, `tspl`.
Future drivers may include `zpl`, `cpcl`, vendor-specific protocols.

A driver is responsible for protocol-specific behavior: protocol encoding,
text rendering, image rendering, barcode/QR generation, protocol commands,
driver-specific initialization, protocol-specific font handling.

A driver must not own: global print routing, application-level queueing,
printer configuration persistence, UI, Android permissions.

```ts
export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(printer: Printer, driver: PrinterDriver): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
  print(printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void>;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
}
```

`scan` is a stream (`Unsubscribe`, not `Promise<PrinterDevice[]>`) —
Bluetooth discovery runs ~12s and must be cancellable mid-flight.

---

# 11. Driver and Content Type Rules

These are independent axes.

```ts
export const PrintType = { Receipt: 'Receipt', Label: 'Label' } as const;
export const PrinterDriverType = { escpos: 'escpos', tspl: 'tspl' } as const;
```

Driver capabilities define supported content types:

```text
ESC/POS
  └── Receipt

TSPL
  ├── Receipt
  └── Label
```

Within a single printer configuration: **a `PrintType` must belong to
exactly one configured driver.** This prevents ambiguous routing.

---

# 12. PrinterDriver / renderMode

Each driver carries its own render-mode config — never a single type
shared across protocols (ESC/POS has 2 meaningful modes, TSPL has 3; a
unified type would force meaningless values on the other protocol).

```ts
export interface PrinterDriver {
  type: 'escpos' | 'tspl';
  source: 'auto' | 'manual';
  contentTypes: ('Receipt' | 'Label')[];
  config: EscPosDriverConfig | TsplDriverConfig;
}

export interface EscPosDriverConfig {
  type: 'escpos';
  /** `undefined` ⇒ 'text'. */
  renderMode?: 'text' | 'bitmap';
}

export interface TsplFontConfig {
  name: string;
  fileName: string;
  fontInstalled: boolean;
}

export interface TsplInternalFontConfig {
  codepage: 'UTF-8' | '1258' | '1252';
  fontName: string;
}

export interface TsplDriverConfig {
  type: 'tspl';
  renderMode: 'bitmap' | 'truetype' | 'internalfont';
  font?: TsplFontConfig;                 // chỉ có ý nghĩa khi renderMode từng là 'truetype'
  internalFont?: TsplInternalFontConfig; // chỉ có ý nghĩa khi renderMode từng là 'internalfont'
}
```

## Render mode responsibilities

**Encoder / text** — uses the printer protocol's native text/command
encoding. Best when the printer supports required characters, protocol
encoding is reliable, and maximum speed is preferred.

**Bitmap** — text is rendered into a bitmap before being encoded for the
printer. Use when the printer lacks required Unicode support and
Vietnamese text must display correctly regardless of firmware codepage
support. The selected font must contain the required glyphs.

**TrueType (TSPL only)** — a custom `.ttf` is `DOWNLOAD`ed to the printer,
then referenced by name in `TEXT` commands. This is a rendering strategy,
not conceptually coupled to any specific font — it must not be treated as
a universal fallback.

**Internal font (TSPL only)** — uses a printer-provided resident font +
`CODEPAGE`. Useful only when the required characters are supported by that
codepage and output does not require rasterization.

If text is rasterized (bitmap mode), codepage is no longer responsible for
character encoding — the text has already become pixels before
transmission. Protocol codepage settings must not be used as a substitute
for a missing font in non-bitmap modes.

---

# 13. PrintMedia vs PrinterCapabilities

`PrintMedia` describes the paper/media configuration a print job requires
— **how the print job is laid out**, not what the physical printer is
capable of. It belongs to `Printer` (top-level), not to any driver: a
printer has exactly one physical sheet of paper loaded at a time,
independent of which protocol/driver is currently printing.

```ts
export interface PrintMedia {
  type: 'continuous' | 'die_cut';
  paperSize: 58 | 80 | 100 | 104;
  itemWidthMm?: number;   // bắt buộc khi die_cut
  itemHeightMm?: number;  // bắt buộc khi die_cut
  columns?: number;       // bắt buộc khi die_cut
  horizontalGapMm?: number;
  verticalGapMm?: number;
  cutterMode?: 'none' | 'per_job' | 'per_row';
}

export interface PrinterCapabilities {
  /** Máy in có dao cắt (phần cứng). */
  cutter: boolean;
}
```

| Concept | Answers | Example |
|---|---|---|
| `PrintMedia` | "What paper configuration does this job require?" | 80mm continuous, 40×30mm die-cut, 2-column die-cut |
| `PrinterCapabilities` | "What can the physical printer support?" | has cutter, supports image |

Ràng buộc: nếu `Printer.drivers` có driver ESC/POS, `media.type` phải là
`continuous` (ESC/POS không có khái niệm khai báo khổ giấy die-cut) — check
này chạy ở `printerSchema` cấp `Printer`, không phải cấp driver.

---

# 14. Media Rules

Paper-related logic belongs under `media/`. Do not place paper layout
logic inside `drivers/`, `connection/`, or `transports/`.

* `media/paperSpec.ts` — physical paper dimensions, printable-area
  definitions, dot density (`DOTS_PER_MM`), continuous-height safety
  ceiling (`CONTINUOUS_HEIGHT_MM` — shared by any protocol printing on
  continuous roll, not TSPL-specific).
* `media/validation.ts` — media configuration validation (die-cut field
  completeness, row-vs-printable-width overflow).
* `media/cutter.ts` — cutter behavior normalization
  (`resolveEffectiveCutterMode`).

## Cutter rules

For die-cut paper, `cutterMode` is always normalized to `none` (perforated
paper tears apart on its own — there is nothing to cut). For continuous
paper, an unspecified `cutterMode` defaults to `per_job`.

## Die-cut validation

```text
rowWidthMm = columns × itemWidthMm + (columns - 1) × horizontalGapMm
```

`rowWidthMm` must not exceed the printable width of the selected paper
size. Validation must fail before sending invalid print data to the
printer.

---

# 15. TSPL Bitmap Pipeline

```text
PrintDocument (text elements)
      ↓
BillImagePreview render vào 1 View ẩn (React Native)
      ↓
react-native-view-shot capture → PNG base64
      ↓
upng-js decode → RGBA → resize theo targetWidthPx (paper size)
      ↓
threshold luminance → MonochromeBitmap (1-bit, MSB-first)
      │
      ├── TsplEncoder.image()   → lệnh BITMAP
      └── EscPosBitmapEncoder   → lệnh GS v 0 (ESC/POS bitmap mode)
```

Toàn bộ pipeline capture→decode→threshold là **protocol-agnostic**, dùng
chung 100% giữa TSPL và ESC/POS — chỉ bước cuối (đóng gói lệnh) khác nhau.

For the affected Xprinter XP-420B firmware, TSPL's `BITMAP` command
requires bit inversion (`byte ^ 0xff`) — a firmware-clone quirk isolated
inside `TsplEncoder.image()` only, must not spread elsewhere (it does not
apply to ESC/POS's `GS v 0`, which follows the standard Epson spec more
consistently).

---

# 16. TSPL TrueType Font Installation

TrueType installation is a separate capability from rendering.
`TsplFontManager` installs a font using the TSPL `DOWNLOAD` command:

```text
DOWNLOAD "<name>",<byteCount>
```

followed by raw font bytes. **This capability is unverified on real
hardware** and must not be considered production-ready until tested
against target firmware.

If installation fails, `TSPL_FONT_INSTALL_FAILED` must be surfaced through
structured printer error handling/logging.

**No fallback**: if `renderMode: 'truetype'` is configured but the font is
not installed (or the DOWNLOAD syntax is rejected by firmware), the print
operation fails explicitly (`TSPL_FONT_NOT_INSTALLED`). The driver must
**not** silently substitute bitmap rendering — `renderMode` is a hard
contract (§2.3). The user must explicitly switch render mode if TrueType
does not work on their hardware.

---

# 17. PrinterConnectionService

Location: `connection/PrinterConnectionService.ts`.

Responsibility: **manage printer connection lifecycle.**

It owns: `connect()`, `disconnect()`, `reconnect()`, `reconnectAutoPrinters()`,
`connectDraft()`, `getStatus()`, `onStatusChange()`.

It must not own: `print()`, `testPrint()`, queueing, routing, scheduling.

The service may: resolve the configured driver, establish transport
connection, maintain connection state, reconnect, disconnect, expose
connection status. It must not decide *"when should this print job
execute?"* — that belongs to `PrintScheduler`.

---

# 18. PrinterConnectionLock

Location: `connection/PrinterConnectionLock.ts`.

Responsibility: **protect runtime printer resources from unsafe concurrent
access.** Operates using `resourceKey`, not `printerId` — different
printers may share the same underlying runtime resource (e.g. two USB
printers both use `resourceKey = "usb"` and must serialize).

```ts
export interface PrinterConnectionLockApi {
  runExclusive<T>(resourceKey: string, task: () => Promise<T>): Promise<T>;
}
```

Shared by `PrinterConnectionService`, `PrinterPrintService`,
`PrinterConfigService` (font install), and `PrintScheduler` — one
singleton instance for the whole feature.

---

# 19. PrintService

Location: `printing/PrintService.ts`.

Responsibility: **public application-level printing API.**

```ts
print(printType: PrintType, documents: PrintDocuments): Promise<PrintResult>;
```

It must not contain: printer discovery, native calls, protocol encoding,
low-level connection handling, queue implementation.

---

# 20. PrintRoutingService

Location: `printing/PrintRoutingService.ts`.

Responsibility: **determine which configured printers should receive a
print job.**

```text
PrintType
   ↓
enabled printers
   ↓
drivers whose contentTypes include this PrintType
   ↓
PrintTarget[] { printer, driver }
```

Routing decisions are based on enabled printer configuration, content
type, and driver configuration only. It does not execute printing.

---

# 21. PrintScheduler

Location: `printing/PrintScheduler.ts`.

Responsibility: **control print-job execution order and concurrency.**

The scheduler owns: queueing, ordering, execution sequencing, resource
locking, preventing conflicting operations.

The scheduler must not implement: USB/Bluetooth/LAN communication,
ESC/POS/TSPL encoding, printer discovery.

```text
PrintJob
   │
   ▼
PrintScheduler.enqueue()
   │
   ▼
Determine resourceKey
   │
   ▼
lock.runExclusive(resourceKey, async () => {
   await PrinterPrintService.print(...);
});
```

The lock must always be released, including on failure — `runExclusive`
guarantees this structurally.

---

# 22. PrinterPrintService

Location: `printing/PrinterPrintService.ts`.

Responsibility: **execute a print operation against one selected
printer.** The bridge between scheduling and connection/driver execution.

It owns: `print()`, `testPrint()`. It does not own: queue, routing, global
scheduling.

```ts
export interface PrinterPrintServiceApi {
  print(printerId: string, documents: PrintDocuments, printType: PrintType): Promise<void>;
  testPrint(printer: Printer, driver: PrinterDriver, documents: PrintDocuments, printType: PrintType, options?: PrintOptions): Promise<void>;
}
```

## Not a wrapper around `PrinterConnectionService`

`PrinterPrintService` and `PrinterConnectionService` are **siblings**, not
a layered wrap — both draw from the same 3 shared primitives
(`DriverRegistry`, `PrinterRepository`, `PrinterConnectionLock`):

```text
                DriverRegistry   PrinterRepository   PrinterConnectionLock
                      │                 │                    │
        ┌─────────────┼─────────────────┤          ┌─────────┤
        ▼             ▼                 ▼          ▼         ▼
   PrinterConnectionService (connection/)      PrinterPrintService (printing/)
```

`print()` calls `driver.connect()` directly if the driver is not yet
connected — it does **not** go through `PrinterConnectionService.connect()`,
because that method connects *all* drivers of a printer, a different scope
than "connect exactly the driver needed for this print".

## `print()` must never self-lock

`print()` does **not** call `lock.runExclusive` — it always runs *inside* a
lock already acquired by `PrintScheduler` for the same `resourceKey`.
`PrinterConnectionLock` is **not reentrant**; adding a nested
`lock.runExclusive` inside `print()` would deadlock immediately. Only
`testPrint()` (called directly from UI, bypassing the scheduler) acquires
its own lock.

`testPrint()` must use the same resource-locking rule as normal printing
— it must never interleave with an active production print job on the
same resource.

---

# 23. Complete Printing Flow

```text
Application
    ↓
PrintService
    ↓
PrintRoutingService
    ↓
PrintScheduler (resource lock)
    ↓
PrinterPrintService
    ↓
PrinterConnectionService (connect if needed) + PrinterDriver
    ↓
IPrinterAdapter (NativeAdapter / LibraryAdapter / VendorAdapter)
    ↓
Transport
    ↓
Native / Vendor SDK
    ↓
Physical Printer
```

Example — one `PrintType.Receipt` request resolving to 3 targets:

```text
Receipt
 ├── Front Counter (ESC/POS Bluetooth) → resourceKey = escpos:bluetooth
 ├── Kitchen       (ESC/POS Bluetooth) → resourceKey = escpos:bluetooth  ← serialized with above
 └── Label printer (TSPL Bluetooth A)  → resourceKey = tspl:bluetooth:A  ← runs independently
```

Each target becomes an independent scheduled job (`requestId` groups them
for reporting). One printer failing does not affect the others
(failure isolation).

---

# 24. Driver Layer — ESC/POS

Location: `drivers/escpos/`.

Responsibilities: ESC/POS text commands, receipt formatting, ESC/POS
bitmap raster command, ESC/POS-specific initialization.

ESC/POS goes through `IPrinterAdapter` (`NativeAdapter`, wrapping the
project's own native Android module) — it does **not** depend on any
external npm printer library. (An earlier iteration vendored code from
`@poriyaalar/react-native-thermal-receipt-printer`; that dependency has
since been fully removed and its logic rewritten in-repo.) Because the
native module is a singleton per connection type, that boundary is
reflected via `resourceKey = "escpos:<connectionType>"`.

---

# 25. Driver Layer — TSPL

Location: `drivers/tspl/`.

Responsibilities: TSPL commands, label layout, text, barcode, QR code,
bitmap generation, font strategies (bitmap / truetype / internalfont —
§12).

```text
TsplDriver
      ↓
TsplStrategyRegistry (renderMode → strategy, KHÔNG switch trong Driver)
      │
      ├── bitmap        → TsplBitmapStrategy
      ├── truetype       → TsplTrueTypeStrategy
      └── internalfont    → TsplInternalFontStrategy
```

```ts
export interface ITsplPrintStrategy {
  readonly mode: TsplRenderMode;
  validate(context: TsplStrategyContext): void;
  encode(context: TsplStrategyContext): Uint8Array;
}

export interface TsplStrategyContext {
  printer: Printer;
  driver: PrinterDriver;   // config.type === 'tspl'
  documents: PrintDocuments;
  printType: PrintType;
  media: PrintMedia;       // = mediaOf(printer) — nguồn cho SIZE/GAP/SET CUTTER/layout cột
  rows: number;            // số hàng die-cut cần in (>= 1); continuous = số bản sao
}
```

Strategy does not connect, read storage, or install fonts — pure
`context → bytes`. `TsplDriver` only orchestrates: validate → resolve
strategy → encode → send via adapter.

---

# 26. IPrinterAdapter & Transport Layer

```text
EscPosDriver              TsplDriver
      │                        │
      └───────────┬────────────┘
                   ▼
   resolvePrinterAdapter(driverType, connectionType)
                   │
      ┌────────────┼────────────────┐
      ▼            ▼                ▼
NativeAdapter  LibraryAdapter   VendorAdapter
      │            │             (skeleton — mọi I/O
      ▼            ▼              throw UNSUPPORTED)
PrinterNativeModule  tcp-socket / bluetooth-classic
                     (LanTransport / BluetoothTransport)
```

Resolve rule: ESC/POS → always `NativeAdapter`; TSPL/USB → `NativeAdapter`;
TSPL/Bluetooth-LAN → `LibraryAdapter`.

```ts
export interface IPrinterAdapter {
  readonly source: 'native' | 'library' | 'vendor';
  readonly canRead: boolean;   // false = phải trả null ngay, không ghi lệnh dò rồi chờ đọc
  listDevices(connectionType: ConnectionType): Promise<PrinterDevice[]>;
  connect(target: PrinterConnectTarget): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  printText(text: string, options: PrinterPrintTextOptions): Promise<void>;
  read(timeoutMs: number): Promise<Uint8Array | null>;
  disconnect(): Promise<void>;
}
```

Transport (`UsbTransport`/`BluetoothTransport`/`LanTransport`) is the
building block *inside* an adapter — not something a driver calls
directly. Transport responsibility: `connect`, `disconnect`, `write`,
status. Transport must not know about `Receipt`/`Label`/`ESC/POS`/`TSPL`/
paper layout/routing.

At the TypeScript boundary, binary data is `Uint8Array`. Base64 is a
**native bridge representation only** (`writeByBase64`) — it must not leak
into the higher-level transport/adapter abstraction as a domain concept.

Only `NativeAdapter`/`PrinterNativeModule`/`transports/*Transport` are
allowed to know native. Layers above (driver, service, UI) never import
native modules.

---

# 27. Native Android Layer

Location: `adapters/native/`.

Native code may directly interact with Android APIs (`Context`,
`UsbManager`, `UsbDevice`, `UsbInterface`, `UsbEndpoint`,
`UsbDeviceConnection`, Bluetooth APIs). These details must not leak into
`drivers/`, `printing/`, or `models/`.

Native APIs expose Promise-based operations to React Native — avoid
callback-based contracts for new APIs.

Comments on Android API usage are required only when the usage is
non-obvious or explains a platform constraint:

```java
// Android exposes USB permission per UsbDevice, so permission must be
// checked against the exact device before opening the connection.
```

Unnecessary comments (`// Get USB manager.`) should be avoided.

---

# 28. Discovery

Location: `discovery/`. Contains `DeviceScanService`, `NetworkInfoService`,
`PrinterDiscoveryService`, `PrinterResolver`.

**`DeviceScanService`** — discovers physical devices (USB/Bluetooth). Returns
raw/discovered device information. Does not save printer configuration.

**`NetworkInfoService`** — network info needed for LAN printer
discovery/configuration (e.g. current WiFi IP, to suggest a subnet). Does
not own print execution.

**`PrinterDiscoveryService`** — protocol/device discovery:

```text
Device → connect() → identify() (real discriminator when protocol supports it) → confirmed / unconfirmed
```

Candidate order: TSPL first, then ESC/POS — TSPL's `identify()` sends a
real discriminator command (`~!T`) and reads a response; ESC/POS's
`identify()` is only a "weak confirm" (connect succeeded, nothing more).
This is a discovery-order heuristic only, not a permanent priority rule
for printing.

**USB discovery limitation**: the native module cannot read a response
during identification over USB, so `identify() → null` is a valid,
expected result — it must not be treated as "printer not found". Instead,
`unknown_protocol` is returned and the user chooses the protocol manually
("Printer Language").

**No vendor/model rule table.** Vendor/model are metadata only — protocol
truth comes exclusively from `identify()` or manual configuration. (This
existed before and was removed for being unreliable; do not reintroduce
it.)

**`PrinterResolver`** — converts discovered printer information into
`identityKey`. Responsible for identity generation only — it does not
mutate storage (duplicate rejection happens in `PrinterRepository`).

---

# 29. Permissions

Location: `permissions/PrinterPermissionService.ts`. Responsible for
printer-related platform permissions (USB, Bluetooth). Kept outside
drivers and transport implementations where possible.

---

# 30. Management

Location: `management/PrinterConfigService.ts`. Responsible for printer
*configuration* operations after a driver already exists on a saved
printer:

```ts
export interface PrinterConfigServiceApi {
  installTsplFont(printerId: string, font: TsplFontConfig): Promise<void>;
  setTsplRenderMode(printerId: string, renderMode: TsplRenderMode): void;
  setTsplInternalFont(printerId: string, internalFont: TsplInternalFontConfig): void;
  setEscPosRenderMode(printerId: string, renderMode: EscPosRenderMode): void;
  setPrinterMedia(printerId: string, media: PrintMedia): void;
}
```

Delegates persistence to `PrinterRepository`. Must not implement physical
printing. `installTsplFont`/`setPrinterMedia`/etc. are no-ops for a draft
(unsaved) printer — the `AddPrinterModal` flow carries that state into
`buildDraftPrinter()` at Save time instead.

---

# 31. Storage

Location: `storage/`. Contains `PrinterRepository` (application-facing
persistence contract: CRUD + identity dedup + `printerSchema.parse()`),
`PrinterStorage` (actual MMKV implementation), `PrinterWriteInput` (input
model for create/update, `identityKey` optional since the repository
recomputes it).

Storage must not contain driver encoding, Android APIs, print routing, or
scheduling.

## Storage versioning

When the printer data model changes incompatibly, `CURRENT_STORAGE_VERSION`
is bumped and storage is reset **destructively** — old printer
configuration is not migrated field-by-field. This is intentional: the
model has undergone structural changes (multiple drivers, identity key,
media ownership) that make partial migration error-prone and not worth the
cost for a locally-configured POS printer list.

---

# 32. Logging

Location: `logging/PrinterLogger.ts`. Centralized — all printer operations
log through it.

```ts
export interface PrinterLoggerApi {
  scanCompleted(params: { connectionType: ConnectionType; deviceCount: number; durationMs: number }): void;
  scanFailed(params: { connectionType: ConnectionType; errorCode: PrinterErrorCode; durationMs: number }): void;
  connectSucceeded(params: { printerId: string; protocol: PrinterDriverType; connectionType: ConnectionType; durationMs: number }): void;
  connectFailed(params: { printerId: string; protocol: PrinterDriverType; connectionType: ConnectionType; errorCode: PrinterErrorCode; durationMs: number }): void;
  printSucceeded(params: { printerId: string; protocol: PrinterDriverType; durationMs: number }): void;
  printFailed(params: { printerId: string; protocol: PrinterDriverType; errorCode: PrinterErrorCode; durationMs: number }): void;
  // disconnect*/testPrint*/discovery*/fontInstall* theo cùng pattern
}
```

Field chuẩn: `printerId`, `operation`, `protocol`/`connectionType`,
`durationMs`, `result?` (optional — lifecycle-start events like
`discovery.started` don't emit one), `errorCode?`.

**Do not log**: invoice content, MAC address, IP address, `resourceKey`
(it embeds IP for TSPL LAN), raw font bytes.

---

# 33. Errors

Location: `errors/PrinterError.ts`. Printer errors are normalized into
`PrinterErrorException { code: PrinterErrorCode, message, cause? }` before
reaching application consumers.

Image-related codes (`IMAGE_REQUIRED`/`IMAGE_INVALID`/`IMAGE_TOO_LARGE`)
are shared across **both** protocols — they describe the state of
`documents.image`, not a protocol-specific failure, so they carry no
protocol prefix.

Print failure never blocks a successful payment: `OrderPrintTrigger` logs
a warning and returns a result; it does not throw back into the payment
flow. Lower-level services still return/reject structured errors so the
scheduler and logging layer can handle them correctly.

---

# 34. Concurrency Model

Concurrency is controlled by `PrintScheduler` + `PrinterConnectionLock`.
Never lock on `printerId` alone — the correct key is `resourceKey` (§8).

```text
acquire → execute → release
acquire → execute → error → finally → release
```

A failed print must never leave a resource permanently locked —
`runExclusive` structurally guarantees release via its own `finally`.

---

# 35. Add Printer Flow

```text
Choose connection type
        ↓
Select discovered device OR enter IP + Port
        ↓
Connect
        ↓
Discover / identify protocol (TSPL first, then ESC/POS)
        ↓
identified / unknown_protocol → manual "Printer Language" selection
        ↓
Configure content types, media, render mode
        ↓
Test print
        ↓
Save (schema validate → identity dedup → storage)
```

---

# 36. Duplicate Detection

Duplicate detection uses `identityKey`, never `resourceKey` — two
different physical printers may intentionally share the same resource key
(e.g. two ESC/POS Bluetooth printers both resolve to
`resourceKey = "escpos:bluetooth"`, yet are different physical devices).

---

# 37. UI / Store Boundary

UI components: `components/`. Hooks: `hooks/`. Forms: `forms/`. UI code
must not directly access `NativeAdapter`, `UsbDeviceConnection`,
`EscPosDriver`, `TsplDriver` — only application-level services/hooks.

## Redux (`store/printerSlice.ts`)

Redux holds **serializable UI-facing state only**: the list of configured
printers (`printers: Printer[]`) and their live connection status
(`statusById: Record<string, PrinterStatus>`), fed by
`usePrinterConnection`/`usePrinterList` subscribing to
`PrinterConnectionService.onStatusChange` + `PrinterRepository`. It must
never hold native/runtime resources: `UsbDeviceConnection`, a native
socket, a native SDK instance, a driver singleton, a transport connection
object. Those live only inside the driver/adapter layer's own in-memory
maps (keyed by `printerId`), never in the store.

`createSlice` (Redux Toolkit) uses Immer — reducers may look like they
mutate (`state.printers.push(...)`, `printer.enabled = ...`); this is
correct, idiomatic RTK and produces immutable updates under the hood. Do
**not** add `readonly` to `Printer`/`PrinterDriver` fields to "enforce
immutability" — it would break this reducer at compile time for no benefit
(see [`CODING_STYLE.md`](CODING_STYLE.md) §6).

---

# 38. Singleton Rules

A singleton is acceptable only when the underlying library/platform itself
has singleton semantics (e.g. the native ESC/POS module is scoped by
connection type). The architecture models that constraint through
`resourceKey` — do not introduce application-wide singleton services
merely for convenience.

---

# 39. No Generic Printer Manager

Do not introduce `IPrinterManager`/`PrinterManager`/`PrinterManagerFactory`/
`GenericPrinterManager` unless a real responsibility requires it. Existing
responsibilities are already separated into `PrinterConfigService`,
`PrinterDiscoveryService`, `PrinterConnectionService`, `PrinterPrintService`,
`PrintRoutingService`, `PrintScheduler`. A generic manager would become a
service locator and reduce clarity.

---

# 40. No Generic Print Renderer

Do not introduce a generic abstraction such as `PrintRenderer`/
`RenderedPrint`/a single unified render-config type spanning both
protocols, unless a future requirement creates a genuine shared contract.
Bitmap rendering output (`MonochromeBitmap`) and text rendering output
(a plain string) are fundamentally different representations with no
useful common supertype today — forcing them into one would not simplify
the encoder, which would still have to branch on the real shape anyway.

---

# 41. Comment Rules

See [`CODING_STYLE.md`](CODING_STYLE.md) for the full rule set. Summary:

**Comment WHY, not WHAT:**

```ts
// USB uses a shared native singleton, so all USB printers
// must share the same runtime resource lock.
```

**Comment hardware quirks, isolated at the point of use:**

```ts
// XP-420B firmware expects inverted bitmap bits.
```

**Do not comment obvious code:**

```ts
// ❌ Create printer.
const printer = createPrinter();
```

---

# 42. Naming & File Placement Rules

Use names based on responsibility: `PrinterConnectionService`,
`PrinterPrintService`, `PrintScheduler`, `PrintRoutingService`,
`PrinterDiscoveryService`, `PrinterConfigService`, `PrinterRepository`.
Avoid ambiguous names (`Manager`, `Helper`, `Handler`, `Processor`,
`Utility`) unless the responsibility genuinely matches.

A file belongs in the directory representing its primary responsibility —
not grouped by technical type (no flat `services/`/`managers/`/`helpers/`).
See the File Responsibility table below.

| File | Responsibility |
|---|---|
| `connection/PrinterConnectionService.ts` | Connection lifecycle |
| `printing/PrintScheduler.ts` | Queue, order, concurrency |
| `discovery/PrinterDiscoveryService.ts` | Discover/identify printers |
| `permissions/PrinterPermissionService.ts` | Platform permissions |
| `management/PrinterConfigService.ts` | Printer configuration |
| `storage/PrinterRepository.ts` | Persistence boundary |
| `media/*.ts` | Paper/media validation and constants |

---

# 43. Dependency Direction

```text
UI
 ↓
Application services (management/, connection/, discovery/)
 ↓
Routing / Scheduling
 ↓
Print execution (PrinterPrintService)
 ↓
Driver
 ↓
IPrinterAdapter
 ↓
Transport
 ↓
Native adapter
```

Dependencies must not point upward. Native adapter must never import
`PrintService`/`PrintRoutingService`/a React component/the Redux store.

## Forbidden dependencies

* **Driver** must not depend on UI, Redux, `PrintScheduler`,
  `PrinterConfigService`.
* **Transport** must not depend on `Receipt`/`Label`, `PrintRoutingService`,
  `PrintScheduler`.
* **Native adapter** must not depend on React UI, Redux, application
  routing, media configuration.
* **Storage** must not depend on native Android APIs or printer driver
  implementations.

---

# 44. End-to-End Responsibility Matrix

| Component | Primary Responsibility |
|---|---|
| `PrintService` | Public print API |
| `PrintRoutingService` | Resolve target printers |
| `PrintScheduler` | Queue, order, concurrency |
| `PrinterPrintService` | Execute print/test-print |
| `PrinterConnectionService` | Connection lifecycle |
| `PrinterConnectionLock` | Resource synchronization |
| `PrinterDriver` (ESC/POS, TSPL) | Protocol behavior |
| `IPrinterAdapter` | Native/library/vendor abstraction |
| `Transport` | Physical communication |
| `PrinterNativeModule` | Platform/native integration |
| `PrinterDiscoveryService` | Discover/identify printers |
| `PrinterResolver` | Resolve identity |
| `PrinterConfigService` | Manage printer configuration |
| `PrinterRepository` | Persistence boundary |
| `PrinterStorage` | MMKV implementation |
| `PrinterPermissionService` | Platform permissions |
| `PrinterLogger` | Structured logging |
| `PrintMedia` | Print-job media configuration |
| `PrinterCapabilities` | Physical printer capabilities |

---

# 45. Final Execution Architecture

```text
                         ┌──────────────────┐
                         │        UI         │
                         └────────┬──────────┘
                                  ▼
                         ┌──────────────────┐
                         │   PrintService    │
                         └────────┬──────────┘
                                  ▼
                    ┌──────────────────────────┐
                    │   PrintRoutingService     │
                    └────────────┬──────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │      PrintScheduler       │
                    │  queue / order / lock     │
                    └────────────┬──────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │   PrinterPrintService     │
                    │   print() / testPrint()   │
                    └────────────┬──────────────┘
                                 ▼
        ┌────────────────────────┴─────────────────────────┐
        ▼                                                    ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│ PrinterConnectionService  │                    │      PrinterDriver       │
│ connect/disconnect/status │                    │      ESC/POS / TSPL      │
└────────────────────────────┘                    └────────────┬─────────────┘
                                                                 ▼
                                                    ┌──────────────────────────┐
                                                    │      IPrinterAdapter     │
                                                    └────────────┬─────────────┘
                                                                 ▼
                                                    ┌──────────────────────────┐
                                                    │        Transport         │
                                                    └────────────┬─────────────┘
                                                                 ▼
                                                    ┌──────────────────────────┐
                                                    │  Native / Vendor SDK     │
                                                    └────────────┬─────────────┘
                                                                 ▼
                                                         ┌──────────────────┐
                                                         │ Physical Printer │
                                                         └──────────────────┘
```

---

# 46. Production Invariants

1. `PrintType` and `PrinterDriverType` are independent.
2. A content type belongs to exactly one configured driver within a
   printer.
3. `identityKey` identifies a physical printer; depends only on
   `connection`.
4. `resourceKey` identifies a runtime concurrency boundary; must not be
   used for duplicate detection.
5. `PrinterConnectionService` owns connection lifecycle only.
6. `PrinterPrintService` owns print execution for one printer, and does
   not depend on `PrinterConnectionService`.
7. `PrintScheduler` owns queueing and concurrency.
8. `print()` must never acquire its own lock (deadlock risk); `testPrint()`
   must.
9. All operations touching the same runtime resource use the same lock.
10. `testPrint()` follows the same resource-locking rule as normal
    printing.
11. Transport/adapter binary data is `Uint8Array`; Base64 is a native
    bridge concern only.
12. Native Android APIs remain isolated inside native adapters.
13. `PrintMedia` belongs to `Printer` (not to any driver); `renderMode`
    belongs to each `PrinterDriverConfig` (not to `Printer`).
14. Die-cut cutter behavior is always normalized to `none`; continuous
    with unspecified `cutterMode` defaults to `per_job`.
15. `renderMode` is a hard contract — no fallback between render modes,
    ever (ESC/POS text↔bitmap, TSPL bitmap↔truetype↔internalfont).
16. TSPL TrueType font installation is unverified on hardware until
    tested — treat as a spike, not a production guarantee.
17. Printer configuration storage changes require a version bump;
    destructive reset, no field-by-field migration.
18. Native/runtime resources must never be stored in Redux state.
19. No generic manager/factory abstraction without a real, present
    responsibility requiring it.
20. No generic rendering abstraction without a stable shared contract
    across protocols.
21. Testing structure remains `testing/{printerFixtures,printerServiceTestKit}.ts`
    (fixtures, not `.test.` files) plus colocated `__tests__/` — unchanged.
22. Comments explain WHY, platform constraints, or hardware quirks — never
    obvious WHAT.

---

# 47. Refactor Migration (`services/` → responsibility folders)

```text
services/PrinterLogger.ts                    → logging/PrinterLogger.ts
services/PrinterConnectionService.ts         → connection/PrinterConnectionService.ts (print/testPrint removed)
services/PrinterConfigService.ts             → management/PrinterConfigService.ts
services/device/DeviceScanService.ts         → discovery/DeviceScanService.ts
services/device/NetworkInfoService.ts        → discovery/NetworkInfoService.ts
services/discovery/PrinterDiscoveryService.ts → discovery/PrinterDiscoveryService.ts
services/discovery/PrinterResolver.ts        → discovery/PrinterResolver.ts
services/permission/PrinterPermissionService.ts → permissions/PrinterPermissionService.ts
services/printing/PrintRoutingService.ts     → printing/PrintRoutingService.ts
services/printing/PrintScheduler.ts          → printing/PrintScheduler.ts
services/printing/PrintService.ts            → printing/PrintService.ts
services/connection/PrinterConnectionLock.ts → connection/PrinterConnectionLock.ts
(new)                                        → printing/PrinterPrintService.ts
```

After migration, `services/` is removed entirely (audited: exactly 12
files, all accounted for above).

`errors/`, `models/`, `adapters/`, `transports/`, `drivers/`, `storage/`,
`media/`, `components/`, `hooks/`, `forms/`, `store/`, `utils/`,
`testing/` keep their current location — not part of this migration.

---

# 48. Final Responsibility Separation

```text
"Which printers?"                    → PrintRoutingService
"When and in what order?"            → PrintScheduler
"How do I execute this print?"       → PrinterPrintService
"How do I connect?"                  → PrinterConnectionService
"How does this protocol work?"       → PrinterDriver
"How do I reach the native/library?" → IPrinterAdapter
"How do I communicate with the device?" → Transport
"How does Android/vendor SDK work?"  → Native Adapter
```

---

# 49. Acceptance Criteria

The refactored implementation is considered compliant when:

- [ ] `Printer.media: PrintMedia` exists top-level; removed from both
      `TsplDriverConfig`/`EscPosDriverConfig`.
- [ ] `PrinterConnection` is a discriminated union; the Zod schema uses
      `z.discriminatedUnion`.
- [ ] `PrinterPrintService` exists under `printing/`.
- [ ] `PrinterConnectionService` contains connection lifecycle only (no
      `print`/`testPrint`).
- [ ] `PrintScheduler` owns queueing and concurrency; calls
      `PrinterPrintService`, not `PrinterConnectionService`, for printing.
- [ ] `print()` does not call `lock.runExclusive`; `testPrint()` does.
- [ ] Drivers contain protocol-specific logic only.
- [ ] Transports/adapters contain communication logic only.
- [ ] Native Android APIs remain isolated inside `adapters/native/`.
- [ ] `identityKey` used for duplicate detection; `resourceKey` used for
      concurrency — never swapped.
- [ ] USB uses the shared `"usb"` resource boundary; ESC/POS Bluetooth/LAN
      use their namespaced boundaries; TSPL Bluetooth/LAN use
      per-connection boundaries.
- [ ] `PrintType` remains independent from `PrinterDriverType`.
- [ ] A content type maps to exactly one driver per printer.
- [ ] `PrinterCapabilities` remains separate from `PrintMedia`.
- [ ] TypeScript transport/adapter APIs use `Uint8Array`; Base64 stays a
      native-bridge-only concern.
- [ ] No native runtime object is stored in Redux.
- [ ] Storage version bumped for the new `Printer`/`PrinterConnection`
      shape; old data destructively reset, not migrated.
- [ ] Testing structure (`testing/` fixtures + colocated `__tests__/`)
      unchanged.
- [ ] `services/` is removed after migration (§47).
- [ ] `EscPosRenderMode`/`TsplRenderMode` remain separate types — no
      unified cross-protocol render-config type introduced.
- [ ] No fallback exists between any two render modes, for either
      protocol.

---

# 50. Architecture Summary

The printer architecture is built around six clear runtime
responsibilities:

```text
Routing → Scheduling → Print Execution → Connection → Driver → Transport
```

with platform integration isolated below transport (`Transport → Native
Adapter → Android/Vendor SDK`), and configuration concerns kept separate:
`discovery/`, `management/`, `storage/`, `permissions/`, `media/`,
`logging/`.

The most important boundary is:

```text
PrintScheduler → PrinterPrintService → PrinterConnectionService
```

because scheduling determines **when** a print happens, print execution
determines **what operation** is performed, and connection service
determines **how the printer connection lifecycle is managed**. This
separation lets the system support multiple drivers, multiple connection
types, shared native resources, concurrent printers, and test printing —
without any single service growing into a printer "god object".
