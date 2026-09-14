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
