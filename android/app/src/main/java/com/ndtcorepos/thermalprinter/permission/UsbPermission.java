package com.ndtcorepos.thermalprinter.permission;

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

/**
 * USB runtime permission (Android yêu cầu cấp quyền theo từng UsbDevice) +
 * phát hiện thiết bị bị rút qua BroadcastReceiver. Không biết gì về bulk
 * transfer — UsbPrinterTransport gọi vào đây để hỏi/xin quyền và nhận
 * callback khi thiết bị mất kết nối vật lý.
 */
public final class UsbPermission {

    private static final String LOG_SOURCE = "UsbPermission";
    private static final String ACTION_USB_PERMISSION = "com.ndtcorepos.thermalprinter.USB_PERMISSION";

    private final ReactApplicationContext context;
    private final UsbManager usbManager;
    private PendingIntent permissionIntent;
    private final Map<String, Runnable> deviceDetachListeners = new HashMap<>();

    public UsbPermission(ReactApplicationContext context) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    /**
     * Đăng ký callback rút thiết bị theo (vendorId, productId) — một
     * UsbPermission được nhiều UsbConnection dùng chung nên phải phân biệt
     * theo thiết bị thay vì một Runnable duy nhất.
     */
    public void registerDeviceDetachListener(int vendorId, int productId, Runnable listener) {
        deviceDetachListeners.put(deviceKey(vendorId, productId), listener);
    }

    /**
     * Gỡ callback rút thiết bị theo (vendorId, productId) — gọi khi
     * UsbConnection đóng chủ động để không giữ listener treo mãi.
     */
    public void unregisterDeviceDetachListener(int vendorId, int productId) {
        deviceDetachListeners.remove(deviceKey(vendorId, productId));
    }

    private static String deviceKey(int vendorId, int productId) {
        return vendorId + ":" + productId;
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

    private void handlePermissionResult(Context ctx, Intent intent) {
        boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
        Log.v(LOG_SOURCE, "permission result: granted=" + granted);

        if (granted) {
            return;
        }

        Toast.makeText(ctx, "User refuses to obtain USB device permissions", Toast.LENGTH_LONG).show();
    }

    /**
     * Có thể có nhiều UsbConnection cùng lúc (không còn chỉ 1 kết nối USB
     * active như trước) — phải đọc EXTRA_DEVICE để biết đúng thiết bị nào
     * vừa rút rồi chỉ gọi listener của thiết bị đó.
     */
    private void handleDeviceDetached(Context ctx, Intent intent) {
        Toast.makeText(ctx, "USB device has been turned off", Toast.LENGTH_LONG).show();

        UsbDevice device = getDetachedDevice(intent);

        if (device == null) {
            return;
        }

        int vendorId = device.getVendorId();
        int productId = device.getProductId();

        String key = deviceKey(vendorId, productId);
        Runnable listener = deviceDetachListeners.get(key);

        if (listener == null) {
            return;
        }

        listener.run();
    }

    @SuppressWarnings("deprecation")
    private static UsbDevice getDetachedDevice(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice.class);
        }
        return intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
    }
}
