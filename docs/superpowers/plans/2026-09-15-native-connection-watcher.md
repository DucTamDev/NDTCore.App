# Native Connection Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push a live "connection lost" notification from native Android to the TS layer when a USB or Bluetooth printer is physically unplugged/goes out of range while idle, instead of TS only discovering it on the next failed operation.

**Architecture:** One singleton watcher per transport (`UsbConnectionWatcher`, `BluetoothConnectionWatcher`), owned by `ThermalPrinterModule`. USB reuses the existing `UsbPermission` detach-broadcast mechanism (widened to support multiple independent listeners per device); Bluetooth gets a new, analogous `BroadcastReceiver` for `ACTION_ACL_DISCONNECTED`. On detection, the module tears down the dead connection and emits one `ThermalPrinterConnectionLost` event carrying only a `ConnectionIdentity` string — never a `printerId`, which is a TS-side/business concept native doesn't need for this path. `connect()` starts resolving with the identity string it assigned, so each driver (`EscPosDriver`, `TsplDriver`) can record its own `printerId → identity` mapping locally and correlate incoming events without native ever needing to know about `printerId` here.

**Tech Stack:** Java (Android — no new dependencies), React Native bridge (`DeviceEventManagerModule.RCTDeviceEventEmitter` for the new event, `Promise` for existing calls), TypeScript (`DeviceEventEmitter`, Jest).

**Spec:** `docs/superpowers/specs/2026-09-15-native-connection-watcher-design.md` — read it for the full rationale (why LAN and auto-reconnect are out of scope, why events carry identity not printerId, the USB listener-conflict resolution). This plan implements it with two small, justified refinements over the spec's sketch, noted inline where they occur: (1) `UsbConnectionWatcher` needs no `register()`/`unregister()` of its own — it has no receiver to own, it only piggybacks on `UsbPermission`'s existing one; (2) the TS event subscription uses React Native's global `DeviceEventEmitter` directly rather than wrapping `NativeModules.ThermalPrinterModule` in a `NativeEventEmitter`, since the native module doesn't implement the `addListener`/`removeListeners` pair RN expects when you do that.

## Global Constraints

- No Java/Android unit test harness exists in this project — verify native changes via `cd android && .\gradlew.bat compileDebugJavaWithJavac` (BUILD SUCCESSFUL expected), not test-first.
- No new Gradle dependencies, no AndroidManifest changes (Bluetooth permissions already declared).
- TS test files live in `__tests__/`, suffix `.test.ts` (existing convention).
- Every commit message must end with exactly: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (a fixed required literal, not a description of which model did the work — do not substitute).
- Out of scope, do not implement: LAN watcher, auto-reconnect logic triggered by watcher events, any change to `writeByBase64`/`discoverPrinters`.

---

## Task 1: Widen `UsbPermission` to support multiple listeners per device, and thread-safety

`UsbPermission`'s listener maps currently hold exactly one `Runnable`/`Consumer<Boolean>` per device key (a plain, non-thread-safe `HashMap`). `UsbConnectionWatcher` (Task 2) needs to register its own detach listener for a device *alongside* `UsbConnection`'s existing one (the Task 4 permission-wait fix, already shipped) — the single-value map can't hold both. This task widens both maps to multi-value, and fixes a latent thread-safety gap surfaced while doing so: these maps are read/written from two different threads (the native-modules thread via register/unregister, and the `BroadcastReceiver`'s callback thread) with no synchronization today.

Because unregistering now means "remove this one listener," not "clear whatever's registered," `UsbConnection.java`'s own registration must switch from inline lambdas/method-references (a fresh, non-`.equals()`-matching instance every time they're written) to a stored field reference, so the exact same instance is passed to both register and unregister.

**Files:**
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/usb/UsbPermission.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/usb/UsbConnection.java`

**Interfaces:**
- Produces: `UsbPermission.registerDeviceDetachListener(int, int, Runnable)` / `unregisterDeviceDetachListener(int, int, Runnable)` (now 3-arg, listener required on unregister) and the same pair for `registerPermissionResultListener`/`unregisterPermissionResultListener(int, int, Consumer<Boolean>)` — consumed by `UsbConnection` (this task) and `UsbConnectionWatcher` (Task 2).

- [ ] **Step 1: Rewrite `UsbPermission.java`'s listener storage and register/unregister methods**

Read the current file first, then apply these changes (everything not shown — `register()`, `unregister()`, `hasPermission()`, `requestPermission()`, the `BroadcastReceiver` field's outer `onReceive` dispatch, `getDeviceExtra()` — stays exactly as-is):

Replace the imports block:
```java
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;
import android.widget.Toast;

import com.facebook.react.bridge.ReactApplicationContext;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
```

Replace the field declarations and constructor:
```java
    private final ReactApplicationContext context;
    private final UsbManager usbManager;
    private PendingIntent permissionIntent;

    /**
     * Multiple independent listeners per device (e.g. UsbConnection's own
     * detach cleanup and UsbConnectionWatcher's JS-notification listener) —
     * ConcurrentHashMap + concurrent Set because these are read and written
     * from two different threads: the native-modules thread (register/
     * unregister, called from connect()/disconnect()) and the
     * BroadcastReceiver's callback thread (main/UI thread, since register()
     * below does not pass a Handler).
     */
    private final Map<String, Set<Runnable>> deviceDetachListeners = new ConcurrentHashMap<>();
    private final Map<String, Set<Consumer<Boolean>>> permissionResultListeners = new ConcurrentHashMap<>();

    public UsbPermission(ReactApplicationContext context) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }
```

Replace the four register/unregister methods (`registerDeviceDetachListener` through `unregisterPermissionResultListener`):
```java
    /**
     * Registers a detach callback keyed by (vendorId, productId) — a device
     * can have more than one listener (e.g. UsbConnection's own cleanup and
     * UsbConnectionWatcher's JS-notification listener), so this adds to the
     * set rather than replacing a single value.
     */
    public void registerDeviceDetachListener(int vendorId, int productId, Runnable listener) {
        deviceDetachListeners
                .computeIfAbsent(deviceKey(vendorId, productId), key -> ConcurrentHashMap.newKeySet())
                .add(listener);
    }

    /** Unregisters one detach callback — pass the exact instance given to registerDeviceDetachListener. */
    public void unregisterDeviceDetachListener(int vendorId, int productId, Runnable listener) {
        Set<Runnable> listeners = deviceDetachListeners.get(deviceKey(vendorId, productId));

        if (listeners != null) {
            listeners.remove(listener);
        }
    }

    private static String deviceKey(int vendorId, int productId) {
        return vendorId + ":" + productId;
    }

    /**
     * Registers a callback for the USB permission dialog's result, keyed by
     * (vendorId, productId) — lets a caller await the specific device's
     * grant/deny result instead of treating a pending dialog as success.
     */
    public void registerPermissionResultListener(int vendorId, int productId, Consumer<Boolean> listener) {
        permissionResultListeners
                .computeIfAbsent(deviceKey(vendorId, productId), key -> ConcurrentHashMap.newKeySet())
                .add(listener);
    }

    /** Unregisters one permission-result callback — pass the exact instance given to registerPermissionResultListener. */
    public void unregisterPermissionResultListener(int vendorId, int productId, Consumer<Boolean> listener) {
        Set<Consumer<Boolean>> listeners = permissionResultListeners.get(deviceKey(vendorId, productId));

        if (listeners != null) {
            listeners.remove(listener);
        }
    }
```

Replace `handlePermissionResult` and `handleDeviceDetached` (the part after resolving `device`/`key` — the Toast calls and `getDeviceExtra` usage stay the same):
```java
    private void handlePermissionResult(Context ctx, Intent intent) {
        boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
        Log.v(LOG_SOURCE, "permission result: granted=" + granted);

        if (!granted) {
            Toast.makeText(ctx, "User refuses to obtain USB device permissions", Toast.LENGTH_LONG).show();
        }

        UsbDevice device = getDeviceExtra(intent);

        if (device == null) {
            return;
        }

        Set<Consumer<Boolean>> listeners = permissionResultListeners.get(deviceKey(device.getVendorId(), device.getProductId()));

        if (listeners == null) {
            return;
        }

        for (Consumer<Boolean> listener : listeners) {
            listener.accept(granted);
        }
    }

    /**
     * Multiple UsbConnections can be active at once, so the detached device must
     * be read from EXTRA_DEVICE and only that device's listeners notified.
     */
    private void handleDeviceDetached(Context ctx, Intent intent) {
        Toast.makeText(ctx, "USB device has been turned off", Toast.LENGTH_LONG).show();

        UsbDevice device = getDeviceExtra(intent);

        if (device == null) {
            return;
        }

        Set<Runnable> listeners = deviceDetachListeners.get(deviceKey(device.getVendorId(), device.getProductId()));

        if (listeners == null) {
            return;
        }

        for (Runnable listener : listeners) {
            listener.run();
        }
    }
```

- [ ] **Step 2: Update `UsbConnection.java` to store and reuse its own listener instances**

Read the current file first. Two changes:

1. Add two fields (near the other fields, e.g. after `usbConnection`/`state`):
```java
    private final Runnable detachListener = this::handleDetach;
```
(There is no stored field needed for the permission-result listener across methods — it's created and used entirely within `awaitPermission()`'s own local scope, see below.)

2. In the constructor, change:
```java
        this.permission.registerDeviceDetachListener(device.getVendorId(), device.getProductId(), this::handleDetach);
```
to:
```java
        this.permission.registerDeviceDetachListener(device.getVendorId(), device.getProductId(), detachListener);
```

3. In `close()`, change:
```java
        permission.unregisterDeviceDetachListener(device.getVendorId(), device.getProductId());
```
to:
```java
        permission.unregisterDeviceDetachListener(device.getVendorId(), device.getProductId(), detachListener);
```

4. In `awaitPermission()`, change:
```java
    private boolean awaitPermission() {
        CompletableFuture<Boolean> future = new CompletableFuture<>();
        int vendorId = device.getVendorId();
        int productId = device.getProductId();

        permission.registerPermissionResultListener(vendorId, productId, future::complete);
        permission.requestPermission(device);

        try {
            return future.get(PERMISSION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        } catch (ExecutionException | TimeoutException exception) {
            return false;
        } finally {
            permission.unregisterPermissionResultListener(vendorId, productId);
        }
    }
```
to:
```java
    private boolean awaitPermission() {
        CompletableFuture<Boolean> future = new CompletableFuture<>();
        Consumer<Boolean> permissionResultListener = future::complete;
        int vendorId = device.getVendorId();
        int productId = device.getProductId();

        permission.registerPermissionResultListener(vendorId, productId, permissionResultListener);
        permission.requestPermission(device);

        try {
            return future.get(PERMISSION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        } catch (ExecutionException | TimeoutException exception) {
            return false;
        } finally {
            permission.unregisterPermissionResultListener(vendorId, productId, permissionResultListener);
        }
    }
```
Add the import `java.util.function.Consumer` if not already present (check the current imports first).

- [ ] **Step 3: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/usb/UsbPermission.java \
        android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/usb/UsbConnection.java
git commit -m "$(cat <<'EOF'
feat: support multiple listeners per device in UsbPermission

UsbConnectionWatcher (next task) needs to register its own detach
listener for a device alongside UsbConnection's existing one — the
previous single-value maps couldn't hold both. Widens
deviceDetachListeners/permissionResultListeners to
ConcurrentHashMap<String, Set<...>>, which also fixes a latent
thread-safety gap (these maps are read/written from both the
native-modules thread and the BroadcastReceiver's callback thread).
UsbConnection now stores its listener instances in fields so the same
instance is passed to register and unregister — required once
unregister means "remove this one listener" instead of "clear
whatever's there".

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `UsbConnectionWatcher`

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/usb/UsbConnectionWatcher.java`

**Interfaces:**
- Consumes: `UsbPermission.registerDeviceDetachListener(int, int, Runnable)` / `unregisterDeviceDetachListener(int, int, Runnable)` (Task 1), `model.ConnectionIdentity`.
- Produces: `UsbConnectionWatcher(UsbPermission, Consumer<ConnectionIdentity>)`, `.watch(ConnectionIdentity, int vendorId, int productId)`, `.unwatch(ConnectionIdentity)` — consumed by Task 4's `ThermalPrinterModule`.

- [ ] **Step 1: Create the file**

```java
package com.ndtcorepos.thermalprinter.connection.usb;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.permission.usb.UsbPermission;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Watches connected USB printers for physical detach and reports it back to
 * the caller by ConnectionIdentity.
 *
 * Independent of UsbConnection's own detach handling (which only closes its
 * own resources) — this exists so a caller (the native module) can react for
 * its own reasons, such as pushing a disconnect event to JS. It has no
 * BroadcastReceiver of its own; it registers an additional listener with the
 * existing UsbPermission detach mechanism instead of duplicating it.
 */
public final class UsbConnectionWatcher {

    private final UsbPermission permission;
    private final Consumer<ConnectionIdentity> onConnectionLost;

    /** vendorId/productId a watched identity was registered under, so unwatch() needs only the identity. */
    private final Map<ConnectionIdentity, int[]> watchedDevices = new ConcurrentHashMap<>();

    /** The exact listener instance registered per identity, so unwatch() removes only this listener. */
    private final Map<ConnectionIdentity, Runnable> listeners = new ConcurrentHashMap<>();

    public UsbConnectionWatcher(UsbPermission permission, Consumer<ConnectionIdentity> onConnectionLost) {
        this.permission = permission;
        this.onConnectionLost = onConnectionLost;
    }

    /** Starts watching one physical USB device for detach. */
    public void watch(ConnectionIdentity identity, int vendorId, int productId) {
        Runnable listener = () -> onConnectionLost.accept(identity);

        watchedDevices.put(identity, new int[] { vendorId, productId });
        listeners.put(identity, listener);

        permission.registerDeviceDetachListener(vendorId, productId, listener);
    }

    /** Stops watching a device — call before intentionally closing its connection. */
    public void unwatch(ConnectionIdentity identity) {
        int[] device = watchedDevices.remove(identity);
        Runnable listener = listeners.remove(identity);

        if (device == null || listener == null) {
            return;
        }

        permission.unregisterDeviceDetachListener(device[0], device[1], listener);
    }
}
```

- [ ] **Step 2: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/usb/UsbConnectionWatcher.java
git commit -m "$(cat <<'EOF'
feat: add UsbConnectionWatcher

Reports physical USB detach by ConnectionIdentity via a callback,
independent of UsbConnection's own cleanup. Rides on UsbPermission's
existing detach-broadcast mechanism (Task 1's multi-listener support)
rather than registering a second BroadcastReceiver.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `BluetoothConnectionWatcher`

Unlike USB, there is no existing Bluetooth disconnect-broadcast listening anywhere in this codebase — this is a new, self-contained component.

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/bluetooth/BluetoothConnectionWatcher.java`

**Interfaces:**
- Consumes: `model.ConnectionIdentity`, Android `BluetoothDevice.ACTION_ACL_DISCONNECTED`.
- Produces: `BluetoothConnectionWatcher(ReactApplicationContext, Consumer<ConnectionIdentity>)`, `.register()`, `.unregister()`, `.watch(ConnectionIdentity, String address)`, `.unwatch(ConnectionIdentity)` — consumed by Task 4's `ThermalPrinterModule`.

- [ ] **Step 1: Create the file**

```java
package com.ndtcorepos.thermalprinter.connection.bluetooth;

import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Watches connected Bluetooth printers for ACL disconnect and reports it back
 * to the caller by ConnectionIdentity.
 *
 * Owns its own BroadcastReceiver — unlike USB, there is no existing
 * detach-listening mechanism to extend.
 */
public final class BluetoothConnectionWatcher {

    private final ReactApplicationContext context;
    private final Consumer<ConnectionIdentity> onConnectionLost;

    /** Listeners registered per bonded device address. */
    private final Map<String, Set<Runnable>> disconnectListeners = new ConcurrentHashMap<>();

    /** address a watched identity was registered under, so unwatch() needs only the identity. */
    private final Map<ConnectionIdentity, String> watchedAddresses = new ConcurrentHashMap<>();

    /** The exact listener instance registered per identity, so unwatch() removes only this listener. */
    private final Map<ConnectionIdentity, Runnable> listeners = new ConcurrentHashMap<>();

    public BluetoothConnectionWatcher(ReactApplicationContext context, Consumer<ConnectionIdentity> onConnectionLost) {
        this.context = context;
        this.onConnectionLost = onConnectionLost;
    }

    public void register() {
        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_ACL_DISCONNECTED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }
    }

    /** Undoes register() — call when the owning native module is torn down. */
    public void unregister() {
        context.unregisterReceiver(receiver);
    }

    /**
     * Starts watching one bonded Bluetooth device for ACL disconnect.
     *
     * Calls unwatch(identity) first so a stale prior registration for the
     * same identity (e.g. left behind because onConnectionLost fired without
     * a matching unwatch — see Task 2's UsbConnectionWatcher, which had this
     * exact leak-on-rewatch bug before its own review caught it) can never
     * accumulate: re-watching the same identity always ends with exactly one
     * live listener registered for it, never two.
     */
    public void watch(ConnectionIdentity identity, String address) {
        unwatch(identity);

        Runnable listener = () -> onConnectionLost.accept(identity);

        watchedAddresses.put(identity, address);
        listeners.put(identity, listener);

        disconnectListeners
                .computeIfAbsent(address, key -> ConcurrentHashMap.newKeySet())
                .add(listener);
    }

    /** Stops watching a device — call before intentionally disconnecting it. */
    public void unwatch(ConnectionIdentity identity) {
        String address = watchedAddresses.remove(identity);
        Runnable listener = listeners.remove(identity);

        if (address == null || listener == null) {
            return;
        }

        Set<Runnable> addressListeners = disconnectListeners.get(address);

        if (addressListeners != null) {
            addressListeners.remove(listener);
        }
    }

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            if (!BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(intent.getAction())) {
                return;
            }

            BluetoothDevice device = getDeviceExtra(intent);

            if (device == null) {
                return;
            }

            Set<Runnable> addressListeners = disconnectListeners.get(device.getAddress());

            if (addressListeners == null) {
                return;
            }

            for (Runnable listener : addressListeners) {
                listener.run();
            }
        }
    };

    /**
     * Reads the BluetoothDevice attached to the Intent — the Parcelable
     * getter's signature changed between SDK levels, hence the version
     * branch (same pattern as UsbPermission.getDeviceExtra).
     */
    @SuppressWarnings("deprecation")
    private static BluetoothDevice getDeviceExtra(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class);
        }
        return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
    }
}
```

- [ ] **Step 2: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/bluetooth/BluetoothConnectionWatcher.java
git commit -m "$(cat <<'EOF'
feat: add BluetoothConnectionWatcher

Reports Bluetooth ACL disconnect by ConnectionIdentity via a callback.
Registers its own BroadcastReceiver for ACTION_ACL_DISCONNECTED, keyed
by bonded device address — mirrors UsbPermission's structural pattern
since there's no existing Bluetooth disconnect-listening code to reuse.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire both watchers into `ThermalPrinterModule`, emit the event, resolve `connect()` with the identity

**Files:**
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java`

**Interfaces:**
- Consumes: `UsbConnectionWatcher` (Task 2), `BluetoothConnectionWatcher` (Task 3).
- Produces: `connect()` resolves the connection's `ConnectionIdentity.getValue()` string (was `null`) — consumed by Task 5's TS changes. Emits a `"ThermalPrinterConnectionLost"` device event with payload `{ identity: string }` — consumed by Task 5's `subscribeConnectionLost`.

- [ ] **Step 1: Add fields and construct both watchers**

Read the current file first. Add two fields near the existing `usbPermission` field:
```java
    private final UsbConnectionWatcher usbConnectionWatcher;
    private final BluetoothConnectionWatcher bluetoothConnectionWatcher;
```

In the constructor, after `this.usbPermission.register();`, add:
```java
        this.usbConnectionWatcher = new UsbConnectionWatcher(usbPermission, this::onConnectionLost);
        this.bluetoothConnectionWatcher = new BluetoothConnectionWatcher(reactContext, this::onConnectionLost);
        this.bluetoothConnectionWatcher.register();
```

Add imports:
```java
import com.ndtcorepos.thermalprinter.connection.bluetooth.BluetoothConnectionWatcher;
import com.ndtcorepos.thermalprinter.connection.usb.UsbConnectionWatcher;
import com.facebook.react.modules.core.DeviceEventManagerModule;
```
(`DeviceEventManagerModule` is used in Step 4 below.)

- [ ] **Step 2: Start watching on `connect()`, resolve with the identity**

In `connect()`, change:
```java
            if (device == null) {
                device = createDevice(type, identity, request, usbDevice);

                PrinterWriteResult result = device.open();

                if (!result.isSuccess()) {
                    promise.reject("CONNECT_FAILED", result.getErrorCode().name());
                    return;
                }

                deviceManager.register(device);
            }

            connectedPrinters.put(printerId, identity);
            promise.resolve(null);
```
to:
```java
            if (device == null) {
                device = createDevice(type, identity, request, usbDevice);

                PrinterWriteResult result = device.open();

                if (!result.isSuccess()) {
                    promise.reject("CONNECT_FAILED", result.getErrorCode().name());
                    return;
                }

                deviceManager.register(device);

                if (type == ConnectionType.USB) {
                    usbConnectionWatcher.watch(identity, usbDevice.getVendorId(), usbDevice.getProductId());
                } else if (type == ConnectionType.BLUETOOTH) {
                    bluetoothConnectionWatcher.watch(identity, request.getString("address"));
                }
            }

            connectedPrinters.put(printerId, identity);
            promise.resolve(identity.getValue());
```
(Watching only happens on the fresh-connect branch — a reused device is already being watched from when it was first opened.)

- [ ] **Step 3: Stop watching before intentionally closing, on `disconnect()`**

In `disconnect()`, change:
```java
            if (connectedPrinters.containsValue(identity)) {
                // Another printerId still shares this physical connection —
                // only forget this printerId's mapping, don't tear it down.
                promise.resolve(null);
                return;
            }

            queueManager.remove(identity);

            IPrinterDevice device = deviceManager.remove(identity);

            if (device != null) {
                device.close();
            }

            promise.resolve(null);
```
to:
```java
            if (connectedPrinters.containsValue(identity)) {
                // Another printerId still shares this physical connection —
                // only forget this printerId's mapping, don't tear it down.
                promise.resolve(null);
                return;
            }

            if (identity.getType() == ConnectionType.USB) {
                usbConnectionWatcher.unwatch(identity);
            } else if (identity.getType() == ConnectionType.BLUETOOTH) {
                bluetoothConnectionWatcher.unwatch(identity);
            }

            queueManager.remove(identity);

            IPrinterDevice device = deviceManager.remove(identity);

            if (device != null) {
                device.close();
            }

            promise.resolve(null);
```
(`unwatch()` runs *before* `device.close()`, so the watcher's own receiver never has to distinguish this from an unexpected disconnect — it simply isn't listening anymore by the time the connection actually closes.)

- [ ] **Step 4: Add `onConnectionLost()` and `emitConnectionLost()`**

Add these two new private methods (anywhere among the other private helpers, e.g. near `findUsbDevice`):
```java
    /**
     * Called by either watcher when a physical connection is lost outside an
     * explicit disconnect() call. Tears down the dead connection's runtime
     * state exactly like disconnect() does, then notifies JS — this method
     * does not touch connectedPrinters or resolve any printerId; that
     * correlation is left entirely to the TS side (see the design spec).
     */
    private void onConnectionLost(ConnectionIdentity identity) {
        queueManager.remove(identity);

        IPrinterDevice device = deviceManager.remove(identity);

        if (device != null) {
            device.close();
        }

        emitConnectionLost(identity);
    }

    private void emitConnectionLost(ConnectionIdentity identity) {
        WritableMap payload = Arguments.createMap();
        payload.putString("identity", identity.getValue());

        getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("ThermalPrinterConnectionLost", payload);
    }
```

- [ ] **Step 5: Release the Bluetooth watcher's receiver on teardown**

In `invalidate()`, change:
```java
    @Override
    public void invalidate() {
        usbPermission.unregister();
        deviceManager.closeAll();
        queueManager.shutdown();
        super.invalidate();
    }
```
to:
```java
    @Override
    public void invalidate() {
        usbPermission.unregister();
        bluetoothConnectionWatcher.unregister();
        deviceManager.closeAll();
        queueManager.shutdown();
        super.invalidate();
    }
```
(`usbConnectionWatcher` owns no receiver of its own — nothing to unregister for it.)

- [ ] **Step 6: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java
git commit -m "$(cat <<'EOF'
feat: wire connection watchers into ThermalPrinterModule, emit disconnect events

connect() now starts watching the physical device for detach right
after it's freshly opened, and resolves with the ConnectionIdentity
string it assigned (was null) so TS can correlate later events without
duplicating native's identity-formatting logic. disconnect() stops
watching before actually closing, so the watcher never sees an
intentional close as unexpected. On a genuine physical disconnect
outside disconnect(), onConnectionLost() tears down the dead
connection's native-side state and emits ThermalPrinterConnectionLost
with only the identity string — no printerId, by design (see the
2026-09-15 connection-watcher spec).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: TS bridge layer — `connect()` returns the identity, add `subscribeConnectionLost`

**Files:**
- Modify: `NDTCore.App/src/features/printer/adapters/native/PrinterNativeModule.ts`
- Modify: `NDTCore.App/src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts`
- Modify: `NDTCore.App/src/features/printer/adapters/testing/MockPrinterAdapter.ts`
- Modify: `NDTCore.App/jest.setup.js`

**Interfaces:**
- Produces: `ThermalPrinterModule.connect(request): Promise<string>` (was `Promise<void>`), `subscribeConnectionLost(callback: (identity: string) => void): Unsubscribe` — both consumed by Task 6.

- [ ] **Step 1: Update `PrinterNativeModule.ts`**

Read the current file first, then apply these changes:

Change the import line:
```ts
import { DeviceEventEmitter, NativeModules } from 'react-native';
```

Change `connect`'s return type:
```ts
  connect: (request: ConnectRequest): Promise<string> => ThermalPrinterModuleNative.connect(request),
```

Add, after the `ThermalPrinterModule` export object:
```ts
export type Unsubscribe = () => void;

/**
 * Sự kiện native bắn khi 1 kết nối USB/Bluetooth vật lý bị mất ngoài ý muốn
 * (rút dây, ra khỏi tầm sóng) — KHÔNG mang printerId, chỉ mang `identity`
 * (ConnectionIdentity.getValue() phía Java). Caller tự tra `printerId` nào
 * đang dùng identity đó (xem EscPosDriver/TsplDriver). Dùng DeviceEventEmitter
 * toàn cục của RN thay vì bọc NativeEventEmitter(NativeModules.ThermalPrinterModule)
 * — module native không implement addListener/removeListeners nên RN sẽ cảnh
 * báo nếu bọc kiểu đó, còn DeviceEventEmitter thì không cần.
 */
export const subscribeConnectionLost = (callback: (identity: string) => void): Unsubscribe => {
  const subscription = DeviceEventEmitter.addListener('ThermalPrinterConnectionLost', (event: { identity: string }) => callback(event.identity));
  return () => subscription.remove();
};
```

- [ ] **Step 2: Update `PrinterNativeModule.test.ts`**

Read the current file first. Change the `beforeEach` mock's `connect` line:
```ts
    connect: jest.fn().mockResolvedValue('mock-identity'),
```
(was `jest.fn().mockResolvedValue(undefined)`).

Change the existing `connect` test to also assert the resolved value:
```ts
  it('connect gọi native với đúng request (kèm printerId) và trả về identity', async () => {
    const { ThermalPrinterModule } = loadReal();
    await expect(ThermalPrinterModule.connect({ printerId: 'p1', type: 'usb', vendorId: 1234, productId: 5678 })).resolves.toBe('mock-identity');
    expect(NativeModules.ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: 'p1', type: 'usb', vendorId: 1234, productId: 5678 });
  });
```

Add a new test block after the existing `describe('ThermalPrinterModule', ...)` block, in the same file:
```ts
describe('subscribeConnectionLost', () => {
  it('gọi callback với identity khi DeviceEventEmitter bắn ThermalPrinterConnectionLost', () => {
    const { subscribeConnectionLost } = loadReal();
    const { DeviceEventEmitter } = require('react-native') as typeof import('react-native');
    const callback = jest.fn();

    const unsubscribe = subscribeConnectionLost(callback);
    DeviceEventEmitter.emit('ThermalPrinterConnectionLost', { identity: 'USB:1234:5678:SERIAL' });

    expect(callback).toHaveBeenCalledWith('USB:1234:5678:SERIAL');

    unsubscribe();
    callback.mockClear();
    DeviceEventEmitter.emit('ThermalPrinterConnectionLost', { identity: 'USB:1234:5678:SERIAL' });
    expect(callback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Update `MockPrinterAdapter.ts`**

```ts
/**
 * Test double dùng chung cho adapters/ trong unit test — thay vì mỗi file
 * test tự viết lại `jest.fn()` boilerplate cho từng adapter. KHÔNG dùng cho
 * production code (chỉ import được từ file test, phụ thuộc global `jest`).
 */
export const createMockThermalPrinterModule = () => ({
  discoverPrinters: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue('mock-identity'),
  disconnect: jest.fn().mockResolvedValue(undefined),
  writeByBase64: jest.fn().mockResolvedValue('ok'),
});

/** Mock của subscribeConnectionLost — trả về unsubscribe rỗng, không tự bắn event nào. */
export const createMockSubscribeConnectionLost = () => jest.fn().mockReturnValue(() => undefined);
```

- [ ] **Step 4: Update `jest.setup.js`**

Read the current file first, find the `jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', ...)` block and change it to:
```javascript
jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue('mock-identity'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('Print SuccessFully'),
  },
  subscribeConnectionLost: jest.fn().mockReturnValue(() => undefined),
}));
```
Leave the second block (`NativeModules.ThermalPrinterModule = {...}`, used by `PrinterNativeModule.test.ts`'s `requireActual` tests) and everything else in the file untouched.

- [ ] **Step 5: Run tests**

```bash
cd NDTCore.App
npm run type-check
npm test -- PrinterNativeModule MockPrinterAdapter
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add NDTCore.App/src/features/printer/adapters/native/PrinterNativeModule.ts \
        NDTCore.App/src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts \
        NDTCore.App/src/features/printer/adapters/testing/MockPrinterAdapter.ts \
        NDTCore.App/jest.setup.js
git commit -m "$(cat <<'EOF'
feat: connect() resolves the identity, add subscribeConnectionLost

connect()'s resolved value changes from void to the ConnectionIdentity
string native assigned, so callers can record it for later
correlation. subscribeConnectionLost wraps RN's global
DeviceEventEmitter for the new ThermalPrinterConnectionLost event.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `UsbTransport` and `NativeAdapter` — carry the identity up

**Files:**
- Modify: `NDTCore.App/src/features/printer/transports/UsbTransport.ts`
- Modify: `NDTCore.App/src/features/printer/transports/__tests__/UsbTransport.test.ts`
- Modify: `NDTCore.App/src/features/printer/adapters/native/NativeAdapter.ts`
- Modify: `NDTCore.App/src/features/printer/adapters/native/__tests__/NativeAdapter.test.ts`

**Interfaces:**
- Consumes: `ThermalPrinterModule.connect(): Promise<string>` (Task 5).
- Produces: `UsbTransport.connect(): Promise<string>` (was `Promise<void>`), `NativeAdapter.getConnectionIdentity(): string | null` (new method, not part of `IPrinterAdapter` — deliberately adapter-specific, since `identity` is a native-only concept `LibraryAdapter`/`VendorAdapter` have no equivalent for) — both consumed by Task 7's drivers.

- [ ] **Step 1: Update `UsbTransport.connect()`**

Read the current file first. Change:
```ts
  async connect(printerId: string, vendorId: number, productId: number): Promise<void> {
    try {
      await ThermalPrinterModule.connect({ printerId, type: 'usb', vendorId, productId });
      this.printerId = printerId;
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: errorMessage(error) });
    }
  }
```
to:
```ts
  async connect(printerId: string, vendorId: number, productId: number): Promise<string> {
    try {
      const identity = await ThermalPrinterModule.connect({ printerId, type: 'usb', vendorId, productId });
      this.printerId = printerId;
      return identity;
    } catch (error) {
      throw new PrinterErrorException({ code: PrinterErrorCode.PRINTER_CONNECTION_FAILED, message: errorMessage(error) });
    }
  }
```

- [ ] **Step 2: Update `UsbTransport.test.ts`**

Read the current file first. The mock at the top of the file resolves `connect` via the global `jest.setup.js` mock updated in Task 5 (`'mock-identity'`) — no local override to change. Add one assertion to the existing `'connects using printerId + vendor_id/product_id as numbers'` test:
```ts
  it('connects using printerId + vendor_id/product_id as numbers', async () => {
    const { ThermalPrinterModule } = jest.requireMock('../../adapters/native/PrinterNativeModule') as {
      ThermalPrinterModule: { connect: jest.Mock };
    };
    const transport = new UsbTransport();
    await expect(transport.connect('p1', 1155, 22222)).resolves.toBe('mock-identity');
    expect(ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: 'p1', type: 'usb', vendorId: 1155, productId: 22222 });
  });
```

- [ ] **Step 3: Update `NativeAdapter.ts`**

Read the current file first. Add a field (alongside `printerId`/`usb`):
```ts
  private connectionIdentity?: string;
```

Change the `connect()` method — capture the resolved identity on each branch instead of discarding it:
```ts
  async connect(target: PrinterConnectTarget): Promise<void> {
    this.connectionType = target.connectionType;
    this.printerId = target.printerId;

    if (target.connectionType === PrinterConnectionType.Usb) {
      if (!target.usb) {
        throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu thông tin thiết bị USB' });
      }

      this.usb = new UsbTransport();
      this.connectionIdentity = await this.usb.connect(target.printerId, target.usb.vendorId, target.usb.productId);
      return;
    }

    if (target.connectionType === PrinterConnectionType.Bluetooth) {
      if (!target.bluetooth) {
        throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Chưa chọn thiết bị Bluetooth' });
      }

      this.connectionIdentity = await ThermalPrinterModule.connect({ printerId: target.printerId, type: 'bluetooth', address: target.bluetooth.deviceId });
      return;
    }

    if (!target.lan) {
      throw new PrinterErrorException({ code: PrinterErrorCode.VALIDATION_ERROR, message: 'Thiếu cấu hình IP/Port' });
    }

    this.connectionIdentity = await ThermalPrinterModule.connect({ printerId: target.printerId, type: 'lan', host: target.lan.ip, port: target.lan.port });
  }

  /**
   * ConnectionIdentity native trả về lúc connect() — dùng để driver tương
   * quan sự kiện `subscribeConnectionLost` với đúng printerId. `null` nếu
   * chưa connect (không có trong IPrinterAdapter — chỉ NativeAdapter mới có
   * khái niệm identity, LibraryAdapter/VendorAdapter không có tương đương).
   */
  getConnectionIdentity(): string | null {
    return this.connectionIdentity ?? null;
  }
```
(Everything else in the file — `write`, `printText`, `read`, `disconnect`, the iOS legacy branch — stays unchanged.)

- [ ] **Step 4: Update `NativeAdapter.test.ts`**

Read the current file first. In its `jest.mock('../PrinterNativeModule', ...)` block, change:
```ts
    connect: jest.fn().mockResolvedValue(undefined),
```
to:
```ts
    connect: jest.fn().mockResolvedValue('mock-identity'),
```
Add two new tests inside the existing `describe('NativeAdapter', ...)` block, using the file's existing `mod()` helper (`jest.requireMock('../PrinterNativeModule')`) the same way the other tests do:
```ts
  it('connect() lưu lại connectionIdentity native trả về, getConnectionIdentity() đọc được', async () => {
    mod().ThermalPrinterModule.connect.mockResolvedValueOnce('BLUETOOTH:AA:BB');
    const adapter = new NativeAdapter();
    await adapter.connect({ printerId: 'p1', connectionType: PrinterConnectionType.Bluetooth, bluetooth: { deviceId: 'AA:BB' } });
    expect(adapter.getConnectionIdentity()).toBe('BLUETOOTH:AA:BB');
  });

  it('getConnectionIdentity() trả null trước khi connect()', () => {
    expect(new NativeAdapter().getConnectionIdentity()).toBeNull();
  });
```

- [ ] **Step 5: Run tests**

```bash
cd NDTCore.App
npm run type-check
npm test -- UsbTransport NativeAdapter
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add NDTCore.App/src/features/printer/transports/UsbTransport.ts \
        NDTCore.App/src/features/printer/transports/__tests__/UsbTransport.test.ts \
        NDTCore.App/src/features/printer/adapters/native/NativeAdapter.ts \
        NDTCore.App/src/features/printer/adapters/native/__tests__/NativeAdapter.test.ts
git commit -m "$(cat <<'EOF'
feat: carry the connection identity up through UsbTransport/NativeAdapter

UsbTransport.connect() now resolves the identity string instead of
discarding it. NativeAdapter captures it on every connect() branch
(USB/Bluetooth/LAN) and exposes it via a new getConnectionIdentity()
method — deliberately outside IPrinterAdapter, since identity is a
native-only concept LibraryAdapter/VendorAdapter have no equivalent
for.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Drivers subscribe to disconnect events

**Files:**
- Modify: `NDTCore.App/src/features/printer/drivers/escpos/EscPosDriver.ts`
- Modify: `NDTCore.App/src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts`
- Modify: `NDTCore.App/src/features/printer/drivers/tspl/TsplDriver.ts`
- Modify: `NDTCore.App/src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `subscribeConnectionLost` (Task 5), `NativeAdapter.getConnectionIdentity()` (Task 6).

- [ ] **Step 1: Update `EscPosDriver.ts`**

Read the current file first. Add the import:
```ts
import { subscribeConnectionLost } from '../../adapters/native/PrinterNativeModule';
```

Add a field alongside the others (`adapters`, `connectedTypes`, `statuses`, `listeners`, `contexts`, `activeByType`):
```ts
  private identities = new Map<string, string>();
```

Add a constructor (there isn't one currently — fields are initialized inline):
```ts
  constructor() {
    subscribeConnectionLost((identity) => {
      for (const [printerId, knownIdentity] of this.identities) {
        if (knownIdentity === identity) {
          this.setStatus(printerId, PrinterStatus.Disconnected);
        }
      }
    });
  }
```
(Place it right after the field declarations, before `setStatus`.)

In `connect()`, after `this.contexts.set(printer.id, printer);`, add:
```ts
      const identity = adapter.getConnectionIdentity();

      if (identity) {
        this.identities.set(printer.id, identity);
      }
```

In `disconnect()`'s `finally` block, add `this.identities.delete(printerId);` alongside the other three `.delete(printerId)` calls.

- [ ] **Step 2: Update `EscPosDriver.test.ts`**

Read the current file first. **Critical:** this file has its own local `jest.mock('../../../adapters/native/PrinterNativeModule', ...)` (near the top, right after the imports) that *shadows* the global `jest.setup.js` mock from Task 5 entirely within this file — it currently does not export `subscribeConnectionLost` at all. Since `EscPosDriver`'s new constructor (Task 1 of this task, i.e. Task 7 Step 1) calls `subscribeConnectionLost(...)` at construction time, leaving this local mock unchanged would make `new EscPosDriver()` throw `subscribeConnectionLost is not a function` in every single test in this file. Update the local mock:
```ts
jest.mock('../../../adapters/native/PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue('mock-identity'),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  },
  subscribeConnectionLost: jest.fn().mockReturnValue(() => undefined),
}));
```
(Only `connect`'s resolved value and the new `subscribeConnectionLost` export change — `discoverPrinters`/`disconnect`/`writeByBase64` stay as they are.)

Then add one new `describe` block at the end of the file, using the existing `makePrinter`/`makeEscPosDriver` fixtures (already imported at the top of this file from `'../../../testing/printerFixtures'`):
```ts
describe('EscPosDriver — connection lost event', () => {
  it('cập nhật status Disconnected khi subscribeConnectionLost bắn đúng identity đã connect', async () => {
    const { subscribeConnectionLost, ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      subscribeConnectionLost: jest.Mock;
      ThermalPrinterModule: { connect: jest.Mock };
    };
    ThermalPrinterModule.connect.mockResolvedValueOnce('USB:1155:22222:SERIAL');

    const driver = new EscPosDriver();
    const printer: Printer = makePrinter({
      id: 'p1',
      driver: makeEscPosDriver(),
      connection: { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 },
    });
    await driver.connect(printer);

    const statuses: PrinterStatus[] = [];
    driver.onStatusChange(printer.id, (status) => statuses.push(status));

    const onConnectionLost = subscribeConnectionLost.mock.calls[subscribeConnectionLost.mock.calls.length - 1][0] as (identity: string) => void;
    onConnectionLost('USB:1155:22222:SERIAL');

    expect(statuses).toEqual([PrinterStatus.Disconnected]);
  });

  it('bỏ qua identity không khớp printer nào đã connect', async () => {
    const { subscribeConnectionLost, ThermalPrinterModule } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      subscribeConnectionLost: jest.Mock;
      ThermalPrinterModule: { connect: jest.Mock };
    };
    ThermalPrinterModule.connect.mockResolvedValueOnce('USB:1155:22222:SERIAL');

    const driver = new EscPosDriver();
    const printer: Printer = makePrinter({
      id: 'p1',
      driver: makeEscPosDriver(),
      connection: { type: PrinterConnectionType.Usb, vendorId: 1155, productId: 22222 },
    });
    await driver.connect(printer);

    const statuses: PrinterStatus[] = [];
    driver.onStatusChange(printer.id, (status) => statuses.push(status));

    const onConnectionLost = subscribeConnectionLost.mock.calls[subscribeConnectionLost.mock.calls.length - 1][0] as (identity: string) => void;
    onConnectionLost('USB:9999:9999:OTHER');

    expect(statuses).toEqual([]);
  });
});
```
(`subscribeConnectionLost.mock.calls[...length - 1]` rather than `[0]` because this file's other tests each construct their own `new EscPosDriver()`, and the mock function's call history accumulates across the whole file unless something resets it — taking the last registered callback is guaranteed to be this test's own driver instance's subscription, regardless of how many earlier tests ran first.)

- [ ] **Step 3: Update `TsplDriver.ts`**

Read the current file first. Add imports:
```ts
import { subscribeConnectionLost } from '../../adapters/native/PrinterNativeModule';
import type { NativeAdapter } from '../../adapters/native/NativeAdapter';
```

Add a field:
```ts
  private identities = new Map<string, string>();
```

Add a constructor:
```ts
  constructor() {
    subscribeConnectionLost((identity) => {
      for (const [printerId, knownIdentity] of this.identities) {
        if (knownIdentity === identity) {
          this.setStatus(printerId, PrinterStatus.Disconnected);
        }
      }
    });
  }
```

In `connect()`, after `this.contexts.set(printer.id, printer);`, add:
```ts
      if (adapter.source === 'native') {
        const identity = (adapter as NativeAdapter).getConnectionIdentity();

        if (identity) {
          this.identities.set(printer.id, identity);
        }
      }
```
(`adapter.source` is already part of `IPrinterAdapter` — `TsplDriver`'s `connections` map is typed `Map<string, IPrinterAdapter>`, generic across `NativeAdapter`/`LibraryAdapter`, so the `source === 'native'` check is required before the cast; `LibraryAdapter` has no `getConnectionIdentity()` method at all.)

In `disconnect()`'s `finally` block, add `this.identities.delete(printerId);` alongside `this.connections.delete(printerId);`.

- [ ] **Step 4: Update `TsplDriver.test.ts`**

Read the current file first. It does not have its own local `PrinterNativeModule` mock (unlike `EscPosDriver.test.ts`) — it relies on the global `jest.setup.js` mock from Task 5, which already provides `subscribeConnectionLost`, so no shadowing issue here.

It DOES locally mock `UsbTransport` directly (`jest.mock('../../../transports/UsbTransport', () => ({ UsbTransport: jest.fn().mockImplementation(() => ({ connect: jest.fn().mockResolvedValue(undefined), ... })) }))`, near the top of the file). Since `NativeAdapter`'s USB branch (real, unmocked in this file) constructs `new UsbTransport()` and awaits its `.connect()` to get the identity, this local mock's `connect` must resolve a string too, or `NativeAdapter.getConnectionIdentity()` will always return `null` for TSPL/USB connections in this file's tests. Change:
```ts
jest.mock('../../../transports/UsbTransport', () => ({
  UsbTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue('mock-identity'),
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));
```
(Only `connect`'s resolved value changes — `write`/`close` stay as they are.)

Then add two new tests at the end of the file, using this file's existing `usbLabelPrinter`/`bluetoothLabelPrinter` fixtures (already defined near the top of the file):
```ts
describe('TsplDriver — connection lost event', () => {
  it('USB (NativeAdapter): cập nhật status Disconnected khi identity khớp', async () => {
    const { subscribeConnectionLost } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      subscribeConnectionLost: jest.Mock;
    };

    const driver = new TsplDriver();
    await driver.connect(usbLabelPrinter);

    const statuses: PrinterStatus[] = [];
    driver.onStatusChange(usbLabelPrinter.id, (status) => statuses.push(status));

    const onConnectionLost = subscribeConnectionLost.mock.calls[subscribeConnectionLost.mock.calls.length - 1][0] as (identity: string) => void;
    onConnectionLost('mock-identity');

    expect(statuses).toEqual([PrinterStatus.Disconnected]);
  });

  it('Bluetooth (LibraryAdapter): không có identity nên subscribeConnectionLost không ảnh hưởng', async () => {
    const { subscribeConnectionLost } = jest.requireMock('../../../adapters/native/PrinterNativeModule') as {
      subscribeConnectionLost: jest.Mock;
    };

    const driver = new TsplDriver();
    await driver.connect(bluetoothLabelPrinter);

    const statuses: PrinterStatus[] = [];
    driver.onStatusChange(bluetoothLabelPrinter.id, (status) => statuses.push(status));

    const onConnectionLost = subscribeConnectionLost.mock.calls[subscribeConnectionLost.mock.calls.length - 1][0] as (identity: string) => void;
    onConnectionLost('mock-identity'); // arbitrary — LibraryAdapter connections never populate `identities`, so this must always be a no-op

    expect(statuses).toEqual([]);
  });
});
```
(`'mock-identity'` matches the mocked `UsbTransport.connect()`'s resolved value above, and also the global `jest.setup.js` `ThermalPrinterModule.connect` mock's resolved value from Task 5 — both resolve to the same string, so either code path leads `NativeAdapter.getConnectionIdentity()` to return exactly this.)

- [ ] **Step 5: Run tests**

```bash
cd NDTCore.App
npm run type-check
npm test -- EscPosDriver TsplDriver
```
Expected: all green.

- [ ] **Step 6: Run the full suite once**

```bash
npm test
```
Expected: all green — this is the first point where every file touched across Tasks 5-7 is exercised together.

- [ ] **Step 7: Commit**

```bash
git add NDTCore.App/src/features/printer/drivers/escpos/EscPosDriver.ts \
        NDTCore.App/src/features/printer/drivers/escpos/__tests__/EscPosDriver.test.ts \
        NDTCore.App/src/features/printer/drivers/tspl/TsplDriver.ts \
        NDTCore.App/src/features/printer/drivers/tspl/__tests__/TsplDriver.test.ts
git commit -m "$(cat <<'EOF'
feat: drivers react to native connection-lost events

EscPosDriver and TsplDriver each subscribe once (constructor) to
subscribeConnectionLost, record printerId -> identity locally on
connect() (TsplDriver only for connections that actually went through
NativeAdapter — LibraryAdapter has no identity concept), and set
PrinterStatus.Disconnected for any printerId whose recorded identity
matches an incoming event. No native-side printerId lookup involved,
by design.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Manual verification on a real device

No Java/Android unit test harness exists in this project, and event delivery timing / real Bluetooth ACL behavior can only be observed on real hardware.

**Files:** none (verification only).

- [ ] **Step 1: Build and install**

```bash
cd NDTCore.App
npm run android
```

- [ ] **Step 2: USB — idle disconnect is now live**

Connect a USB printer, let it sit idle (no print in progress), then physically unplug it. Confirm the app's connection status UI updates to Disconnected within roughly a second, with no print attempt or manual refresh needed.

- [ ] **Step 3: USB — reconnect after Step 2 still works**

With the same USB printer, plug it back in and reconnect through the app's normal flow. Confirm it connects successfully (this exercises both this plan's watcher wiring and the earlier final-review fix for stale-device reuse).

- [ ] **Step 4: Bluetooth — idle disconnect is now live**

Connect a Bluetooth printer, let it sit idle, then power it off (or move it out of range so the OS tears down the ACL link). Confirm the app's status updates to Disconnected without any print attempt.

- [ ] **Step 5: Explicit disconnect does not fire a spurious event**

Connect a USB or Bluetooth printer, then disconnect it through the app's normal UI action (not by physically unplugging). Confirm no unexpected extra status flicker or duplicate event handling occurs — the explicit path should look exactly as it did before this plan.

- [ ] **Step 6: Shared-connection case**

If practical to set up (two saved printers pointing at the same physical USB or Bluetooth device — the existing connection-reuse case), disconnect one physically and confirm both printerIds' statuses update to Disconnected.

- [ ] **Step 7: Report results**

Summarize pass/fail for each step. Treat any failure as a bug in the corresponding task (2/3/4) rather than something to patch around here.
