package com.ndtcorepos.device.monitor;

import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import androidx.core.content.ContextCompat;
import androidx.core.content.IntentCompat;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.enums.DisconnectReason;

/** Báo `ConnectionPool` khi kết nối Bluetooth tới một thiết bị mất (ra khỏi tầm sóng, tắt máy in). */
public final class BluetoothDisconnectMonitor implements IDisconnectMonitor {

    private final Context context;

    private final ConnectionPool connectionPool;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context receiverContext, Intent intent) {
            onDisconnected(intent);
        }
    };

    private boolean started;

    public BluetoothDisconnectMonitor(Context context, ConnectionPool connectionPool) {
        this.context = context;
        this.connectionPool = connectionPool;
    }

    /** Đăng ký nhận broadcast mất liên kết ACL của hệ thống, chỉ nhận trong app. */
    @Override
    public synchronized void start() {
        if (started) {
            return;
        }

        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_ACL_DISCONNECTED);
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
    private void onDisconnected(Intent intent) {
        BluetoothDevice device = IntentCompat.getParcelableExtra(
                intent,
                BluetoothDevice.EXTRA_DEVICE,
                BluetoothDevice.class);

        if (device != null) {
            connectionPool.onHardwareLost(device.getAddress(), DisconnectReason.BLUETOOTH_DISCONNECTED);
        }
    }
}
