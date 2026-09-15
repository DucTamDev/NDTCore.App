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
