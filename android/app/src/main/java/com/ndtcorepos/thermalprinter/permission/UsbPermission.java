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

/**
 * USB runtime permission (Android yêu cầu cấp quyền theo từng UsbDevice) +
 * phát hiện thiết bị bị rút qua BroadcastReceiver. Không biết gì về bulk
 * transfer — UsbPrinterTransport gọi vào đây để hỏi/xin quyền và nhận
 * callback khi thiết bị mất kết nối vật lý.
 */
public final class UsbPermission {

    private static final String TAG = "UsbPermission";
    private static final String ACTION_USB_PERMISSION = "com.ndtcorepos.thermalprinter.USB_PERMISSION";

    private final ReactApplicationContext context;
    private final UsbManager usbManager;
    private PendingIntent permissionIntent;
    private Runnable onDeviceDetached;

    public UsbPermission(ReactApplicationContext context) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    public void setOnDeviceDetached(Runnable listener) {
        this.onDeviceDetached = listener;
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
        Log.v(TAG, "USB permission receiver registered");
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
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                Log.v(TAG, "permission result granted=" + granted);
                if (!granted) {
                    Toast.makeText(ctx, "User refuses to obtain USB device permissions", Toast.LENGTH_LONG).show();
                }
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                Toast.makeText(ctx, "USB device has been turned off", Toast.LENGTH_LONG).show();
                if (onDeviceDetached != null) {
                    onDeviceDetached.run();
                }
            }
        }
    };
}
