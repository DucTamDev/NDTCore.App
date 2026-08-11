# Thermal Receipt Printer Driver — Replace EscPosDriver

## Context

`src/features/printer/drivers/EscPosDriver.ts` implements `IPrinterDriver` for
the `escpos` protocol using `react-native-esc-pos-printer` (Epson ePOS2 SDK).
An earlier draft on branch `feat/printer-driver-config` added the dependency
`@poriyaalar/react-native-thermal-receipt-printer` to `package.json` but never
wrote a driver that uses it; its committed plan doc
(`docs/superpowers/plans/2026-08-10-thermal-pos-printer-factory-migration.md`)
describes a *different*, unrelated package
(`react-native-thermal-pos-printer` by CoFixer) and is discarded — not used as
a basis for this spec. That branch's other commits (logging additions, a
`usePrinters` reactive-status hook, enabling web console logging) are
unrelated to printer driver selection and are left on that branch, not
carried into this one.

This spec replaces `EscPosDriver` outright with a new driver backed by
`@poriyaalar/react-native-thermal-receipt-printer`, on a fresh branch
`feat/thermal-receipt-printer-driver` off `main` — not a continuation of
`feat/printer-driver-config`, and not using a git worktree, matching this
repo's established pattern for this kind of work.

## Library API (researched, not yet hardware-verified)

`@poriyaalar/react-native-thermal-receipt-printer` (fork of
`react-native-thermal-receipt-printer`, adds USB auto-connect) exports three
independent namespaces, each with its own `init()`/`getDeviceList()`/
`connectPrinter(params)`/`printText()`/`closeConn()`:

- `USBPrinter` — Android only. `connectPrinter({ vendorID, productId })`.
- `BLEPrinter` — Android + iOS. `connectPrinter({ inner_mac_address })`.
- `NetPrinter` — Android + iOS. `connectPrinter({ host, port })`.

`printText()`/`printBill()` take a string with formatting tags (`<C>` center,
`<B>`/`<D>`/`<M>` font size, `<CB>`/`<CD>`/`<CM>` combined) instead of an
imperative builder API. No documented event-driven status API and no
vendor/model read-back API. UTF-8/Vietnamese diacritic support is not
documented either way — this is a real open risk, not something this spec can
resolve from documentation alone (see "Hardware verification" below).

## Goals

- `escpos` protocol printers connect through
  `@poriyaalar/react-native-thermal-receipt-printer` instead of the Epson SDK.
- No factory, no per-printer provider choice, no env-based switch — a direct,
  full replacement. `EscPosDriver` and `react-native-esc-pos-printer` are
  deleted, not kept for rollback.
- New driver fits the existing `IPrinterDriver` contract exactly like
  `TsplDriver` does today: one driver class, branching internally on
  `ConnectionType` to delegate to the right underlying transport/namespace,
  with lifecycle-driven (not polling) status tracking.
- Bluetooth runtime permission requests are added for **both** Bluetooth-using
  drivers (`ThermalReceiptDriver` and the pre-existing `TsplDriver`, which
  currently has no runtime permission request code at all) — an explicit,
  approved scope expansion beyond just the new driver.

## 1. `ThermalReceiptDriver`

New file `src/features/printer/drivers/ThermalReceiptDriver.ts` (+
`ThermalReceiptDriver.test.ts`), implementing `IPrinterDriver`:

- Maps `ConnectionType` → namespace: `usb` → `USBPrinter`, `bluetooth` →
  `BLEPrinter`, `lan` → `NetPrinter`.
- `scan(connectionType, onEvent)`:
  - `usb` on Android: `USBPrinter.init()` then `getDeviceList()`, emit
    `loading` → `found`/`empty`/`error`. On iOS: emit `error` with
    `UNSUPPORTED_CONNECTION` immediately (mirrors `TsplDriver.scan('usb')`'s
    existing `UNSUPPORTED_CONNECTION` pattern for TSPL-over-USB), no library
    call.
  - `bluetooth`: call `PrinterPermissionService.ensureBluetoothPermission()`
    first (see §2); if denied, emit `error`. Otherwise `BLEPrinter.init()`
    then `getDeviceList()`, same loading/found/empty/error shape.
  - `lan`: emit `empty` immediately, no library call — LAN printers are
    configured by manually entering `PrinterLanConfig.ip`/`port`, same as
    `TsplDriver.scan('lan')` today.
- `connect(config)`: set status `connecting`; branch on
  `config.connectionType`, call the matching namespace's `init()` (guarded so
  it only runs once per namespace, not once per connect) then
  `connectPrinter(...)` with the params built from `config.device`/`config.lan`
  (`vendorID`/`productId` parsed from `config.device.rawDevice` for USB,
  `config.device.deviceId` as `inner_mac_address` for BLE, `config.lan.ip`/
  `config.lan.port` for LAN); set `connected` on success, `error` + rethrow on
  failure — matching `EscPosDriver.connect()`/`TsplDriver.connect()`'s
  existing try/catch/setStatus shape exactly.
- `disconnect(printerId)`: `closeConn()` on the tracked namespace for that
  printer, set `disconnected`.
- `getStatus`/`onStatusChange`: local `Map`/listener-`Set` bookkeeping,
  identical pattern to `EscPosDriver`/`TsplDriver` — no polling, driven only
  by `connect`/`disconnect` lifecycle and connection failures.
- `testPrint(config)`: connect if not already connected, then
  `printText('<C>NDTCore POS - In thu\n</C>')` (or the closest equivalent tag
  combination available) via the matching namespace.
- `identify(printerId)`: the library has no vendor/model read-back API. Return
  `{ deviceName: <namespace>.deviceName-equivalent }` if a connection is
  currently tracked for that printer, `null` otherwise — same limitation
  `EscPosDriver.identify()` already has today (documented there, not new).

## 2. `PrinterPermissionService` (new, shared by both Bluetooth drivers)

New file `src/features/printer/services/PrinterPermissionService.ts` (+
`.test.ts`):

```ts
export async function ensureBluetoothPermission(): Promise<boolean>
```

- Android, API 31+ (`Platform.Version >= 31`): request
  `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` via `PermissionsAndroid.requestMultiple`.
- Android, below API 31: request legacy `BLUETOOTH`/`BLUETOOTH_ADMIN` +
  `ACCESS_FINE_LOCATION` (required pre-Android-12 for Bluetooth discovery).
- iOS/web: return `true` immediately — no JS-side request; iOS handles the
  system prompt from the `Info.plist` usage-description key automatically
  when the native Bluetooth API is first touched.
- Returns `false` (not throw) when the user denies — callers turn that into a
  `DeviceScanEvent`/error the same way a connection failure is surfaced today,
  not a new error shape.

Call sites:
- `ThermalReceiptDriver.scan('bluetooth')` and the `bluetooth` branch of
  `ThermalReceiptDriver.connect()`.
- `TsplDriver.scan('bluetooth')` (before `RNBluetoothClassic.startDiscovery()`)
  and `TsplDriver.connect()`'s `bluetooth` branch (before delegating to
  `BluetoothTransport.connect()`) — `BluetoothTransport` itself stays a plain
  transport with no permission logic, matching its current single
  responsibility (write/read/close over an already-permitted connection).

`AndroidManifest.xml` gains static declarations for `BLUETOOTH_SCAN`,
`BLUETOOTH_CONNECT`, plus legacy `BLUETOOTH`/`BLUETOOTH_ADMIN` (a static
declaration is required in addition to the runtime request).

## 3. Removing `EscPosDriver`

- Delete `src/features/printer/drivers/EscPosDriver.ts` and
  `EscPosDriver.test.ts`.
- `DriverRegistry.ts`: `escpos: new ThermalReceiptDriver()` replacing
  `escpos: new EscPosDriver()`. `DriverRegistry.web.ts` is untouched — web
  keeps using `webUnsupportedDriver` for both protocols, so the web bundle
  never imports the new native package either.
- Remove `react-native-esc-pos-printer` from `package.json` + lockfile.
- `discoverProtocol.ts`/`PrinterService.ts`: no changes — both only depend on
  `IPrinterDriver`, never on which package backs `escpos`.
- Add `@poriyaalar/react-native-thermal-receipt-printer` to `package.json` +
  lockfile fresh on this branch (not cherry-picked from the old draft).

## 4. Native setup

- Android: add the Bluetooth permissions from §2 to `AndroidManifest.xml`.
  Only one ESC/POS SDK is linked now (Epson SDK removed), so there is no
  dual-native-dependency conflict risk to verify — this branch is net simpler
  on the native side than the earlier factory draft would have been.
- iOS: no Flipper-related changes — this project has no Flipper
  configuration in `ios/Podfile` or `AppDelegate` (checked; the new library's
  README's Flipper/`CocoaAsyncSocket` conflict note doesn't apply here). Run
  `pod install` after removing the Epson pod and adding the new one.

## 5. Hardware verification (explicit limitation)

Nothing in this spec has been tested against a physical thermal printer —
the driver is implemented strictly from the library's documented API. Before
this branch is treated as production-ready, a human must verify on real
hardware:

- USB connect + `testPrint` on Android.
- Bluetooth pairing/permission prompt, connect, `testPrint` on Android and iOS.
- LAN connect (manual IP/port) + `testPrint` on Android and iOS.
- Vietnamese text with diacritics prints correctly (undocumented risk).
- Reconnect after app restart for each connection type.
- Permission-denied path: deny the Bluetooth prompt, confirm the app shows an
  error instead of hanging or crashing.

The implementation plan includes a written acceptance checklist for this, but
does not claim it as done — that gate is the user's to run and confirm.

## Testing

- `ThermalReceiptDriver.test.ts` — mirrors `TsplDriver.test.ts`'s structure:
  mock the three namespaces, assert scan/connect/disconnect/testPrint/identify
  branch correctly per `connectionType`, status transitions, and the
  iOS-USB-unsupported path.
- `PrinterPermissionService.test.ts` — mock `PermissionsAndroid`/`Platform`,
  assert the API-31-vs-legacy branch, the iOS/web no-op path, and that denial
  returns `false` rather than throwing.
- `TsplDriver.test.ts` gains cases for the new permission-check call sites
  (granted → proceeds as before; denied → surfaces as today's existing error
  event, not a new path).
- No test files for `DriverRegistry.ts` changes (already untested — it's a
  static wiring object, consistent with existing convention) or
  `AndroidManifest.xml`.

## Out of scope

- Any factory, env var, or per-printer provider selection (explicitly
  rejected this session).
- Rebuilding `EscPosDriver` for rollback — this is a full replacement.
- Real order-receipt printing/composition — the printer module today only
  supports admin-configured `testPrint`; this spec keeps that same scope,
  just swaps the underlying SDK.
- Runtime permission handling for USB (OS-level system dialog triggered by
  the library itself, not app-requested).
- The abandoned `feat/printer-driver-config` branch's unrelated commits
  (logging, `usePrinters` reactive hook, web console logging) — left as-is on
  that branch, not merged or cherry-picked here.

## Cleanup

`feat/printer-driver-config` is superseded for the driver-selection purpose
but contains unrelated commits that may still have value (the `usePrinters`
hook in particular). Do not delete that branch as part of finishing this
one — ask the user separately once this branch's work is reviewed.
