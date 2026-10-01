package com.ndtcorepos.device.monitor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import androidx.core.content.ContextCompat;
import androidx.core.content.IntentCompat;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.model.DisconnectReason;

/** Báo `ConnectionPool` khi một thiết bị USB bị rút. */
public final class UsbDetachMonitor implements IDisconnectMonitor {

    private final Context context;

    private final ConnectionPool connectionPool;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context receiverContext, Intent intent) {
            onDetached(intent);
        }
    };

    private boolean started;

    public UsbDetachMonitor(Context context, ConnectionPool connectionPool) {
        this.context = context;
        this.connectionPool = connectionPool;
    }

    /** Đăng ký nhận broadcast rút USB của hệ thống, chỉ nhận trong app. */
    @Override
    public synchronized void start() {
        if (started) {
            return;
        }

        IntentFilter filter = new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED);
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        started = true;
    }

    @Override
    public synchronized void stop() {
        if (!started) {
            return;
        }

        context.unregisterReceiver(receiver);
        started = false;
    }

    /** Chạy trên luồng UI nên chỉ báo cho pool, việc đóng kết nối diễn ra ở luồng khác. */
    private void onDetached(Intent intent) {
        UsbDevice device = IntentCompat.getParcelableExtra(intent, UsbManager.EXTRA_DEVICE, UsbDevice.class);

        if (device != null) {
            connectionPool.onHardwareLost(device.getDeviceName(), DisconnectReason.USB_DETACHED);
        }
    }
}
