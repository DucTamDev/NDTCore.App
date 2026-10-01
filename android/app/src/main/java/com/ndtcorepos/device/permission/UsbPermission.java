package com.ndtcorepos.device.permission;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;

import androidx.core.content.ContextCompat;
import androidx.core.content.IntentCompat;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Hỏi người dùng cho phép app dùng một thiết bị USB và chờ câu trả lời. */
public final class UsbPermission {

    private static final String ACTION_USB_PERMISSION = "com.ndtcorepos.device.USB_PERMISSION";

    private static final long PERMISSION_TIMEOUT_MS = 30_000;

    private static final int PERMISSION_REQUEST_CODE = 0;

    private final Context context;

    private final UsbManager usbManager;

    public UsbPermission(Context context, UsbManager usbManager) {
        this.context = context;
        this.usbManager = usbManager;
    }

    public boolean hasPermission(UsbDevice device) {
        return usbManager.hasPermission(device);
    }

    /**
     * Hiện hộp thoại xin quyền USB của Android và chặn luồng gọi tới khi người dùng trả lời (tối đa 30 giây).
     * Rút thiết bị khi hộp thoại đang mở được coi là từ chối.
     */
    public void request(UsbDevice device) throws DeviceException {
        if (hasPermission(device)) {
            return;
        }

        CompletableFuture<Boolean> answer = new CompletableFuture<>();
        BroadcastReceiver receiver = createAnswerReceiver(device, answer);
        ContextCompat.registerReceiver(context, receiver, createAnswerFilter(), ContextCompat.RECEIVER_NOT_EXPORTED);

        try {
            usbManager.requestPermission(device, createPermissionIntent());

            if (!awaitAnswer(answer)) {
                throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "Không được cấp quyền USB");
            }
        } finally {
            context.unregisterReceiver(receiver);
        }
    }

    private static BroadcastReceiver createAnswerReceiver(UsbDevice device, CompletableFuture<Boolean> answer) {
        return new BroadcastReceiver() {
            @Override
            public void onReceive(Context receiverContext, Intent intent) {
                UsbDevice eventDevice = IntentCompat.getParcelableExtra(
                        intent,
                        UsbManager.EXTRA_DEVICE,
                        UsbDevice.class);

                if (eventDevice == null || !eventDevice.getDeviceName().equals(device.getDeviceName())) {
                    return;
                }

                answer.complete(isGranted(intent));
            }
        };
    }

    private static boolean isGranted(Intent intent) {
        if (!ACTION_USB_PERMISSION.equals(intent.getAction())) {
            return false;
        }

        return intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
    }

    private static IntentFilter createAnswerFilter() {
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        return filter;
    }

    /** Hệ thống gắn kết quả vào intent nên từ Android 12 PendingIntent phải mutable; intent gắn package của app. */
    private PendingIntent createPermissionIntent() {
        Intent intent = new Intent(ACTION_USB_PERMISSION).setPackage(context.getPackageName());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        return PendingIntent.getBroadcast(context, PERMISSION_REQUEST_CODE, intent, flags);
    }

    private static boolean awaitAnswer(CompletableFuture<Boolean> answer) {
        try {
            return answer.get(PERMISSION_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        } catch (ExecutionException | TimeoutException exception) {
            return false;
        }
    }
}
