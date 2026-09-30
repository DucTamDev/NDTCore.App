# Refactor Native Thermal Printer Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Android native thermal-printer layer (`android/app/src/main/java/com/ndtcorepos/thermalprinter/`) actually work end-to-end — replacing a half-migrated, non-compiling old architecture and a USB-only new architecture with one complete architecture (USB + Bluetooth + LAN) that fulfills the API contract the TypeScript layer already expects.

**Architecture:** Keep the "spec" architecture's layering (`model/`, `connection/`, `writer/`, `device/`, `discovery/`, `identity/`, `queue/`, each split into a transport-neutral interface + a `usb/`/`bluetooth/`/`net/` package) and extend it with Bluetooth and LAN implementations mirroring the existing USB ones. Discard the spec's own proposed `ThermalPrinterModule` public API (`discoverDevices`/`open`/`writeBytes`/`close`, keyed by raw Android `deviceName`, USB-only) — it does not match the contract already implemented and tested throughout the rest of the app (`PrinterNativeModule.ts`, `NativeAdapter.ts`, `UsbTransport.ts`: `discoverPrinters`/`connect`/`writeByBase64`/`disconnect`, keyed by caller-assigned `printerId`, supporting USB+Bluetooth+LAN). The native module's `@ReactMethod` surface is rewritten to fulfill that existing TS contract, internally built on the new layered architecture. All old-architecture Java files (`printer/`, `detector/`, `exception/`, `error/`, `transport/`, old `device/*PrinterDevice.java`, `module/PrinterModule.java`) are deleted — they are unreachable from the registered module and already fail to compile.

**Tech Stack:** Java (Android, no external libs — `android.bluetooth.*`, `java.net.Socket`, `android.hardware.usb.*` only), React Native bridge (`@ReactMethod`/`Promise`), TypeScript (Jest for the one TS-side cleanup task).

**Spec:** `docs/superpowers/specs/refactor-native.md` (Vietnamese brainstorm/design doc — items 1–24 describe the model/connection/writer/device/queue/discovery/identity layers this plan keeps almost verbatim; items 25–29 describe the module API this plan deliberately does **not** follow, for the reason above).

## Global Constraints

- minSdkVersion 24, compileSdk/targetSdk 36 (`android/build.gradle`) — no API used here requires anything above what's already used elsewhere in the module (USB/Bluetooth/Socket APIs are all available since API 21+; `Build.VERSION_CODES.S`/`TIRAMISU` branches already exist in the ported permission code for those).
- No new Gradle dependencies — Bluetooth and LAN use plain `android.bluetooth`/`java.net` APIs, exactly like the old (deleted) code did.
- `AndroidManifest.xml` already declares `INTERNET`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `BLUETOOTH`/`BLUETOOTH_ADMIN` (≤30), `ACCESS_FINE_LOCATION` (≤30) — no manifest changes needed.
- No Java/Android unit test harness exists in this project (`android/app/src/test` does not exist, `build.gradle` has no test config) — every Java task is verified by compiling, not by a test-first cycle. Do not introduce a new test framework as a side effect of this plan.
- XML doc comments are **not** required in this project (that convention is BE-only, per `NDTCore.App/CLAUDE.md` → `docs/CODING_STANDARDS.md`); follow that doc's guidance instead: guard clauses over nesting, function-level comments only where the API call isn't self-explanatory.
- Test files (TS side) go in `__tests__/` next to the file they test, suffix `.test.ts` — see `.claude/rules/testing-file-organization.md`.
- Compile check command (run from `NDTCore.App/`): `cd android && .\gradlew.bat compileDebugJavaWithJavac`. Windows: call `.\gradlew.bat`, not bare `gradlew.bat`.

---

## Task 1: Remove the old, non-compiling architecture and dead new-architecture scaffolding

The old architecture (`module/PrinterModule.java` and everything only it references) is unreachable from the registered `ThermalPrinterModule` and no longer compiles (it calls APIs on `queue/PrinterQueueManager.java` and `discovery/usb/UsbPrinterDiscovery.java` that were already overwritten in place with incompatible new-architecture shapes). Some new-architecture files were also written speculatively and are never called by anything (`config/*`, `permission/IPrinterPermission.java`, `device/PrinterDeviceHandle.java` plus the `acquire()`/`release()` methods on `PrinterDeviceManager` that only exist to support it). Removing all of this first turns "the project currently fails to compile" into "the project compiles cleanly," independent of every later task.

**Files:**
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/PrinterModule.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterManager.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterRegistry.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/IPrinterDevice.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterInfo.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterResult.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterState.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterCapabilities.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/CapabilityState.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/UsbPrinterDevice.java` (old — package `device`, not `device.usb`)
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/BluetoothPrinterDevice.java` (old)
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/NetPrinterDevice.java` (old)
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/ICapabilityDetector.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/UsbCapabilityDetector.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/BluetoothCapabilityDetector.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/NetCapabilityDetector.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/UsbPermission.java` (old — logic is ported into `permission/usb/UsbPermission.java` in Task 4, not lost)
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/IPrinterConnection.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/IPrinterWriter.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbConnection.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbWriter.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbEndpointResolver.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothConnection.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothWriter.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/net/NetConnection.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/net/NetWriter.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDiscovery.java` (old shape — recreated correctly in Task 2)
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterConnectionException.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterPermissionException.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterWriteException.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterTimeoutException.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorCode.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorResult.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterException.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/PrintJob.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/PrintJobResult.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/QueueStatus.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/config/IPrinterConnectionConfig.java` (new-arch, zero references anywhere)
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/config/UsbConnectionConfig.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/config/BluetoothConnectionConfig.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/config/NetworkConnectionConfig.java`
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/IPrinterPermission.java` (new-arch, zero references; superseded by concrete `permission/usb/UsbPermission.java` in Task 4)
- Delete: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/PrinterDeviceHandle.java` (only reachable via `PrinterDeviceManager.acquire()`, removed below)
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/PrinterDeviceManager.java`

**Interfaces:**
- Produces: `PrinterDeviceManager` keeps exactly `register(IPrinterDevice)`, `get(ConnectionIdentity)`, `remove(ConnectionIdentity)`, `closeAll()` — this is the full surface Task 5's `ThermalPrinterModule` will call.

- [ ] **Step 1: Delete every file listed above**

On Windows, delete via `git rm` so the removal is tracked cleanly:

```bash
cd NDTCore.App
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/module/PrinterModule.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterManager.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterRegistry.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/IPrinterDevice.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterInfo.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterResult.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterState.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/PrinterCapabilities.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/printer/CapabilityState.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/device/UsbPrinterDevice.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/device/BluetoothPrinterDevice.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/device/NetPrinterDevice.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/ICapabilityDetector.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/UsbCapabilityDetector.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/BluetoothCapabilityDetector.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/detector/NetCapabilityDetector.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/UsbPermission.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/IPrinterConnection.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/IPrinterWriter.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbConnection.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbWriter.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/usb/UsbEndpointResolver.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothConnection.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/bluetooth/BluetoothWriter.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/net/NetConnection.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/transport/net/NetWriter.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDiscovery.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterConnectionException.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterPermissionException.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterWriteException.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/exception/PrinterTimeoutException.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorCode.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterErrorResult.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/error/PrinterException.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/PrintJob.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/PrintJobResult.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/queue/QueueStatus.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/config/IPrinterConnectionConfig.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/config/UsbConnectionConfig.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/config/BluetoothConnectionConfig.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/config/NetworkConnectionConfig.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/IPrinterPermission.java
git rm android/app/src/main/java/com/ndtcorepos/thermalprinter/device/PrinterDeviceHandle.java
```

If any now-empty directories remain (`printer/`, `detector/`, `exception/`, `error/`, `transport/`, `config/`), remove them too — Java has no package-info requirement, empty dirs are just clutter.

- [ ] **Step 2: Trim `PrinterDeviceManager` to the four methods actually used**

Read the current file first (`android/app/src/main/java/com/ndtcorepos/thermalprinter/device/PrinterDeviceManager.java`) — it has `acquire()`, `register()`, `release()`, `get()`, `remove()`, `closeAll()`. Remove `acquire()` and `release()` (only reachable via the now-deleted `PrinterDeviceHandle`); keep the rest unchanged:

```java
package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;

import java.util.HashMap;
import java.util.Map;

/**
 * Manages active physical printer runtimes.
 *
 * The manager reuses one runtime device for the same connection identity.
 *
 * It does not manage printer business configuration, printer types,
 * drivers, paper settings, or print jobs.
 */
public final class PrinterDeviceManager {

    /**
     * Registry containing active runtime printer devices.
     */
    private final PrinterDeviceRegistry registry;


    /**
     * Creates a printer device manager.
     *
     * @param registry runtime device registry
     */
    public PrinterDeviceManager(
            PrinterDeviceRegistry registry
    ) {
        this.registry = registry;
    }


    /**
     * Registers a runtime device.
     *
     * @param device runtime printer device
     */
    public synchronized void register(
            IPrinterDevice device
    ) {
        registry.register(device);
    }


    /**
     * Returns an active runtime device.
     *
     * @param identity physical connection identity
     * @return runtime device or null
     */
    public synchronized IPrinterDevice get(
            ConnectionIdentity identity
    ) {
        return registry.get(identity);
    }

    /** Removes a runtime device from the registry without closing it. */
    public synchronized IPrinterDevice remove(
            ConnectionIdentity identity
    ) {
        return registry.remove(identity);
    }


    /**
     * Closes and removes all active runtime devices.
     */
    public synchronized void closeAll() {

        for (IPrinterDevice device : registry.snapshot()) {
            device.close();
        }

        registry.clear();
    }
}
```

- [ ] **Step 3: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```

Expected: BUILD SUCCESSFUL. This is the first point since the spec migration started where the whole module compiles — `discovery/usb/UsbPrinterDiscovery.java`, `queue/PrinterQueueManager.java`, and every other new-architecture file are now only referenced by other new-architecture files.

- [ ] **Step 4: Commit**

```bash
git add -A -- android/app/src/main/java/com/ndtcorepos/thermalprinter
git commit -m "$(cat <<'EOF'
refactor: remove non-compiling old printer architecture and dead scaffolding

The old architecture (PrinterManager/PrinterModule and everything under
it) was already unreachable from the registered ThermalPrinterModule and
no longer compiled after queue/ and discovery/usb/ were overwritten with
the new architecture's shape. Also removes new-architecture files that
were written but never wired to anything (config/*, IPrinterPermission,
PrinterDeviceHandle + the acquire()/release() pair that only existed to
support it).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Bluetooth transport (connection, writer, device, discovery)

Adds the Bluetooth counterpart to the existing `connection/usb`, `writer/usb`, `device/usb`, `discovery/usb` packages, porting the proven logic from the old (now-deleted) `transport/bluetooth/*` and `discovery/bluetooth/BluetoothPrinterDiscovery.java` into the new architecture's synchronous `PrinterWriteResult`-returning shape.

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/bluetooth/BluetoothConnection.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/writer/bluetooth/BluetoothWriter.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/bluetooth/BluetoothPrinterDevice.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth/BluetoothPrinterDiscovery.java`

**Interfaces:**
- Consumes: `connection.IPrinterConnection` (`getState()`, `open()`, `close()`, `isConnected()`, each returning/no-arg per existing interface), `writer.IPrinterWriter` (`write(byte[])`, `write(byte[], int)`), `device.IPrinterDevice` (`getConnectionIdentity()`, `getState()`, `open()`, `write(byte[])`, `close()`), `discovery.IPrinterDiscovery` (`List<PrinterDescriptor> discover()` — no `throws`), `model.PrinterDescriptor` (9-arg constructor: `connectionType, deviceName, manufacturer, productName, serialNumber, vendorId, productId, address, port`), `model.PrinterWriteResult` (`success(int)`, `failure(PrinterErrorCode, int)`), `enums.ConnectionType.BLUETOOTH`, `enums.ConnectionState`, `enums.PrinterErrorCode`.
- Produces: `BluetoothConnection(String address)`, `BluetoothWriter(BluetoothConnection)`, `BluetoothPrinterDevice(ConnectionIdentity, BluetoothConnection)`, `BluetoothPrinterDiscovery()` — all consumed by Task 5's `ThermalPrinterModule`.

- [ ] **Step 1: Create `BluetoothConnection.java`**

```java
package com.ndtcorepos.thermalprinter.connection.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.ndtcorepos.thermalprinter.connection.IPrinterConnection;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/** Manages the lifecycle of an RFCOMM Bluetooth socket to one bonded printer. */
public final class BluetoothConnection implements IPrinterConnection {

    private static final UUID SPP_UUID =
            UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

    private final String address;
    private BluetoothSocket socket;
    private ConnectionState state = ConnectionState.DISCONNECTED;
    private int pendingDrainBytes = -1;

    public BluetoothConnection(String address) {
        this.address = address;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        if (isConnected()) {
            return PrinterWriteResult.success(0);
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();

        if (adapter == null || !adapter.isEnabled()) {
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }

        BluetoothDevice bondedDevice = findBondedDevice(adapter);

        if (bondedDevice == null) {
            return PrinterWriteResult.failure(PrinterErrorCode.DEVICE_NOT_FOUND, 0);
        }

        state = ConnectionState.CONNECTING;

        try {
            socket = openSocket(bondedDevice);
        } catch (IOException exception) {
            state = ConnectionState.DISCONNECTED;
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }

        state = ConnectionState.CONNECTED;
        return PrinterWriteResult.success(0);
    }

    /** Finds the bonded device matching this connection's address among paired devices. */
    private BluetoothDevice findBondedDevice(BluetoothAdapter adapter) {
        Set<BluetoothDevice> bonded;

        try {
            bonded = adapter.getBondedDevices();
        } catch (SecurityException exception) {
            return null;
        }

        for (BluetoothDevice candidate : bonded) {
            if (candidate.getAddress().equals(address)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Opens an RFCOMM socket and retries once with a fresh socket if the first
     * connect() attempt fails — some Bluetooth printers need a retry to complete
     * the handshake.
     */
    private BluetoothSocket openSocket(BluetoothDevice target) throws IOException {
        BluetoothSocket firstAttempt = target.createRfcommSocketToServiceRecord(SPP_UUID);

        try {
            firstAttempt.connect();
            return firstAttempt;
        } catch (IOException firstFailure) {
            try {
                firstAttempt.close();
            } catch (IOException ignored) {
            }

            BluetoothSocket retry = target.createRfcommSocketToServiceRecord(SPP_UUID);
            retry.connect();
            return retry;
        }
    }

    public OutputStream getOutputStream() throws IOException {
        return socket.getOutputStream();
    }

    /** Records the byte count of the last write so close() can wait for RFCOMM to drain. */
    public void markPendingDrain(int bytes) {
        this.pendingDrainBytes = bytes;
    }

    @Override
    public synchronized PrinterWriteResult close() {
        state = ConnectionState.CLOSING;

        if (socket != null && pendingDrainBytes >= 0) {
            sleepForDrain(pendingDrainBytes);
            pendingDrainBytes = -1;
        }

        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }

        state = ConnectionState.DISCONNECTED;
        return PrinterWriteResult.success(0);
    }

    /**
     * Blocks briefly before closing so recently written bytes have time to leave
     * the RFCOMM buffer — closing immediately after a write can truncate output.
     */
    private void sleepForDrain(int bytes) {
        try {
            Thread.sleep(bytes <= 2000 ? 100 : bytes / 5);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public synchronized ConnectionState getState() {
        return state;
    }

    @Override
    public synchronized boolean isConnected() {
        return state == ConnectionState.CONNECTED && socket != null && socket.isConnected();
    }
}
```

- [ ] **Step 2: Create `BluetoothWriter.java`**

```java
package com.ndtcorepos.thermalprinter.writer.bluetooth;

import com.ndtcorepos.thermalprinter.connection.bluetooth.BluetoothConnection;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.IPrinterWriter;

import java.io.IOException;
import java.io.OutputStream;

/** Writes raw bytes to a printer over an open Bluetooth RFCOMM connection. */
public final class BluetoothWriter implements IPrinterWriter {

    private static final int DEFAULT_TIMEOUT = 5_000;

    private final BluetoothConnection connection;

    public BluetoothWriter(BluetoothConnection connection) {
        this.connection = connection;
    }

    @Override
    public synchronized PrinterWriteResult write(byte[] data) {
        return write(data, DEFAULT_TIMEOUT);
    }

    /**
     * Writes bytes and flushes the socket's OutputStream.
     *
     * @param data raw printer bytes
     * @param timeout unused — RFCOMM writes block on the OS socket buffer, which
     *     has no configurable per-call timeout on Android
     */
    @Override
    public synchronized PrinterWriteResult write(byte[] data, int timeout) {
        if (data == null || data.length == 0) {
            return PrinterWriteResult.success(0);
        }

        if (!connection.isConnected()) {
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_CLOSED, 0);
        }

        try {
            OutputStream out = connection.getOutputStream();
            out.write(data);
            out.flush();
            connection.markPendingDrain(data.length);
        } catch (IOException exception) {
            return PrinterWriteResult.failure(PrinterErrorCode.WRITE_FAILED, 0);
        }

        return PrinterWriteResult.success(data.length);
    }
}
```

- [ ] **Step 3: Create `BluetoothPrinterDevice.java`**

```java
package com.ndtcorepos.thermalprinter.device.bluetooth;

import com.ndtcorepos.thermalprinter.connection.bluetooth.BluetoothConnection;
import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.bluetooth.BluetoothWriter;

/**
 * Coordinates the runtime components required by a Bluetooth printer.
 *
 * BluetoothPrinterDevice owns the RFCOMM connection lifecycle and creates the
 * writer after the connection has been successfully opened.
 */
public final class BluetoothPrinterDevice implements IPrinterDevice {

    private final ConnectionIdentity connectionIdentity;
    private final BluetoothConnection connection;
    private BluetoothWriter writer;

    public BluetoothPrinterDevice(ConnectionIdentity connectionIdentity, BluetoothConnection connection) {
        this.connectionIdentity = connectionIdentity;
        this.connection = connection;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        PrinterWriteResult result = connection.open();

        if (!result.isSuccess()) {
            return result;
        }

        writer = new BluetoothWriter(connection);
        return PrinterWriteResult.success(0);
    }

    @Override
    public synchronized PrinterWriteResult write(byte[] data) {
        if (writer == null) {
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_CLOSED, 0);
        }

        return writer.write(data);
    }

    @Override
    public synchronized PrinterWriteResult close() {
        writer = null;
        return connection.close();
    }

    @Override
    public ConnectionIdentity getConnectionIdentity() {
        return connectionIdentity;
    }

    @Override
    public ConnectionState getState() {
        return connection.getState();
    }
}
```

- [ ] **Step 4: Create `BluetoothPrinterDiscovery.java`**

```java
package com.ndtcorepos.thermalprinter.discovery.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;

/**
 * Discovers Bluetooth printers already bonded (paired) in Android system settings.
 *
 * Discovery does not open the devices and does not request permission — it
 * returns an empty list when Bluetooth is unavailable, disabled, or the
 * BLUETOOTH_CONNECT permission has not been granted yet, rather than throwing
 * (IPrinterDiscovery.discover() declares no checked exception).
 */
public final class BluetoothPrinterDiscovery implements IPrinterDiscovery {

    @Override
    public List<PrinterDescriptor> discover() {
        List<PrinterDescriptor> devices = new ArrayList<>();

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();

        if (adapter == null || !adapter.isEnabled()) {
            return devices;
        }

        for (BluetoothDevice device : getBondedDevicesSafely(adapter)) {
            devices.add(createDescriptor(device));
        }

        return devices;
    }

    /**
     * Reads bonded devices via BluetoothAdapter.getBondedDevices() — Android 12+
     * throws SecurityException without BLUETOOTH_CONNECT, treated as "no
     * devices" rather than a discovery failure.
     */
    private Set<BluetoothDevice> getBondedDevicesSafely(BluetoothAdapter adapter) {
        try {
            return adapter.getBondedDevices();
        } catch (SecurityException exception) {
            return Collections.emptySet();
        }
    }

    private PrinterDescriptor createDescriptor(BluetoothDevice device) {
        return new PrinterDescriptor(
                ConnectionType.BLUETOOTH,
                getNameSafely(device),
                null,
                null,
                null,
                null,
                null,
                device.getAddress(),
                null
        );
    }

    /**
     * Reads the device name via BluetoothDevice.getName() — Android 12+ throws
     * SecurityException without BLUETOOTH_CONNECT, treated as an unnamed device
     * rather than failing the whole scan.
     */
    private String getNameSafely(BluetoothDevice device) {
        try {
            return device.getName();
        } catch (SecurityException ignored) {
            return null;
        }
    }
}
```

- [ ] **Step 5: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/bluetooth \
        android/app/src/main/java/com/ndtcorepos/thermalprinter/writer/bluetooth \
        android/app/src/main/java/com/ndtcorepos/thermalprinter/device/bluetooth \
        android/app/src/main/java/com/ndtcorepos/thermalprinter/discovery/bluetooth
git commit -m "$(cat <<'EOF'
feat: add Bluetooth transport to the new printer architecture

Ports the RFCOMM connect/write/discover logic from the deleted old
transport/bluetooth/* and discovery/bluetooth/BluetoothPrinterDiscovery
into the new synchronous connection/writer/device/discovery layering,
mirroring the existing USB implementation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Network (LAN) transport (connection, writer, device)

Adds the LAN counterpart. No discovery package is needed — LAN printers are always added by explicit host/port (`NativeAdapter.listDevices` short-circuits to `[]` for LAN without calling native discovery at all).

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/net/NetConnection.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/writer/net/NetWriter.java`
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/device/net/NetworkPrinterDevice.java`

**Interfaces:**
- Consumes: same `connection.IPrinterConnection` / `writer.IPrinterWriter` / `device.IPrinterDevice` interfaces as Task 2.
- Produces: `NetConnection(String host, int port)`, `NetWriter(NetConnection)`, `NetworkPrinterDevice(ConnectionIdentity, NetConnection)` — consumed by Task 5's `ThermalPrinterModule`.

- [ ] **Step 1: Create `NetConnection.java`**

```java
package com.ndtcorepos.thermalprinter.connection.net;

import com.ndtcorepos.thermalprinter.connection.IPrinterConnection;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

/** Manages the lifecycle of a TCP socket to one network printer. */
public final class NetConnection implements IPrinterConnection {

    private static final int CONNECT_TIMEOUT_MS = 5_000;

    private final String host;
    private final int port;
    private Socket socket;
    private ConnectionState state = ConnectionState.DISCONNECTED;

    public NetConnection(String host, int port) {
        this.host = host;
        this.port = port;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        if (isConnected()) {
            return PrinterWriteResult.success(0);
        }

        state = ConnectionState.CONNECTING;

        try {
            Socket newSocket = new Socket();
            newSocket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
            socket = newSocket;
        } catch (IOException exception) {
            state = ConnectionState.DISCONNECTED;
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }

        state = ConnectionState.CONNECTED;
        return PrinterWriteResult.success(0);
    }

    public OutputStream getOutputStream() throws IOException {
        return socket.getOutputStream();
    }

    @Override
    public synchronized PrinterWriteResult close() {
        state = ConnectionState.CLOSING;

        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }

        state = ConnectionState.DISCONNECTED;
        return PrinterWriteResult.success(0);
    }

    @Override
    public synchronized ConnectionState getState() {
        return state;
    }

    @Override
    public synchronized boolean isConnected() {
        return state == ConnectionState.CONNECTED && socket != null && socket.isConnected() && !socket.isClosed();
    }
}
```

- [ ] **Step 2: Create `NetWriter.java`**

```java
package com.ndtcorepos.thermalprinter.writer.net;

import com.ndtcorepos.thermalprinter.connection.net.NetConnection;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.IPrinterWriter;

import java.io.IOException;
import java.io.OutputStream;

/** Writes raw bytes to a printer over an open TCP connection. */
public final class NetWriter implements IPrinterWriter {

    private static final int DEFAULT_TIMEOUT = 5_000;

    private final NetConnection connection;

    public NetWriter(NetConnection connection) {
        this.connection = connection;
    }

    @Override
    public synchronized PrinterWriteResult write(byte[] data) {
        return write(data, DEFAULT_TIMEOUT);
    }

    /**
     * Writes bytes and flushes the socket's OutputStream.
     *
     * @param data raw printer bytes
     * @param timeout unused — TCP writes block on the OS socket buffer, which
     *     has no configurable per-call timeout on Android
     */
    @Override
    public synchronized PrinterWriteResult write(byte[] data, int timeout) {
        if (data == null || data.length == 0) {
            return PrinterWriteResult.success(0);
        }

        if (!connection.isConnected()) {
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_CLOSED, 0);
        }

        try {
            OutputStream out = connection.getOutputStream();
            out.write(data);
            out.flush();
        } catch (IOException exception) {
            return PrinterWriteResult.failure(PrinterErrorCode.WRITE_FAILED, 0);
        }

        return PrinterWriteResult.success(data.length);
    }
}
```

- [ ] **Step 3: Create `NetworkPrinterDevice.java`**

```java
package com.ndtcorepos.thermalprinter.device.net;

import com.ndtcorepos.thermalprinter.connection.net.NetConnection;
import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.net.NetWriter;

/**
 * Coordinates the runtime components required by a network (LAN) printer.
 *
 * NetworkPrinterDevice owns the TCP connection lifecycle and creates the
 * writer after the connection has been successfully opened.
 */
public final class NetworkPrinterDevice implements IPrinterDevice {

    private final ConnectionIdentity connectionIdentity;
    private final NetConnection connection;
    private NetWriter writer;

    public NetworkPrinterDevice(ConnectionIdentity connectionIdentity, NetConnection connection) {
        this.connectionIdentity = connectionIdentity;
        this.connection = connection;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        PrinterWriteResult result = connection.open();

        if (!result.isSuccess()) {
            return result;
        }

        writer = new NetWriter(connection);
        return PrinterWriteResult.success(0);
    }

    @Override
    public synchronized PrinterWriteResult write(byte[] data) {
        if (writer == null) {
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_CLOSED, 0);
        }

        return writer.write(data);
    }

    @Override
    public synchronized PrinterWriteResult close() {
        writer = null;
        return connection.close();
    }

    @Override
    public ConnectionIdentity getConnectionIdentity() {
        return connectionIdentity;
    }

    @Override
    public ConnectionState getState() {
        return connection.getState();
    }
}
```

- [ ] **Step 4: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/net \
        android/app/src/main/java/com/ndtcorepos/thermalprinter/writer/net \
        android/app/src/main/java/com/ndtcorepos/thermalprinter/device/net
git commit -m "$(cat <<'EOF'
feat: add LAN transport to the new printer architecture

Ports the TCP connect/write logic from the deleted old
transport/net/{NetConnection,NetWriter} into the new synchronous
connection/writer/device layering, mirroring USB and Bluetooth. No
discovery package — LAN printers are always added by explicit host/port.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Port USB permission handling (async grant/deny) into the new architecture

The new `connection/usb/UsbConnection.open()` currently just fails with `PERMISSION_DENIED` if permission isn't already granted — there is no code path that ever requests it, so USB can only ever connect to a device the user has already approved through some other means. The old (deleted in Task 1) `permission/UsbPermission.java` had a complete, working `PendingIntent`/`BroadcastReceiver` implementation for this. This task ports it into the new architecture and wires `UsbConnection.open()` to request permission and wait for the result when it's missing — matching the TS-side comment in `PrinterNativeModule.ts` ("permission USB được xử lý ngầm trong discoverPrinters/connect": permission is handled implicitly inside `connect`, not as a separate step the JS layer calls).

**Files:**
- Create: `android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/usb/UsbPermission.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/usb/UsbConnection.java`

**Interfaces:**
- Produces: `UsbPermission(ReactApplicationContext)` with `register()`, `hasPermission(UsbDevice)`, `requestPermission(UsbDevice)`, `registerPermissionResultListener(int vendorId, int productId, Consumer<Boolean>)`, `unregisterPermissionResultListener(int, int)`, `registerDeviceDetachListener(int, int, Runnable)`, `unregisterDeviceDetachListener(int, int)` — consumed by `UsbConnection` here and constructed once in Task 5's `ThermalPrinterModule` constructor.
- Modifies: `UsbConnection`'s constructor gains a 4th parameter, `UsbPermission permission` — Task 5 is the only caller and is written to already pass it.

- [ ] **Step 1: Create `permission/usb/UsbPermission.java`**

Same PendingIntent/BroadcastReceiver mechanism as the deleted `permission/UsbPermission.java`, moved to package `permission.usb`:

```java
package com.ndtcorepos.thermalprinter.permission.usb;

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

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * USB runtime permission (Android requires granting it per UsbDevice) plus
 * physical-detach detection via BroadcastReceiver. Knows nothing about bulk
 * transfer — UsbConnection calls into this to request/await permission and to
 * be notified when a device it's using is unplugged.
 */
public final class UsbPermission {

    private static final String LOG_SOURCE = "UsbPermission";
    private static final String ACTION_USB_PERMISSION = "com.ndtcorepos.thermalprinter.USB_PERMISSION";

    private final ReactApplicationContext context;
    private final UsbManager usbManager;
    private PendingIntent permissionIntent;
    private final Map<String, Runnable> deviceDetachListeners = new HashMap<>();
    private final Map<String, Consumer<Boolean>> permissionResultListeners = new HashMap<>();

    public UsbPermission(ReactApplicationContext context) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    /**
     * Registers a detach callback keyed by (vendorId, productId) — one
     * UsbPermission instance is shared by every UsbConnection, so listeners
     * must be told apart by device rather than a single shared Runnable.
     */
    public void registerDeviceDetachListener(int vendorId, int productId, Runnable listener) {
        deviceDetachListeners.put(deviceKey(vendorId, productId), listener);
    }

    /** Unregisters a detach callback — call when a UsbConnection closes on its own. */
    public void unregisterDeviceDetachListener(int vendorId, int productId) {
        deviceDetachListeners.remove(deviceKey(vendorId, productId));
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
        permissionResultListeners.put(deviceKey(vendorId, productId), listener);
    }

    /** Unregisters a permission-result callback after it fires, or if the caller gives up. */
    public void unregisterPermissionResultListener(int vendorId, int productId) {
        permissionResultListeners.remove(deviceKey(vendorId, productId));
    }

    public void register() {
        Intent intent = new Intent(ACTION_USB_PERMISSION);
        intent.setPackage(context.getPackageName());

        int flag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_MUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
        this.permissionIntent = PendingIntent.getBroadcast(context, 0, intent, flag);

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }

        Log.v(LOG_SOURCE, "receiver registered");
    }

    public boolean hasPermission(UsbDevice device) {
        return usbManager.hasPermission(device);
    }

    public void requestPermission(UsbDevice device) {
        usbManager.requestPermission(device, permissionIntent);
    }

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            String action = intent.getAction();

            if (ACTION_USB_PERMISSION.equals(action)) {
                handlePermissionResult(ctx, intent);
                return;
            }

            if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                handleDeviceDetached(ctx, intent);
            }
        }
    };

    /**
     * Reads the permission result Android sends back after the user answers the
     * dialog, then notifies the matching listener via permissionResultListeners
     * (keyed by vendorId/productId).
     */
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

        String key = deviceKey(device.getVendorId(), device.getProductId());
        Consumer<Boolean> listener = permissionResultListeners.get(key);

        if (listener == null) {
            return;
        }

        listener.accept(granted);
    }

    /**
     * Multiple UsbConnections can be active at once, so the detached device must
     * be read from EXTRA_DEVICE and only that device's listener notified.
     */
    private void handleDeviceDetached(Context ctx, Intent intent) {
        Toast.makeText(ctx, "USB device has been turned off", Toast.LENGTH_LONG).show();

        UsbDevice device = getDeviceExtra(intent);

        if (device == null) {
            return;
        }

        String key = deviceKey(device.getVendorId(), device.getProductId());
        Runnable listener = deviceDetachListeners.get(key);

        if (listener == null) {
            return;
        }

        listener.run();
    }

    /**
     * Reads the UsbDevice attached to the Intent (both detach and permission-
     * result actions carry EXTRA_DEVICE) — the Parcelable getter's signature
     * changed between SDK levels, hence the version branch.
     */
    @SuppressWarnings("deprecation")
    private static UsbDevice getDeviceExtra(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice.class);
        }
        return intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
    }
}
```

- [ ] **Step 2: Modify `connection/usb/UsbConnection.java` to request and await permission**

Read the current file first, then replace its contents with:

```java
package com.ndtcorepos.thermalprinter.connection.usb;

import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.thermalprinter.connection.IPrinterConnection;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.permission.usb.UsbPermission;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Manages the Android USB resources for one physical printer connection. */
public final class UsbConnection implements IPrinterConnection {

    private static final int PERMISSION_TIMEOUT_SECONDS = 30;

    private final UsbManager usbManager;
    private final UsbDevice device;
    private final UsbInterface usbInterface;
    private final UsbPermission permission;

    private UsbDeviceConnection usbConnection;
    private volatile ConnectionState state = ConnectionState.DISCONNECTED;

    public UsbConnection(
            UsbManager usbManager,
            UsbDevice device,
            UsbInterface usbInterface,
            UsbPermission permission
    ) {
        this.usbManager = usbManager;
        this.device = device;
        this.usbInterface = usbInterface;
        this.permission = permission;
        // close() is already idempotent and does exactly what a physical detach
        // requires (release the interface, close the connection) — reused
        // directly as the detach handler.
        this.permission.registerDeviceDetachListener(device.getVendorId(), device.getProductId(), this::close);
    }

    /**
     * Opens the USB connection, requesting permission first when it isn't
     * already granted.
     *
     * Deliberately NOT `synchronized` — awaitPermission() below can block for
     * up to PERMISSION_TIMEOUT_SECONDS while the system dialog is on screen. If
     * this method held the instance lock during that wait, a device detached
     * mid-dialog could never complete close() (which needs the same lock) to
     * unblock the wait, deadlocking until the timeout instead of failing fast.
     */
    @Override
    public PrinterWriteResult open() {
        if (isConnected()) {
            return PrinterWriteResult.success(0);
        }

        if (usbManager == null || device == null || usbInterface == null) {
            return PrinterWriteResult.failure(PrinterErrorCode.DEVICE_NOT_FOUND, 0);
        }

        if (!permission.hasPermission(device)) {
            boolean granted = awaitPermission();

            if (!granted) {
                return PrinterWriteResult.failure(PrinterErrorCode.PERMISSION_DENIED, 0);
            }
        }

        return claim();
    }

    private synchronized PrinterWriteResult claim() {
        state = ConnectionState.CONNECTING;

        UsbDeviceConnection candidate = usbManager.openDevice(device);

        if (candidate == null || !candidate.claimInterface(usbInterface, true)) {
            if (candidate != null) {
                candidate.close();
            }

            state = ConnectionState.DISCONNECTED;
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }

        usbConnection = candidate;
        state = ConnectionState.CONNECTED;
        return PrinterWriteResult.success(0);
    }

    /**
     * Requests USB permission and blocks until the system dialog's result
     * arrives (granted/denied), the device is detached mid-dialog, or
     * PERMISSION_TIMEOUT_SECONDS elapses — so open() returns one definitive
     * result instead of treating a still-open dialog as "connected".
     */
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

    @Override
    public synchronized PrinterWriteResult close() {
        state = ConnectionState.CLOSING;

        if (usbConnection != null) {
            try {
                usbConnection.releaseInterface(usbInterface);
                usbConnection.close();
            } catch (Exception ignored) {
            }
            usbConnection = null;
        }

        state = ConnectionState.DISCONNECTED;
        permission.unregisterDeviceDetachListener(device.getVendorId(), device.getProductId());
        return PrinterWriteResult.success(0);
    }

    @Override
    public ConnectionState getState() {
        return state;
    }

    @Override
    public boolean isConnected() {
        return state == ConnectionState.CONNECTED && usbConnection != null;
    }

    public synchronized UsbDeviceConnection getUsbConnection() {
        return usbConnection;
    }

    public UsbInterface getUsbInterface() {
        return usbInterface;
    }
}
```

- [ ] **Step 3: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```

Expected: this will fail until Task 5 updates `ThermalPrinterModule`'s `UsbConnection` construction to pass the new 4th `UsbPermission` argument — `UsbPrinterDevice` itself needs no change (it only holds a `UsbConnection` reference). If Task 5 hasn't run yet, confirm the only compile error is at `ThermalPrinterModule.java`'s `new UsbConnection(...)` call site, then proceed — that call site is rewritten in Task 5.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/permission/usb \
        android/app/src/main/java/com/ndtcorepos/thermalprinter/connection/usb/UsbConnection.java
git commit -m "$(cat <<'EOF'
feat: request and await USB permission inside UsbConnection.open()

Ports the working PendingIntent/BroadcastReceiver permission flow from
the deleted old permission/UsbPermission.java into permission/usb/, and
wires UsbConnection.open() to request permission and block (bounded by a
30s timeout) on the dialog's result when not already granted — matching
the "permission is handled implicitly inside connect()" contract the TS
layer (PrinterNativeModule.ts) already documents and relies on.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rewrite `ThermalPrinterModule` to the printerId/multi-transport API the TS layer expects

This is the task that actually makes the app work. `ThermalPrinterModule.java`'s current `@ReactMethod`s (`discoverDevices`/`hasPermission`/`open`/`writeBytes`/`close`/`isConnected`/`getConnectionState`, keyed by raw Android `deviceName`, USB-only) do not match any method the TS layer calls. The TS layer (`PrinterNativeModule.ts` → `NativeAdapter.ts` / `UsbTransport.ts`) calls `discoverPrinters(type)`, `connect(request)`, `writeByBase64(printerId, base64Data)`, `disconnect(printerId)` — keyed by a caller-assigned `printerId`, across USB/Bluetooth/LAN. Every one of those TS files is correct already and needs no change; only the Java side is rewritten to fulfill that contract, using Tasks 2–4's transports.

**Files:**
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/enums/ConnectionType.java`
- Modify: `android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java`

**Interfaces:**
- Consumes: `UsbPrinterDiscovery`, `BluetoothPrinterDiscovery`, `UsbConnectionIdentityResolver`, `UsbEndpointResolver`, `UsbPermission` (Task 4), `UsbConnection`/`UsbPrinterDevice`, `BluetoothConnection`/`BluetoothPrinterDevice` (Task 2), `NetConnection`/`NetworkPrinterDevice` (Task 3), `PrinterDeviceManager`/`PrinterDeviceRegistry` (Task 1), `PrinterQueueManager`.
- Produces: the bridge surface `NativeModules.ThermalPrinterModule.{discoverPrinters(wireType), connect(request), writeByBase64(printerId, base64Data), disconnect(printerId)}` that `PrinterNativeModule.ts` (unchanged) calls — verified against Task 6's trimmed wrapper.

- [ ] **Step 1: Add `getWireValue()` to `ConnectionType`**

Read the current file, then add a getter next to the existing `fromWireValue()` static method (keep everything else unchanged):

```java
package com.ndtcorepos.thermalprinter.enums;

/**
 * Loại kết nối phần cứng máy in. `wireValue` là chuỗi React Native gửi qua
 * bridge (tham số `connectionType` / field `type` trong connection map).
 */
public enum ConnectionType {
    USB("usb"),
    BLUETOOTH("bluetooth"),
    LAN("lan");

    private final String wireValue;

    ConnectionType(String wireValue) {
        this.wireValue = wireValue;
    }

    public String getWireValue() {
        return wireValue;
    }

    public static ConnectionType fromWireValue(String wireValue) {
        for (ConnectionType type : values()) {
            if (type.wireValue.equals(wireValue)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown connection type: " + wireValue);
    }
}
```

- [ ] **Step 2: Rewrite `module/ThermalPrinterModule.java`**

Replace the entire file:

```java
package com.ndtcorepos.thermalprinter.module;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.util.Base64;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import com.ndtcorepos.thermalprinter.connection.bluetooth.BluetoothConnection;
import com.ndtcorepos.thermalprinter.connection.net.NetConnection;
import com.ndtcorepos.thermalprinter.connection.usb.UsbConnection;
import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.device.PrinterDeviceManager;
import com.ndtcorepos.thermalprinter.device.PrinterDeviceRegistry;
import com.ndtcorepos.thermalprinter.device.bluetooth.BluetoothPrinterDevice;
import com.ndtcorepos.thermalprinter.device.net.NetworkPrinterDevice;
import com.ndtcorepos.thermalprinter.device.usb.UsbPrinterDevice;
import com.ndtcorepos.thermalprinter.discovery.bluetooth.BluetoothPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.enums.IdentityStability;
import com.ndtcorepos.thermalprinter.identity.usb.UsbConnectionIdentityResolver;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.permission.usb.UsbPermission;
import com.ndtcorepos.thermalprinter.queue.PrinterQueueManager;
import com.ndtcorepos.thermalprinter.writer.usb.UsbEndpointResolver;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Future;

/**
 * React Native bridge for the native thermal printer layer.
 *
 * Exposes transport operations only — device discovery, connection lifecycle,
 * and raw byte transmission, addressed by `printerId` (assigned by the JS
 * caller, one per saved printer, independent of transport). Printer
 * protocols, rendering, and paper configuration remain outside this layer.
 */
public final class ThermalPrinterModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "ThermalPrinterModule";

    private final UsbManager usbManager;

    private final UsbPrinterDiscovery usbDiscovery;
    private final BluetoothPrinterDiscovery bluetoothDiscovery;
    private final UsbConnectionIdentityResolver usbIdentityResolver;
    private final UsbEndpointResolver usbEndpointResolver;
    private final UsbPermission usbPermission;

    private final PrinterDeviceManager deviceManager;
    private final PrinterQueueManager queueManager;

    /** Maps a caller-assigned printerId to the physical connection currently backing it. */
    private final Map<String, ConnectionIdentity> connectedPrinters = new HashMap<>();

    public ThermalPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);

        this.usbManager = (UsbManager) reactContext.getSystemService(Context.USB_SERVICE);

        this.usbDiscovery = new UsbPrinterDiscovery(reactContext);
        this.bluetoothDiscovery = new BluetoothPrinterDiscovery();
        this.usbIdentityResolver = new UsbConnectionIdentityResolver();
        this.usbEndpointResolver = new UsbEndpointResolver();

        this.usbPermission = new UsbPermission(reactContext);
        this.usbPermission.register();

        this.deviceManager = new PrinterDeviceManager(new PrinterDeviceRegistry());
        this.queueManager = new PrinterQueueManager();
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Lists currently visible devices for one transport.
     *
     * LAN has no discovery step (printers are added by host/port) — resolves
     * an empty array rather than rejecting if called with `lan` anyway.
     */
    @ReactMethod
    public void discoverPrinters(String wireConnectionType, Promise promise) {
        try {
            ConnectionType type = ConnectionType.fromWireValue(wireConnectionType);
            List<PrinterDescriptor> descriptors = discoverFor(type);

            WritableArray result = Arguments.createArray();

            for (PrinterDescriptor descriptor : descriptors) {
                result.pushMap(toWritableMap(descriptor));
            }

            promise.resolve(result);
        } catch (Exception exception) {
            promise.reject("DISCOVERY_FAILED", exception);
        }
    }

    private List<PrinterDescriptor> discoverFor(ConnectionType type) {
        if (type == ConnectionType.USB) {
            return usbDiscovery.discover();
        }

        if (type == ConnectionType.BLUETOOTH) {
            return bluetoothDiscovery.discover();
        }

        return Collections.emptyList();
    }

    /**
     * Opens a connection for one printer, reusing the existing runtime device
     * if the same physical connection is already open under a different
     * printerId.
     *
     * USB permission (system dialog) is requested implicitly here when not
     * already granted — see UsbConnection.open() (Task 4).
     */
    @ReactMethod
    public void connect(ReadableMap request, Promise promise) {
        try {
            String printerId = request.getString("printerId");
            ConnectionType type = ConnectionType.fromWireValue(request.getString("type"));

            ConnectionIdentity identity = resolveIdentity(type, request);

            if (identity == null) {
                promise.reject("CONNECT_FAILED", "Device not found");
                return;
            }

            IPrinterDevice device = deviceManager.get(identity);

            if (device == null) {
                device = createDevice(type, identity, request);

                PrinterWriteResult result = device.open();

                if (!result.isSuccess()) {
                    promise.reject("CONNECT_FAILED", result.getErrorCode().name());
                    return;
                }

                deviceManager.register(device);
            }

            connectedPrinters.put(printerId, identity);
            promise.resolve(null);
        } catch (Exception exception) {
            promise.reject("CONNECT_FAILED", exception);
        }
    }

    /**
     * Resolves the physical connection identity for a connect request — cheap
     * enough to call before deciding whether a new device even needs building.
     *
     * @return null when the requested USB device is not currently attached
     */
    private ConnectionIdentity resolveIdentity(ConnectionType type, ReadableMap request) {
        if (type == ConnectionType.USB) {
            UsbDevice usbDevice = findUsbDevice(request.getInt("vendorId"), request.getInt("productId"));

            if (usbDevice == null) {
                return null;
            }

            return usbIdentityResolver.resolve(toUsbDescriptor(usbDevice));
        }

        if (type == ConnectionType.BLUETOOTH) {
            String address = request.getString("address");
            return new ConnectionIdentity("BLUETOOTH:" + address, ConnectionType.BLUETOOTH, IdentityStability.STABLE);
        }

        String host = request.getString("host");
        int port = request.getInt("port");
        return new ConnectionIdentity("LAN:" + host + ":" + port, ConnectionType.LAN, IdentityStability.STABLE);
    }

    /** Builds (but does not open) the runtime device for a connect request. */
    private IPrinterDevice createDevice(ConnectionType type, ConnectionIdentity identity, ReadableMap request) {
        if (type == ConnectionType.USB) {
            UsbDevice usbDevice = findUsbDevice(request.getInt("vendorId"), request.getInt("productId"));
            UsbInterface usbInterface = findPrinterInterface(usbDevice);
            UsbConnection connection = new UsbConnection(usbManager, usbDevice, usbInterface, usbPermission);
            return new UsbPrinterDevice(identity, connection, usbEndpointResolver);
        }

        if (type == ConnectionType.BLUETOOTH) {
            return new BluetoothPrinterDevice(identity, new BluetoothConnection(request.getString("address")));
        }

        return new NetworkPrinterDevice(identity, new NetConnection(request.getString("host"), request.getInt("port")));
    }

    /** Writes bytes (decoded from base64) to a connected printer, serialized per physical connection. */
    @ReactMethod
    public void writeByBase64(String printerId, String base64Data, Promise promise) {
        try {
            ConnectionIdentity identity = connectedPrinters.get(printerId);
            IPrinterDevice device = identity == null ? null : deviceManager.get(identity);

            if (device == null) {
                promise.reject("WRITE_FAILED", "Printer not connected: " + printerId);
                return;
            }

            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

            Future<PrinterWriteResult> future = queueManager.submit(device, bytes);
            PrinterWriteResult result = future.get();

            if (!result.isSuccess()) {
                promise.reject("WRITE_FAILED", result.getErrorCode().name());
                return;
            }

            promise.resolve("ok");
        } catch (Exception exception) {
            promise.reject("WRITE_FAILED", exception);
        }
    }

    /** Closes a printer's connection and forgets its printerId mapping. */
    @ReactMethod
    public void disconnect(String printerId, Promise promise) {
        ConnectionIdentity identity = connectedPrinters.remove(printerId);

        if (identity == null) {
            promise.resolve(null);
            return;
        }

        queueManager.remove(identity);

        IPrinterDevice device = deviceManager.remove(identity);

        if (device != null) {
            device.close();
        }

        promise.resolve(null);
    }

    private UsbDevice findUsbDevice(int vendorId, int productId) {
        for (UsbDevice candidate : usbManager.getDeviceList().values()) {
            if (candidate.getVendorId() == vendorId && candidate.getProductId() == productId) {
                return candidate;
            }
        }

        return null;
    }

    private UsbInterface findPrinterInterface(UsbDevice device) {
        for (int index = 0; index < device.getInterfaceCount(); index++) {
            UsbInterface usbInterface = device.getInterface(index);

            if (usbInterface.getEndpointCount() > 0) {
                return usbInterface;
            }
        }

        return null;
    }

    private PrinterDescriptor toUsbDescriptor(UsbDevice device) {
        return new PrinterDescriptor(
                ConnectionType.USB,
                device.getDeviceName(),
                device.getManufacturerName(),
                device.getProductName(),
                getSerialNumberSafely(device),
                device.getVendorId(),
                device.getProductId(),
                null,
                null
        );
    }

    private String getSerialNumberSafely(UsbDevice device) {
        try {
            return device.getSerialNumber();
        } catch (SecurityException exception) {
            return null;
        }
    }

    /** Converts a printer descriptor into the PrinterInfoDto shape PrinterNativeModule.ts expects. */
    private WritableMap toWritableMap(PrinterDescriptor descriptor) {
        WritableMap map = Arguments.createMap();

        map.putString("type", descriptor.getConnectionType().getWireValue());
        putNullableString(map, "name", descriptor.getProductName() != null ? descriptor.getProductName() : descriptor.getDeviceName());
        putNullableString(map, "manufacturerName", descriptor.getManufacturer());
        putNullableString(map, "productName", descriptor.getProductName());
        putNullableString(map, "serialNumber", descriptor.getSerialNumber());
        putNullableString(map, "address", descriptor.getAddress());
        putNullableInt(map, "vendorId", descriptor.getVendorId());
        putNullableInt(map, "productId", descriptor.getProductId());
        map.putNull("host");
        map.putNull("port");

        return map;
    }

    private void putNullableString(WritableMap map, String key, String value) {
        if (value != null) {
            map.putString(key, value);
        } else {
            map.putNull(key);
        }
    }

    private void putNullableInt(WritableMap map, String key, Integer value) {
        if (value != null) {
            map.putInt(key, value);
        } else {
            map.putNull(key);
        }
    }
}
```

- [ ] **Step 3: Verify the project compiles**

```bash
cd NDTCore.App/android
.\gradlew.bat compileDebugJavaWithJavac
```

Expected: BUILD SUCCESSFUL. This is the first point where the whole native module — USB, Bluetooth, and LAN — compiles under the new architecture with an API surface that matches what `PrinterNativeModule.ts` already calls.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/ndtcorepos/thermalprinter/module/ThermalPrinterModule.java \
        android/app/src/main/java/com/ndtcorepos/thermalprinter/enums/ConnectionType.java
git commit -m "$(cat <<'EOF'
refactor: rewrite ThermalPrinterModule to the printerId/multi-transport API

The previous rewrite (per the spec doc) exposed discoverDevices/open/
writeBytes/close keyed by raw Android deviceName, USB-only — a different,
incompatible contract from the one PrinterNativeModule.ts / NativeAdapter.ts
/ UsbTransport.ts already call (discoverPrinters/connect/writeByBase64/
disconnect, keyed by caller-assigned printerId, across USB/Bluetooth/LAN).
Rewrites the module to fulfill the existing TS contract instead, built on
the new device/connection/writer/queue layering plus Bluetooth and LAN
support added in prior tasks.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Trim the TS native-module wrapper to the methods that actually exist

`PrinterNativeModule.ts` currently exports `reconnect`, `getPrinterInfo`, `getPrinterCapabilities`, `getConnectionState`, `cancelPrintJob`, `getQueueStatus` in addition to the four methods Task 5 implements. None of those six are called anywhere in the app outside their own tests/mocks (confirmed by grep — only `PrinterNativeModule.test.ts`, `MockPrinterAdapter.ts`/its test, and `jest.setup.js`'s global mock reference them). Since Task 5 does not implement them on the Java side, leaving them in the TS wrapper would recreate exactly the bug this whole refactor fixes for a narrower set of methods — a TS method that throws "is not a function" if anyone ever calls it. Removing them is the minimal, correct fix, consistent with `NDTCore.App/CLAUDE.md`'s "no abstraction beyond what's needed" convention. `NativeAdapter.ts` and `UsbTransport.ts` need **no changes** — they only ever called the four methods Task 5 implements.

**Files:**
- Modify: `NDTCore.App/src/features/printer/adapters/native/PrinterNativeModule.ts`
- Modify: `NDTCore.App/src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts`
- Modify: `NDTCore.App/src/features/printer/adapters/testing/MockPrinterAdapter.ts`
- Modify: `NDTCore.App/src/features/printer/adapters/testing/__tests__/MockPrinterAdapter.test.ts`
- Modify: `NDTCore.App/jest.setup.js`

**Interfaces:**
- Produces: `ThermalPrinterModule` (TS) keeps exactly `discoverPrinters(type)`, `connect(request)`, `disconnect(printerId)`, `writeByBase64(printerId, base64Data)` — unchanged from what `NativeAdapter.ts`/`UsbTransport.ts` already call, so those two files and their tests need no edits.

- [ ] **Step 1: Trim `PrinterNativeModule.ts`**

Read the current file, then replace it with:

```typescript
import { NativeModules } from 'react-native';
import { PrinterConnectionType } from '../../models/printer/PrinterConnection';

const ThermalPrinterModuleNative = NativeModules.ThermalPrinterModule;

/**
 * Wire value native Android thực sự hiểu — `ConnectionType.fromWireValue()`
 * (Java) so sánh `.equals()` phân biệt hoa/thường với đúng 3 hằng số thường
 * này. `PrinterConnectionType` (TS) đã PascalCase từ Task 1 nên PHẢI dịch lại
 * ở biên cầu nối, giống cách `NativeAdapter.connect()` tự gửi literal
 * `'usb'`/`'bluetooth'`/`'lan'` riêng thay vì forward thẳng enum.
 */
const toWireConnectionType = (type: PrinterConnectionType): 'usb' | 'bluetooth' | 'lan' => {
  if (type === PrinterConnectionType.Usb) {
    return 'usb';
  }

  if (type === PrinterConnectionType.Bluetooth) {
    return 'bluetooth';
  }

  return 'lan';
};

/** Metadata 1 printer trả về từ native (discoverPrinters). */
export interface PrinterInfoDto {
  type: 'usb' | 'bluetooth' | 'lan';
  name: string | null;
  manufacturerName: string | null;
  productName: string | null;
  vendorId: number | null;
  productId: number | null;
  serialNumber: string | null;
  address: string | null;
  host: string | null;
  port: number | null;
}

export type UsbConnectRequest = { printerId: string; type: 'usb'; vendorId: number; productId: number };
export type BluetoothConnectRequest = { printerId: string; type: 'bluetooth'; address: string };
export type LanConnectRequest = { printerId: string; type: 'lan'; host: string; port: number };
export type ConnectRequest = UsbConnectRequest | BluetoothConnectRequest | LanConnectRequest;

/**
 * Lớp JS của native module `ThermalPrinterModule`
 * (`com.ndtcorepos.thermalprinter.module.ThermalPrinterModule`, code ở
 * `android/app/src/main/java/com/ndtcorepos/thermalprinter/`) — chỉ Android.
 * Mọi lệnh địa chỉ theo `printerId` (không theo `connectionType`) — 1
 * printerId ứng đúng 1 device đã connect, cho phép nhiều printer cùng loại
 * kết nối song song. Không có `init()` — permission USB được xử lý ngầm
 * trong `connect`.
 */
export const ThermalPrinterModule = {
  discoverPrinters: (type: PrinterConnectionType): Promise<PrinterInfoDto[]> => ThermalPrinterModuleNative.discoverPrinters(toWireConnectionType(type)),

  connect: (request: ConnectRequest): Promise<void> => ThermalPrinterModuleNative.connect(request),

  disconnect: (printerId: string): Promise<void> => ThermalPrinterModuleNative.disconnect(printerId),

  writeByBase64: (printerId: string, base64Data: string): Promise<string> => ThermalPrinterModuleNative.writeByBase64(printerId, base64Data),
};
```

- [ ] **Step 2: Trim `PrinterNativeModule.test.ts`**

Read the current file, then replace the `beforeEach` mock and drop the deleted-method assertions (the four kept tests — `discoverPrinters`, `connect`, `disconnect`, `writeByBase64` — are unchanged):

```typescript
import { NativeModules } from 'react-native';
import { PrinterConnectionType } from '../../../models/printer/PrinterConnection';

const loadReal = () =>
  jest.requireActual('../PrinterNativeModule') as typeof import('../PrinterNativeModule');

const originalThermalPrinterModule = NativeModules.ThermalPrinterModule;

beforeEach(() => {
  NativeModules.ThermalPrinterModule = {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  };
});

afterEach(() => {
  NativeModules.ThermalPrinterModule = originalThermalPrinterModule;
  jest.resetModules();
});

describe('ThermalPrinterModule', () => {
  /**
   * `PrinterConnectionType` (TS) là PascalCase (`'Usb'`) nhưng native Android
   * (`ConnectionType.fromWireValue()`, Java) chỉ nhận đúng 3 hằng số thường —
   * `discoverPrinters()` phải tự dịch lại ở boundary, KHÔNG forward thẳng giá
   * trị enum (khác bản cũ trước Task 1 khi enum TS vốn đã thường sẵn).
   */
  it.each([
    [PrinterConnectionType.Usb, 'usb'],
    [PrinterConnectionType.Bluetooth, 'bluetooth'],
    [PrinterConnectionType.Lan, 'lan'],
  ])('discoverPrinters(%s) gọi native với wire value thường %s', async (input, expectedWireValue) => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.discoverPrinters(input);
    expect(NativeModules.ThermalPrinterModule.discoverPrinters).toHaveBeenCalledWith(expectedWireValue);
  });

  it('connect gọi native với đúng request (kèm printerId)', async () => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.connect({ printerId: 'p1', type: 'usb', vendorId: 1234, productId: 5678 });
    expect(NativeModules.ThermalPrinterModule.connect).toHaveBeenCalledWith({ printerId: 'p1', type: 'usb', vendorId: 1234, productId: 5678 });
  });

  it('disconnect gọi native với đúng printerId', async () => {
    const { ThermalPrinterModule } = loadReal();
    await ThermalPrinterModule.disconnect('p1');
    expect(NativeModules.ThermalPrinterModule.disconnect).toHaveBeenCalledWith('p1');
  });

  it('writeByBase64 gọi native với đúng printerId + base64Data', async () => {
    const { ThermalPrinterModule } = loadReal();
    await expect(ThermalPrinterModule.writeByBase64('p1', 'QUI=')).resolves.toBe('ok');
    expect(NativeModules.ThermalPrinterModule.writeByBase64).toHaveBeenCalledWith('p1', 'QUI=');
  });
});
```

- [ ] **Step 3: Trim `MockPrinterAdapter.ts`**

```typescript
/**
 * Test double dùng chung cho adapters/ trong unit test — thay vì mỗi file
 * test tự viết lại `jest.fn()` boilerplate cho từng adapter. KHÔNG dùng cho
 * production code (chỉ import được từ file test, phụ thuộc global `jest`).
 */
export const createMockThermalPrinterModule = () => ({
  discoverPrinters: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  writeByBase64: jest.fn().mockResolvedValue('ok'),
});
```

- [ ] **Step 4: Update `MockPrinterAdapter.test.ts`**

Read the current file first. Remove the assertions for `getConnectionState`/`getQueueStatus` (the only two of the removed methods it exercises) and keep the rest.

- [ ] **Step 5: Trim the global mock in `jest.setup.js`**

Read the current file around the `ThermalPrinterModule` mock (found at the lines noted below) and replace both blocks:

```javascript
jest.mock('./src/features/printer/adapters/native/PrinterNativeModule', () => ({
  ThermalPrinterModule: {
    discoverPrinters: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('Print SuccessFully'),
  },
}));

// PrinterNativeModule.test.ts dùng requireActual để test bản THẬT — cần
// NativeModules.ThermalPrinterModule tồn tại vì RN jest preset không có.
{
  const { NativeModules } = require('react-native');
  NativeModules.ThermalPrinterModule = {
    ...NativeModules.ThermalPrinterModule,
    connect: jest.fn().mockResolvedValue(undefined),
    writeByBase64: jest.fn().mockResolvedValue('ok'),
  };
}
```

- [ ] **Step 6: Run the full test suite and type-check**

```bash
cd NDTCore.App
npm run type-check
npm test
```

Expected: all green. In particular `NativeAdapter.test.ts`, `UsbTransport.test.ts`, `EscPosDriver.test.ts` and anything else that transitively imports the printer feature should be unaffected, since they only ever referenced the four kept methods.

- [ ] **Step 7: Commit**

```bash
git add NDTCore.App/src/features/printer/adapters/native/PrinterNativeModule.ts \
        NDTCore.App/src/features/printer/adapters/native/__tests__/PrinterNativeModule.test.ts \
        NDTCore.App/src/features/printer/adapters/testing/MockPrinterAdapter.ts \
        NDTCore.App/src/features/printer/adapters/testing/__tests__/MockPrinterAdapter.test.ts \
        NDTCore.App/jest.setup.js
git commit -m "$(cat <<'EOF'
refactor: drop unused ThermalPrinterModule.ts exports

reconnect/getPrinterInfo/getPrinterCapabilities/getConnectionState/
cancelPrintJob/getQueueStatus were exported but never called anywhere
outside their own tests/mocks, and the native module (this branch)
implements only discoverPrinters/connect/disconnect/writeByBase64.
Keeping the unused exports would leave a TS method that throws
"is not a function" if anyone ever called it — the exact bug this
refactor fixes, just for a narrower set of methods.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Manual verification on a real device

There is no Java/Android unit test harness in this project (confirmed: no `android/app/src/test`, no test config in `build.gradle`), and `NDTCore.App/CLAUDE.md` explicitly says native/device-facing code is verified via build + manual device testing, not per-file unit tests. This task is the equivalent of the plan's "make it pass" step for everything built in Tasks 1–5.

**Files:** none (verification only).

- [ ] **Step 1: Build and install the debug APK**

```bash
cd NDTCore.App
npm run android
```

If `adb`/`gradlew.bat` aren't recognized, follow the environment setup notes in `NDTCore.App/CLAUDE.md` (JAVA_HOME, platform-tools on PATH) before retrying.

- [ ] **Step 2: USB — first-time permission grant**

With a USB thermal printer attached (or a USB device Android recognizes) and never previously granted: open the app's "Thêm máy in" flow for a USB printer, trigger connect, and confirm the Android system permission dialog appears and that tapping "Allow" completes the connect successfully (no `PERMISSION_DENIED` reject, no hang past ~30s).

- [ ] **Step 3: USB — permission denied**

Repeat with a different/re-paired USB device and tap "Deny" on the dialog. Confirm the app surfaces a connection failure (not a hang, not a crash) and that a retry re-prompts rather than silently failing forever.

- [ ] **Step 4: USB — already-granted device**

Connect a USB device that already has permission (e.g. reconnect after Step 2). Confirm it connects immediately with no dialog.

- [ ] **Step 5: USB — print**

With a USB printer connected, run the app's test-print / real print flow (ESC/POS and, if available, TSPL/USB) and confirm output actually prints and `disconnect` afterward doesn't error.

- [ ] **Step 6: Bluetooth — discovery, connect, print, disconnect**

With a Bluetooth thermal printer already paired in Android system Bluetooth settings: confirm it shows up in the app's device list (`discoverPrinters('bluetooth')`), connects, prints (ESC/POS via `NativeAdapter`), and disconnects cleanly. Also confirm a *second* connect to the same already-open Bluetooth printer (e.g. reopening the add-printer flow without disconnecting first) reuses the connection instead of erroring.

- [ ] **Step 7: LAN — connect and print**

With a LAN/network thermal printer (or a TCP listener standing in for one) at a known host:port: confirm connect, ESC/POS print via `NativeAdapter`, and disconnect all work. (TSPL/LAN continues to go through `LibraryAdapter`, unaffected by this refactor — no need to test that path here.)

- [ ] **Step 8: Physical USB detach mid-session**

While a USB printer is connected, physically unplug it. Confirm the app doesn't crash and correctly reflects a disconnected state on the next status check/print attempt (this exercises `UsbPermission`'s detach `BroadcastReceiver` → `UsbConnection.close()` wiring from Task 4).

- [ ] **Step 9: Report results**

Summarize pass/fail for each step above. If any step fails, treat it as a bug in the corresponding task (2/3/4/5) and fix there rather than patching around it here.
