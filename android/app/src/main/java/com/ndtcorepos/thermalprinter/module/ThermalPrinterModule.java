package com.ndtcorepos.thermalprinter.module;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.ndtcorepos.thermalprinter.connection.bluetooth.BluetoothConnection;
import com.ndtcorepos.thermalprinter.connection.bluetooth.BluetoothConnectionWatcher;
import com.ndtcorepos.thermalprinter.connection.net.NetConnection;
import com.ndtcorepos.thermalprinter.connection.usb.UsbConnection;
import com.ndtcorepos.thermalprinter.connection.usb.UsbConnectionWatcher;
import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.device.PrinterDeviceManager;
import com.ndtcorepos.thermalprinter.device.PrinterDeviceRegistry;
import com.ndtcorepos.thermalprinter.device.bluetooth.BluetoothPrinterDevice;
import com.ndtcorepos.thermalprinter.device.net.NetworkPrinterDevice;
import com.ndtcorepos.thermalprinter.device.usb.UsbPrinterDevice;
import com.ndtcorepos.thermalprinter.discovery.bluetooth.BluetoothPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
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
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

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

    private static final String LOG_SOURCE = "ThermalPrinterModule";

    /**
     * Upper bound on how long the bridge thread waits for a queued write —
     * without it a stalled transport (dead socket, unresponsive printer)
     * blocks every subsequent native-module call behind it forever.
     */
    private static final int WRITE_TIMEOUT_SECONDS = 15;

    private final UsbManager usbManager;

    private final UsbPrinterDiscovery usbDiscovery;
    private final BluetoothPrinterDiscovery bluetoothDiscovery;
    private final UsbConnectionIdentityResolver usbIdentityResolver;
    private final UsbEndpointResolver usbEndpointResolver;
    private final UsbPermission usbPermission;
    private final UsbConnectionWatcher usbConnectionWatcher;
    private final BluetoothConnectionWatcher bluetoothConnectionWatcher;

    private final PrinterDeviceManager deviceManager;
    private final PrinterQueueManager queueManager;

    /**
     * Runs the teardown half of onConnectionLost off the caller's thread — it
     * arrives on a BroadcastReceiver callback (the main/UI thread), and
     * closing a Bluetooth connection can block for seconds draining its
     * buffer, which would be an ANR there.
     */
    private final ExecutorService connectionLostExecutor = Executors.newSingleThreadExecutor();

    /** Maps a caller-assigned printerId to the physical connection currently backing it. */
    private final Map<String, ConnectionIdentity> connectedPrinters = new HashMap<>();

    public ThermalPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);

        this.usbManager = (UsbManager) reactContext.getSystemService(Context.USB_SERVICE);

        this.usbEndpointResolver = new UsbEndpointResolver();

        this.usbDiscovery = new UsbPrinterDiscovery(reactContext, usbEndpointResolver);
        this.bluetoothDiscovery = new BluetoothPrinterDiscovery();
        this.usbIdentityResolver = new UsbConnectionIdentityResolver();

        this.usbPermission = new UsbPermission(reactContext);
        this.usbPermission.register();
        this.usbConnectionWatcher = new UsbConnectionWatcher(usbPermission, this::onConnectionLost);
        this.bluetoothConnectionWatcher = new BluetoothConnectionWatcher(reactContext, this::onConnectionLost);
        this.bluetoothConnectionWatcher.register();

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

            UsbDevice usbDevice = type == ConnectionType.USB
                    ? findUsbDevice(request.getInt("vendorId"), request.getInt("productId"))
                    : null;

            if (type == ConnectionType.USB && usbDevice == null) {
                promise.reject("CONNECT_FAILED", "Device not found");
                return;
            }

            ConnectionIdentity identity = resolveIdentity(type, request, usbDevice);

            IPrinterDevice device = deviceManager.get(identity);

            if (device != null && device.getState() != ConnectionState.CONNECTED) {
                // Registered but no longer actually connected (e.g. the
                // physical device was detached) — tear it down and rebuild
                // fresh rather than reporting a stale "already connected".
                // unwatch() first so the rebuild below re-registers a fresh
                // watcher listener instead of leaving the dead one live.
                if (type == ConnectionType.USB) {
                    usbConnectionWatcher.unwatch(identity);
                } else if (type == ConnectionType.BLUETOOTH) {
                    bluetoothConnectionWatcher.unwatch(identity);
                }

                teardownDevice(identity);
                device = null;
            }

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
        } catch (Exception exception) {
            promise.reject("CONNECT_FAILED", exception);
        }
    }

    /**
     * Resolves the physical connection identity for a connect request — cheap
     * enough to call before deciding whether a new device even needs building.
     *
     * @param usbDevice the already-located USB device for USB requests, null
     *                  for other transports — looked up once by connect() so
     *                  identity resolution and device creation cannot disagree
     *                  about which device they are talking to
     */
    private ConnectionIdentity resolveIdentity(ConnectionType type, ReadableMap request, UsbDevice usbDevice) {
        if (type == ConnectionType.USB) {
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
    private IPrinterDevice createDevice(ConnectionType type, ConnectionIdentity identity, ReadableMap request, UsbDevice usbDevice) {
        if (type == ConnectionType.USB) {
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

            PrinterWriteResult result;

            try {
                result = future.get(WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            } catch (TimeoutException timeoutException) {
                future.cancel(true);
                promise.reject("WRITE_FAILED", "Write timed out");
                return;
            }

            if (!result.isSuccess()) {
                promise.reject("WRITE_FAILED", result.getErrorCode().name());
                return;
            }

            promise.resolve("ok");
        } catch (Exception exception) {
            promise.reject("WRITE_FAILED", exception);
        }
    }

    /**
     * Closes a printer's connection and forgets its printerId mapping.
     *
     * The physical connection is only torn down once no other printerId still
     * maps to it — two printerIds can share one device (see connect()), and
     * disconnecting one must not break the other.
     */
    @ReactMethod
    public void disconnect(String printerId, Promise promise) {
        try {
            ConnectionIdentity identity = connectedPrinters.remove(printerId);

            if (identity == null) {
                promise.resolve(null);
                return;
            }

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

            teardownDevice(identity);

            promise.resolve(null);
        } catch (Exception exception) {
            promise.reject("DISCONNECT_FAILED", exception);
        }
    }

    /**
     * Releases every native resource this module holds — the USB broadcast
     * receiver, all open USB/Bluetooth/TCP connections, and the per-connection
     * queue executors. React Native calls this when the module is torn down
     * (notably on every dev reload), so without it each reload leaks them.
     */
    @Override
    public void invalidate() {
        usbPermission.unregister();
        bluetoothConnectionWatcher.unregister();
        connectionLostExecutor.shutdown();
        deviceManager.closeAll();
        queueManager.shutdown();
        super.invalidate();
    }

    /**
     * Removes and closes the runtime device for an identity — the shared
     * teardown sequence used by both an explicit disconnect() and an
     * unexpected onConnectionLost().
     */
    private void teardownDevice(ConnectionIdentity identity) {
        queueManager.remove(identity);

        IPrinterDevice device = deviceManager.remove(identity);

        if (device != null) {
            device.close();
        }
    }

    /**
     * Called by either watcher when a physical connection is lost outside an
     * explicit disconnect() call. Notifies JS first, then tears down the dead
     * connection's runtime state on a background thread — this runs on a
     * BroadcastReceiver callback (main/UI) thread, where the multi-second
     * drain inside a Bluetooth close() would be an ANR and would also delay
     * the event this feature exists to deliver. This method does not touch
     * connectedPrinters or resolve any printerId; that correlation is left
     * entirely to the TS side (see the design spec).
     */
    private void onConnectionLost(ConnectionIdentity identity) {
        emitConnectionLost(identity);
        connectionLostExecutor.execute(() -> teardownDevice(identity));
    }

    private void emitConnectionLost(ConnectionIdentity identity) {
        if (!getReactApplicationContext().hasActiveReactInstance()) {
            return;
        }

        try {
            WritableMap payload = Arguments.createMap();
            payload.putString("identity", identity.getValue());

            getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("ThermalPrinterConnectionLost", payload);
        } catch (Exception exception) {
            Log.w(LOG_SOURCE, "Failed to emit connection lost event", exception);
        }
    }

    private UsbDevice findUsbDevice(int vendorId, int productId) {
        for (UsbDevice candidate : usbManager.getDeviceList().values()) {
            if (candidate.getVendorId() == vendorId && candidate.getProductId() == productId) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Picks the interface that actually carries a bulk OUT endpoint — a
     * composite device's first endpoint-bearing interface may be an unrelated
     * HID/interrupt one, which would fail later with INVALID_ENDPOINT.
     */
    private UsbInterface findPrinterInterface(UsbDevice device) {
        for (int index = 0; index < device.getInterfaceCount(); index++) {
            UsbInterface usbInterface = device.getInterface(index);

            if (usbEndpointResolver.resolve(usbInterface) != null) {
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
