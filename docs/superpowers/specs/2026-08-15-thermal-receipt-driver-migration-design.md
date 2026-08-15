# Thermal Receipt Driver Migration — Switch `escpos` Protocol to ThermalReceiptDriver

## Context

`src/features/printer/drivers/EscPosDriver.ts` implements `IPrinterDriver` for
the `escpos` protocol using `react-native-esc-pos-printer` (Epson ePOS2 SDK).
This spec replaces it with `ThermalReceiptDriver`, backed by
`@poriyaalar/react-native-thermal-receipt-printer` — chosen for being simpler
and less SDK-specific than the Epson wrapper, not because of a hardware defect
in the current driver.

This work already has a design: `docs/superpowers/specs/2026-08-12-thermal-receipt-printer-driver-design.md`
(and its implementation plan, `docs/superpowers/plans/2026-08-12-thermal-receipt-printer-driver.md`),
built and committed on a separate branch `feat/thermal-receipt-printer-driver`
(12 commits off `main`), including a follow-up commit adding structured
`PrinterLogger` tracing. That work is real, reviewed-quality, and — per its
own explicit limitation section — **not yet hardware-verified**.

It cannot be merged directly. This branch (`feat/switch-to-thermal-receipt-driver`,
forked from `feat/printer-printing-system`) has 44 commits of independent
history the other branch never saw, including the entire print-configuration
system: `PrintDocument`/`PrintElement`, `PrintService`, `PrintScheduler`, and
— critically — a `print(printerId, document): Promise<void>` method added to
the `IPrinterDriver` interface itself. The 2026-08-12 spec predates all of
that; its own "Out of scope" section says so explicitly: *"Real order-receipt
printing/composition — the printer module today only supports admin-configured
testPrint."* `ThermalReceiptDriver` as built on that branch has no `print()`
method at all — it would not compile against this branch's `IPrinterDriver`.

**This spec's job**, therefore, is two things:
1. **Port** the already-designed, already-reasoned-through work (driver core,
   `PrinterPermissionService`, `PrinterLogger`, native setup) onto this branch
   as fresh commits — not a `git merge` (the two histories are too divergent
   in shared files like `TsplDriver.ts` to merge cleanly; `TsplDriver.ts` on
   the other branch is itself an *older* revision, pre-`print()`). Reapply the
   same edits onto this branch's current files instead of copying files
   wholesale.
2. **Newly design** `ThermalReceiptDriver.print(printerId, document)` — a
   requirement that did not exist when the original spec was written.

Everything in §1-§3 and §5-§7 below is a port of already-approved design;
only §4 (`print()`) is new design work from this session.

## Goals

- `escpos` protocol printers connect through
  `@poriyaalar/react-native-thermal-receipt-printer` instead of the Epson SDK
  — full replacement, no factory, no per-printer provider choice, no
  env-based switch.
- `ThermalReceiptDriver` implements every `IPrinterDriver` method, including
  `print()`, to the same contract `EscPosDriver`/`TsplDriver` satisfy today.
- Bluetooth runtime permission (`PrinterPermissionService`) shared by
  `ThermalReceiptDriver` and `TsplDriver` — `TsplDriver` currently has no
  runtime permission request code at all, an existing gap this closes for
  both drivers at once.
- Structured printer-domain logging (`PrinterLogger`, built on top of the
  existing `LoggerService` — not a competing logging system) wired into
  scan/connect/disconnect/testPrint/permission/protocol-detection, and now
  also `print()` (new, this spec).
- Nothing here is claimed hardware-verified. Ships with an explicit
  acceptance checklist, same rigor as the original spec.

## Non-Goals

- No factory, env var, or per-printer provider selection.
- No rollback path kept — `EscPosDriver` and `react-native-esc-pos-printer`
  are fully removed, not kept side-by-side.
- No barcode/qrCode/image printing via `ThermalReceiptDriver` (new decision,
  this session — see §4). Throws `ENCODING_FAILED`, the same way
  `EscPosDriver` already handles a genuinely-unsupported element type.
  Nothing in the app currently constructs a `barcode`/`qrCode`/`image`
  `PrintElement` — only driver unit tests exercise those types today — so
  this is not a regression of any live feature.
- No USB runtime permission handling (OS-level system dialog, unchanged).

## 1. Port: `ThermalReceiptDriver` core

New file `src/features/printer/drivers/ThermalReceiptDriver.ts` (+
`ThermalReceiptDriver.test.ts`), ported from
`feat/thermal-receipt-printer-driver` — implements every `IPrinterDriver`
method except `print()` (added fresh, §4):

- Maps `ConnectionType` → library namespace: `usb` → `USBPrinter`,
  `bluetooth` → `BLEPrinter`, `lan` → `NetPrinter`.
- `scan`: `usb` on Android calls `USBPrinter.init()`/`getDeviceList()`; on iOS
  emits `UNSUPPORTED_CONNECTION` immediately (mirrors `TsplDriver.scan('usb')`).
  `bluetooth` calls `ensureBluetoothPermission()` first, then
  `BLEPrinter.init()`/`getDeviceList()`. `lan` emits `empty` immediately — LAN
  printers are configured by manually entering IP/port, same as `TsplDriver`.
- `connect`: branches on `connectionType`, calls the matching namespace's
  `init()` (once per namespace) then `connectPrinter(...)` with params built
  from `config.device`/`config.lan`. Tracks which printer currently "owns"
  each namespace's single native connection (`activeByType` map) — the
  library holds exactly one live connection per namespace, so connecting a
  second printer of the same `connectionType` silently steals the native
  connection out from under the first. This tracking makes `testPrint`/
  `disconnect`/`print` (§4) refuse to act on a printer that has been silently
  disowned, rather than operating on a connection that's no longer theirs.
- `disconnect`/`getStatus`/`onStatusChange`: local `Map`/listener-`Set`
  bookkeeping identical to `EscPosDriver`/`TsplDriver` — event-driven, no
  polling.
- `testPrint`: connects if not already the active owner for that
  `connectionType`, then sends a fixed test string via the namespace's
  `printText()`, wrapped in a `Promise` (the library's `printText` is
  callback-based, not `Promise`-returning).
- `identify`: the library exposes no vendor/model read-back API. Returns
  `{ deviceName }` from the value already captured at `connect()` time if a
  connection is tracked for that printer, `null` otherwise — the same
  limitation `EscPosDriver.identify()` already documents.

## 2. Port: `PrinterPermissionService`

New file `src/features/printer/services/PrinterPermissionService.ts` (+
`.test.ts`):

```ts
export async function ensureBluetoothPermission(): Promise<boolean>
```

- Android API 31+: requests `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` via
  `PermissionsAndroid.requestMultiple`.
- Android below API 31: requests legacy `BLUETOOTH`/`BLUETOOTH_ADMIN` +
  `ACCESS_FINE_LOCATION` (required pre-Android-12 for Bluetooth discovery).
- iOS/web: returns `true` immediately — no JS-side request; iOS shows its
  system prompt automatically from the `Info.plist` usage-description key.
- Returns `false` on denial (never throws) — callers turn that into the same
  kind of error/event a connection failure already produces.

Call sites (both existing and new):
- `ThermalReceiptDriver.scan('bluetooth')` and `connect()`'s `bluetooth` branch.
- `TsplDriver.scan('bluetooth')` (before `RNBluetoothClassic.startDiscovery()`)
  and `TsplDriver.connect()`'s `bluetooth` branch (before delegating to
  `BluetoothTransport.connect()`) — applied as a patch to this branch's
  *current* `TsplDriver.ts` (which already has `print()` from the
  print-configuration work), not copied from the other branch's older
  revision of that file. `BluetoothTransport` itself stays untouched — a
  plain transport with no permission logic.

`AndroidManifest.xml` gains static declarations for `BLUETOOTH_SCAN`,
`BLUETOOTH_CONNECT`, plus legacy `BLUETOOTH`/`BLUETOOTH_ADMIN` (required in
addition to the runtime request).

## 3. Port: `PrinterLogger`

New file `src/features/printer/services/PrinterLogger.ts` (+ `.test.ts`) — one
function per event, each a thin wrapper over the existing `LoggerService`
(`info`/`warning`/`error`, all already present on this branch's
`LoggerService`, no changes needed there):

```ts
export const PrinterLogger = {
  scanCompleted(params: { connectionType, deviceCount, durationMs }): void,
  scanFailed(params: { connectionType, errorCode, durationMs }): void,
  connectSucceeded(params: { printerId, protocol, connectionType, durationMs }): void,
  connectFailed(params: { printerId, protocol, connectionType, errorCode, durationMs }): void,
  disconnectSucceeded(params: { printerId, protocol }): void,
  testPrintSucceeded(params: { printerId, protocol, durationMs }): void,
  testPrintFailed(params: { printerId, protocol, errorCode, durationMs }): void,
  permissionDenied(params: { connectionType }): void,
  protocolDetected(params: { printerId, protocol, connectionType }): void,
  protocolUnknown(params: { printerId, connectionType }): void,
};
```

Deliberately narrow parameter shapes: only `printerId`/`protocol`/
`connectionType`/`errorCode`/`durationMs` — never MAC address, IP, raw device
object, or receipt content, so nothing sensitive reaches logs even if they're
later shipped off-device.

Wired into: `PrinterPermissionService` (`permissionDenied`), `TsplDriver` and
`ThermalReceiptDriver` (`scanCompleted`/`scanFailed`/`connectSucceeded`/
`connectFailed`/`disconnectSucceeded`/`testPrintSucceeded`/`testPrintFailed`),
`discoverProtocol.ts` (`protocolDetected`/`protocolUnknown`). `testPrint()` in
both drivers gains a minimal try/catch solely to observe and rethrow failures
(previously unhandled) — no behavior change beyond the observation.

**New this spec:** `print()` (§4) gets the same treatment —
`printSucceeded`/`printFailed` events added to `PrinterLogger`, wired the same
way as `testPrintSucceeded`/`testPrintFailed`.

## 4. New: `ThermalReceiptDriver.print(printerId, document)`

`IPrinterDriver.print(printerId: string, document: PrintDocument): Promise<void>`
must translate `PrintElement[]` into calls against
`@poriyaalar/react-native-thermal-receipt-printer`'s API. Verified against the
real installed `.d.ts` and README (not assumed):

- `printText(text, opts, cbSuccess, cbErr)` — single string, callback-based
  (already wrapped as a `Promise` by `printTextAsync` in §1). Supports
  formatting tags: `<C>` center, `<D>`/`<M>` medium, `<B>` large, `<CM>`/`<CB>`
  centered-medium, `<CD>` centered-large. No table/column tag.
  `printBill()` exists but is not used here — same tag language as
  `printText()`, no additional structure the current `PrintElement` model
  needs.
  `printImageBase64(base64, opts, ...)` exists but takes a real base64 string,
  not a URI — `EscPosDriver.print()`'s `image` handling uses
  `element.data` as a URI (`source: { uri: element.data }`), a format
  mismatch this spec does not resolve (see Non-Goals).
- No barcode/QR API of any kind — the Epson SDK draws barcodes/QR codes with
  native hardware commands; this library has nothing equivalent. Rendering
  one client-side (a new dependency to generate a barcode/QR image, then
  `printImageBase64`) is out of scope (see Non-Goals).

**Design:**

```ts
async print(printerId: string, document: PrintDocument): Promise<void> {
  const connectionType = this.connectedTypes.get(printerId);
  if (!connectionType || this.activeByType.get(connectionType) !== printerId) {
    throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Máy in chưa kết nối' });
  }

  // Validate every element BEFORE sending anything — matches EscPosDriver's
  // effective atomicity (its SDK only flushes to hardware once, on
  // sendData()); this driver has no equivalent buffering, so building the
  // full text up front and validating first is what keeps a partial,
  // half-formed receipt from ever reaching the printer.
  const lines: string[] = [];
  for (const element of document.elements) {
    if (element.type === 'text') lines.push(element.content);
    else if (element.type === 'line') lines.push('--------------------------------');
    else if (element.type === 'table') for (const row of element.rows) lines.push(row.join('  '));
    else throw new AppErrorException({ code: 'ENCODING_FAILED', message: `Loại nội dung in không được hỗ trợ: ${element.type}` });
  }

  const startedAt = Date.now();
  try {
    await this.printTextAsync(connectionType, `${lines.join('\n')}\n`);
    PrinterLogger.printSucceeded({ printerId, protocol: 'escpos', durationMs: Date.now() - startedAt });
  } catch (error) {
    PrinterLogger.printFailed({ printerId, protocol: 'escpos', errorCode: errorCodeOf(error), durationMs: Date.now() - startedAt });
    throw error;
  }
}
```

Notes:
- Connection-ownership check (`isStaleOwner`) mirrors `testPrint()`'s existing
  logic (§1) — reuses the same `activeByType` bookkeeping, no new state.
- Table rows use plain `join('  ')`, matching `EscPosDriver.print()`'s current
  behavior exactly (neither driver does real column-width alignment today —
  not a regression, not something this spec introduces or fixes).
- No connect-on-demand (unlike `testPrint()`, which auto-connects). `print()`
  throwing `CONNECTION_ERROR` when not connected matches
  `EscPosDriver.print()`'s current behavior — `PrintScheduler`/`PrinterService`
  already handle connecting before printing at a higher layer (this spec does
  not change that layer).

## 5. Removing `EscPosDriver`

- Delete `src/features/printer/drivers/EscPosDriver.ts` and
  `EscPosDriver.test.ts`.
- `DriverRegistry.ts`: `escpos: new ThermalReceiptDriver()` replacing
  `escpos: new EscPosDriver()`. `DriverRegistry.web.ts` untouched.
- Remove `react-native-esc-pos-printer` from `package.json` + lockfile.
  `@poriyaalar/react-native-thermal-receipt-printer@1.4.2` is already
  installed on this branch (added this session, to read its real `.d.ts`).
- `PrintService.ts`/`PrinterService.ts`/`discoverProtocol.ts`: no changes
  beyond §3's logging additions — all depend only on `IPrinterDriver`, never
  on which package backs `escpos`.

## 6. Reconciling `printerDetectionRules.ts` fallback order

The fallback catch-all rule's candidate order flips from
`['escpos', 'tspl']` to `['tspl', 'escpos']`. Reason: `TsplDriver.identify()`
sends a real TSPL-specific probe command (`~!T`) and checks for a matching
response — a genuine discriminator. `ThermalReceiptDriver.identify()` (§1)
can only confirm "a connection was established and, for USB/BLE, a
`device_name` came back" — for LAN specifically, `connectPrinter()` succeeds
against any TCP listener on that port (including a TSPL printer), and the
`device_name` returned is just a library-constructed `host:port` string, not
a real device identity. Trying `tspl` first avoids misidentifying a TSPL
printer as ESC/POS on the low-confidence fallback path.

## 7. Native setup

- Android: add the Bluetooth permissions from §2 to `AndroidManifest.xml`.
  Only one ESC/POS SDK is linked after this change (Epson SDK removed) — no
  dual-native-dependency conflict to verify.
- iOS: no Flipper-related changes needed (checked — this project has no
  Flipper configuration in `ios/Podfile`/`AppDelegate`, so the library
  README's Flipper/`CocoaAsyncSocket` conflict note doesn't apply). Run
  `pod install` after removing the Epson pod and adding the new one.

## Testing

- `ThermalReceiptDriver.test.ts` — ported structure (mock the three
  namespaces, assert scan/connect/disconnect/testPrint/identify branch
  correctly per `connectionType`, status transitions, iOS-USB-unsupported
  path) **plus new cases for `print()`**: text/line/table elements produce
  the expected joined string sent to `printTextAsync`; a `barcode`/`qrCode`/
  `image` element throws `ENCODING_FAILED` before any `printTextAsync` call;
  not-connected and stale-owner both throw `CONNECTION_ERROR`; success and
  failure both call the right `PrinterLogger` method.
- `PrinterPermissionService.test.ts` — ported (API-31-vs-legacy branch,
  iOS/web no-op, denial returns `false` not throw).
- `PrinterLogger.test.ts` — ported, plus `printSucceeded`/`printFailed` cases.
- `TsplDriver.test.ts` — gains the ported permission-check and logging cases,
  applied against this branch's current file (which already has `print()`
  tests from the print-configuration work — untouched by this spec).
- `jest.setup.js` — global mock for `@poriyaalar/react-native-thermal-receipt-printer`
  replaces the `react-native-esc-pos-printer` mock (ported).
- No test files for `DriverRegistry.ts` (static wiring, existing convention)
  or `AndroidManifest.xml`.

## Hardware verification (explicit limitation)

Nothing in this spec is hardware-tested. Before this branch is production-ready,
a human must verify on real hardware — extends the original spec's checklist
with the new `print()` path:

- USB connect + `testPrint` + `print()` (a real receipt) on Android.
- Bluetooth pairing/permission prompt, connect, `testPrint` + `print()` on
  Android and iOS.
- LAN connect (manual IP/port) + `testPrint` + `print()` on Android and iOS.
- Vietnamese text with diacritics prints correctly through `printText()` —
  undocumented by the library, a real open risk carried over from the
  original spec, now also relevant to real receipt content (not just the
  fixed test string).
- Reconnect after app restart for each connection type.
- Permission-denied path: deny the Bluetooth prompt, confirm an error is
  shown instead of a hang or crash.
- Connecting a second printer on the same `connectionType` while a receipt
  print is in flight on the first — confirm the stale-owner check in `print()`
  (§4) actually prevents a mis-delivered receipt, not just a mis-delivered
  test print.

## Out of scope

- Any factory, env var, or per-printer provider selection.
- Rebuilding `EscPosDriver` for rollback.
- Barcode/QR/image printing via `ThermalReceiptDriver` (§4, Non-Goals).
- Real column-aligned table formatting (neither driver has this today).
- USB runtime permission handling (OS-level, unchanged).
