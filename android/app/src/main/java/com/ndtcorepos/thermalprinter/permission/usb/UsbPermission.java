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

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
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

    public void register() {
        Intent intent = new Intent(ACTION_USB_PERMISSION);
        intent.setPackage(context.getPackageName());

        int flag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? PendingIntent.FLAG_MUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
        this.permissionIntent = PendingIntent.getBroadcast(context, 0, intent, flag);

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }

        Log.v(LOG_SOURCE, "receiver registered");
    }

    /**
     * Undoes register() — call when the owning native module is torn down so
     * the receiver registration does not leak across RN reloads.
     */
    public void unregister() {
        context.unregisterReceiver(receiver);
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

        Set<Consumer<Boolean>> listeners = permissionResultListeners.get(deviceKey(device.getVendorId(), device.getProductId()));

        if (listeners == null) {
            return;
        }

        for (Consumer<Boolean> listener : listeners) {
            try {
                listener.accept(granted);
            } catch (Exception exception) {
                Log.w(LOG_SOURCE, "Permission result listener threw", exception);
            }
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
            try {
                listener.run();
            } catch (Exception exception) {
                Log.w(LOG_SOURCE, "Device detach listener threw", exception);
            }
        }
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
