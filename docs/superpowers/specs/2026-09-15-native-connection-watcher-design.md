# Native Connection Watcher — Design

## Goal

The native thermal-printer module never proactively tells the TypeScript layer when a physical connection dies while idle — TS only discovers it on the next operation attempt (write/connect), which fails with a generic error. This design adds a live "connection lost" push notification from native to TS for USB and Bluetooth, so a driver's `onStatusChange` subscribers see `Disconnected` immediately when a printer is unplugged or drops out of range, without waiting for a failed print.

## Scope

- **In scope:** USB and Bluetooth. Both already have (or gain, for Bluetooth) an OS-level broadcast signal for physical disconnect, so detection is cheap and reliable.
- **Out of scope:** LAN (TCP). There is no OS signal for a silently-dead TCP peer; reliable detection needs a periodic probe (keepalive or timed read/write), which is a meaningfully different mechanism and cost (extra thread/battery). LAN dead-peer detection is a candidate follow-up design, not part of this one. LAN connections keep their current behavior (state only updates on the next explicit operation).
- **Out of scope:** auto-reconnect. The watcher's only job is to detect and notify. What happens after — whether a printer with `autoReconnect: true` reconnects — is entirely the JS layer's existing decision (`PrinterConnectionService.reconnectAutoPrinters()` / whatever already reacts to `onStatusChange`). The watcher does not call `connect()` itself.

## Architecture

One watcher instance per transport, owned by `ThermalPrinterModule` as a singleton (constructed once, alongside `usbPermission`). **Only `BluetoothConnectionWatcher` has its own `register()`/`unregister()` lifecycle** (it owns a `BroadcastReceiver`); `UsbConnectionWatcher` has neither — it has no receiver of its own, it only registers additional listeners with `UsbPermission`'s existing one (see below), so there is nothing for it to register/unregister at the module level.

```
ThermalPrinterModule
├── usbPermission: UsbPermission                    (existing)
├── usbConnectionWatcher: UsbConnectionWatcher       (new)
└── bluetoothConnectionWatcher: BluetoothConnectionWatcher  (new)
```

New files:
- `android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/usb/UsbConnectionWatcher.java`
- `android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/bluetooth/BluetoothConnectionWatcher.java`

Both expose the same shape:
```java
watch(ConnectionIdentity identity, /* transport-specific key */)
unwatch(ConnectionIdentity identity)
```
constructed with a single callback supplied by `ThermalPrinterModule`: `Consumer<ConnectionIdentity> onConnectionLost`.

### USB: extend the existing detach mechanism, don't duplicate it

`UsbPermission.deviceDetachListeners` currently holds exactly one `Runnable` per `vendorId:productId` key — already claimed by `UsbConnection`'s own constructor (`this::handleDetach`, the Task 4 fix that unblocks a pending permission wait on detach). `UsbConnectionWatcher` needs to observe the *same* physical event independently, without disturbing that existing, already-reviewed registration.

Fix: widen `UsbPermission`'s listener storage from single-value to multi-value:
```java
private final Map<String, Set<Runnable>> deviceDetachListeners = new ConcurrentHashMap<>();
private final Map<String, Set<Consumer<Boolean>>> permissionResultListeners = new ConcurrentHashMap<>();
```
(`ConcurrentHashMap.newKeySet()` for the per-key `Set`.) `registerDeviceDetachListener`/`unregisterDeviceDetachListener` (and the permission-result pair) add/remove from the set instead of replacing a single value. `handlePermissionResult`/`handleDeviceDetached` iterate the set and invoke every registered listener.

**Thread-safety, addressed at the same time:** these maps are already read/written from two different threads — the native-modules thread (via `register`/`unregister`, called from `connect()`/`disconnect()`) and the `BroadcastReceiver`'s callback thread (main/UI thread by default, since `register()` doesn't pass a `Handler`). The current single-value `HashMap` has no such protection; this was a latent gap, not previously flagged. Converting to `ConcurrentHashMap` + concurrent `Set` fixes it as a side effect of the multi-listener change — applied to *both* existing maps, not just where the watcher's new listener is added, since both are read/written across the same two threads.

`UsbConnectionWatcher.watch()` calls `usbPermission.registerDeviceDetachListener(vendorId, productId, () -> onConnectionLost.accept(identity))` — a second, independent listener alongside `UsbConnection`'s own. `unwatch()` calls the matching unregister. `UsbConnection`'s internal detach handling is untouched.

**`watch()` is self-cleaning:** it calls `unwatch(identity)` as its own first step before registering anything new. Without this, calling `watch()` twice for the same identity without an intervening `unwatch()` — a real sequence: device detaches (the listener fires but nothing unwatches, since the detach itself is what's being reported), then the same device reconnects and `connect()` calls `watch()` again — would leave the first listener permanently orphaned inside `UsbPermission`'s `Set` (this watcher's own bookkeeping would only reference the newest one, so it could never find and remove the old one), leaking it and causing the *next* detach to fire twice. `BluetoothConnectionWatcher.watch()` does the same for the same reason.

**Known limitation, out of scope for this design:** both `UsbPermission`'s detach-listener map and `UsbConnectionWatcher`'s bookkeeping key USB devices by `vendorId:productId` only, not the full `ConnectionIdentity` (which also incorporates the serial number when the device reports one). If two printers of the exact same model (same VID/PID, different serial) are physically connected at once, detaching one fires listeners for both, and the JS layer would see a spurious `Disconnected` for the printer that's still actually connected. This is a pre-existing gap — `UsbConnection`'s own permission-wait detach handling (predates this design) already keys the same way — not something this design introduces, and fixing it properly means reworking `UsbPermission`'s keying end-to-end (both the permission-result and detach paths), which is a separate change from adding a watcher. Tracked as a follow-up, not part of this design's scope.

### Bluetooth: new, self-contained watcher (no existing mechanism to extend)

`BluetoothConnection` today has no disconnect-broadcast listening at all. `BluetoothConnectionWatcher` is structurally a new instance of the same pattern `UsbPermission` already established:
- One `BroadcastReceiver` registered once (in the watcher's own `register()`, called from `ThermalPrinterModule`'s constructor) for `BluetoothDevice.ACTION_ACL_DISCONNECTED`.
- `Map<String address, Set<Runnable>> disconnectListeners` (`ConcurrentHashMap` + concurrent `Set` from the start, per the USB lesson above).
- `watch(identity, address)` registers a listener under `address`, **and** records `identity → address` in a second internal map (`Map<ConnectionIdentity, String> watchedAddresses`) so `unwatch(identity)` — called with only the identity, matching `UsbConnectionWatcher`'s symmetric API — can look up the right `address` and the exact listener instance to remove, without the caller re-supplying transport-specific parameters it may no longer have handy. `UsbConnectionWatcher` mirrors this with its own `Map<ConnectionIdentity, int[]> watchedDevices` (vendorId/productId pair) for the same reason.
- `unregister()` in `invalidate()`, alongside `usbConnectionWatcher.unregister()`.

## Module coordination

`ThermalPrinterModule.connect()`, after a device is successfully opened and registered:
```java
if (type == ConnectionType.USB) {
    usbConnectionWatcher.watch(identity, vendorId, productId);
} else if (type == ConnectionType.BLUETOOTH) {
    bluetoothConnectionWatcher.watch(identity, address);
}
```

`disconnect()`, when the identity's device is actually being torn down (last printerId referencing it — the existing ref-count check from the final review's Important #6 fix):
```java
if (type == ConnectionType.USB) {
    usbConnectionWatcher.unwatch(identity);
} else if (type == ConnectionType.BLUETOOTH) {
    bluetoothConnectionWatcher.unwatch(identity);
}
// ... existing queueManager.remove / deviceManager.remove / device.close()
```
`unwatch()` runs *before* the device is closed, so the watcher's own receiver doesn't observe (and doesn't need to distinguish) a disconnect it already knows is intentional.

`onConnectionLost(ConnectionIdentity identity)` (the shared callback both watchers invoke) tears the device down using the exact same three steps `disconnect()` already performs (`queueManager.remove` / `deviceManager.remove` / `device.close()`), extracted into one shared private `teardownDevice(identity)` helper on `ThermalPrinterModule` so the sequence exists once instead of duplicated between the two call sites:
```java
private void teardownDevice(ConnectionIdentity identity) {
    queueManager.remove(identity);
    IPrinterDevice device = deviceManager.remove(identity);
    if (device != null) device.close();
}

private void onConnectionLost(ConnectionIdentity identity) {
    teardownDevice(identity);
    emitConnectionLost(identity);
}
```
This stays a private helper on `ThermalPrinterModule` rather than moving into `PrinterDeviceManager` — `PrinterDeviceManager` has no knowledge of `PrinterQueueManager` today, and giving it one just to host this sequence would add a new cross-dependency between two currently-independent classes for no benefit `ThermalPrinterModule` (which already owns both) doesn't already provide.

Note `onConnectionLost` does **not** touch `connectedPrinters` or resolve any `printerId` — see below.

## Native → JS event contract

Native emits one event, no `printerId` involved:

```java
private void emitConnectionLost(ConnectionIdentity identity) {
    WritableMap payload = Arguments.createMap();
    payload.putString("identity", identity.getValue());
    getReactApplicationContext()
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit("ThermalPrinterConnectionLost", payload);
}
```
(`DeviceEventManagerModule.RCTDeviceEventEmitter` is React Native's actual class for this — `com.facebook.react.modules.core.DeviceEventManagerModule`.)

Rationale: native's business is physical connections, not printerId bookkeeping for this path. Resolving "which printerId(s) does this identity affect" is pushed to TS, where the driver already has that context from its own `connect()` call — native doesn't need to duplicate it via `connectedPrinters` lookups for this event (it still *maintains* `connectedPrinters` for its own `writeByBase64`/`disconnect` addressing, just doesn't consult it here).

## `connect()` starts returning the resolved identity

For TS to correlate a `ThermalPrinterConnectionLost` event's `identity` string back to a `printerId`, it needs to know what identity string native assigned to that connection — but only native can compute it (the exact string format — `"USB:" + vendorId + ":" + productId + ":" + serial`, `"BLUETOOTH:" + address` — is native-internal and shouldn't become an implicit cross-language contract TS re-derives independently).

Fix: `connect()` resolves with the identity instead of `null`:

- **Native:** `promise.resolve(identity.getValue())` (a plain string) instead of `promise.resolve(null)`.
- **TS (`PrinterNativeModule.ts`):** `connect: (request: ConnectRequest): Promise<string>` (was `Promise<void>`).
- **TS (`NativeAdapter.ts`, `UsbTransport.ts`):** capture and forward the resolved identity string up to their own callers instead of discarding it.

## TS wiring

`PrinterNativeModule.ts` gains:
```ts
export const subscribeConnectionLost = (callback: (identity: string) => void): Unsubscribe => {
  const subscription = DeviceEventEmitter.addListener('ThermalPrinterConnectionLost', (event: { identity: string }) => callback(event.identity));
  return () => subscription.remove();
};
```
Uses React Native's global `DeviceEventEmitter` directly rather than wrapping `NativeModules.ThermalPrinterModule` in a `NativeEventEmitter` — RN expects a module used that way to implement `addListener`/`removeListeners` itself, which `ThermalPrinterModule.java` doesn't (and doesn't need to, since `DeviceEventEmitter` is a global emitter, not module-scoped).

`EscPosDriver` and `TsplDriver` (both consumers of `NativeAdapter`, the only adapter this event applies to) each:
- Store the resolved identity alongside their existing per-`printerId` state (`identities: Map<string, string>`, populated in `connect()` from the native call's resolved value).
- Subscribe once, in their constructor:
```ts
subscribeConnectionLost((identity) => {
  for (const [printerId, knownIdentity] of this.identities) {
    if (knownIdentity === identity) {
      this.setStatus(printerId, PrinterStatus.Disconnected);
    }
  }
});
```
- Clear the `printerId → identity` entry in `disconnect()` alongside their other per-printerId cleanup.

If two `printerId`s share one physical identity (the native-side connection-reuse case), both are found and updated — correct, since they share one now-dead connection.

## Edge cases

- **Driver receives an event for an identity it doesn't recognize** (already disconnected, or belongs to the other driver type) — the loop above finds nothing, no-op.
- **Race between explicit `disconnect()` and a genuine concurrent OS disconnect event:** `unwatch()` runs before `close()`, so the intentional path never triggers `onConnectionLost`. If the OS event's broadcast is *already in flight* when `unwatch()` runs, the concurrent-safe `Set` (see thread-safety fix above) guarantees no corruption either way — worst case is a harmless extra `onConnectionLost` call after the identity is already gone, which is a no-op via the existing removal checks (`deviceManager.remove`/`queueManager.remove` already tolerate a missing key).
- **App/module teardown:** `invalidate()` calls `usbConnectionWatcher.unregister()` and `bluetoothConnectionWatcher.unregister()` alongside the existing `usbPermission.unregister()`, `deviceManager.closeAll()`, `queueManager.shutdown()`.

## Testing

- **Native:** no JVM/Android unit test harness exists in this project (unchanged constraint) — verified by compilation plus manual on-device testing. Extends the existing Task 7 manual checklist with: unplug a connected USB/Bluetooth printer *while idle* (no print in progress) and confirm the app's connection status updates to Disconnected immediately, without any further user action or failed print attempt.
- **TS:** `subscribeConnectionLost` is mockable via Jest (`NativeEventEmitter`/`DeviceEventEmitter` emission simulation) — new tests assert each driver's `onStatusChange` fires `Disconnected` when a matching identity event arrives, and does nothing for a non-matching one.

## Out of scope (explicitly deferred, not part of this design)

- LAN/TCP dead-peer detection (needs a probe mechanism, separate design).
- Auto-reconnect behavior triggered by watcher events (left entirely to existing JS-side logic).
- Any change to `writeByBase64`/`discoverPrinters` — untouched by this design.
- **USB detach-listener keying by full identity (incl. serial) instead of `vendorId:productId`** — see the "Known limitation" note under USB above. Real gap, pre-existing (predates this design), affects `UsbConnection`'s own permission-wait detach handling too, not just the new watcher. Fixing it means reworking `UsbPermission`'s keying end-to-end; tracked as a follow-up, not bundled into this design.
- **Centralizing `identity → printerId[]` correlation into a connection-service layer instead of each driver keeping its own `identities` map.** Considered during review; rejected for this design because `PrinterConnectionService` today is a stateless routing facade (delegates straight to `getDriver(type).onStatusChange(...)`) — the per-`printerId` state (`statuses`, `listeners`) already lives inside each driver (`EscPosDriver`, `TsplDriver`), so adding `identities` there follows the codebase's existing pattern. Centralizing all of it would be a larger, separate refactor of already-established state ownership, not something this design's scope calls for.
- **Proactively failing already-queued (not-yet-started) write jobs the instant a connection is lost**, rather than letting them attempt and fail naturally once they reach a closed device. `write()`/`close()` on every device implementation are `synchronized`, so this is a latency/UX nicety, not a correctness gap — no data corruption or crash risk either way. Candidate follow-up, not required here.
