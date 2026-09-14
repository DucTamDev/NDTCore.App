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
        unwatch(identity);

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
