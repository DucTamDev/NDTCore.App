package com.ndtcorepos.thermalprinter.connection.bluetooth;

import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;

import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * Watches connected Bluetooth printers for ACL disconnect and reports it back
 * to the caller by ConnectionIdentity.
 *
 * Owns its own BroadcastReceiver — unlike USB, there is no existing
 * detach-listening mechanism to extend.
 */
public final class BluetoothConnectionWatcher {

    private static final String LOG_SOURCE = "BluetoothConnectionWatcher";

    private final ReactApplicationContext context;
    private final Consumer<ConnectionIdentity> onConnectionLost;

    /** Listeners registered per bonded device address. */
    private final Map<String, Set<Runnable>> disconnectListeners = new ConcurrentHashMap<>();

    /** address a watched identity was registered under, so unwatch() needs only the identity. */
    private final Map<ConnectionIdentity, String> watchedAddresses = new ConcurrentHashMap<>();

    /** The exact listener instance registered per identity, so unwatch() removes only this listener. */
    private final Map<ConnectionIdentity, Runnable> listeners = new ConcurrentHashMap<>();

    /**
     * The epoch each identity was most recently watch()ed under. A listener
     * only fires onConnectionLost if its own captured epoch still matches
     * this map's current value for that identity — otherwise the event is
     * stale (the identity was unwatched and/or re-watched since this
     * listener was registered, e.g. a disconnect() immediately followed by a
     * reconnect racing a delayed ACL_DISCONNECTED broadcast for the OLD
     * socket, which closing that socket is itself what triggers) and is
     * silently ignored instead of tearing down a connection that is no
     * longer the one this listener was registered for.
     */
    private final Map<ConnectionIdentity, Long> epochs = new ConcurrentHashMap<>();
    private final AtomicLong nextEpoch = new AtomicLong();

    public BluetoothConnectionWatcher(ReactApplicationContext context, Consumer<ConnectionIdentity> onConnectionLost) {
        this.context = context;
        this.onConnectionLost = onConnectionLost;
    }

    public void register() {
        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_ACL_DISCONNECTED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
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

        long epoch = nextEpoch.incrementAndGet();
        epochs.put(identity, epoch);

        Runnable listener = () -> {
            if (Objects.equals(epochs.get(identity), epoch)) {
                onConnectionLost.accept(identity);
            }
        };

        watchedAddresses.put(identity, address);
        listeners.put(identity, listener);

        disconnectListeners
                .computeIfAbsent(address, key -> ConcurrentHashMap.newKeySet())
                .add(listener);
    }

    /** Stops watching a device — call before intentionally disconnecting it. */
    public void unwatch(ConnectionIdentity identity) {
        epochs.remove(identity);

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
                try {
                    listener.run();
                } catch (Exception exception) {
                    Log.w(LOG_SOURCE, "Disconnect listener threw", exception);
                }
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
