package com.ndtcorepos.thermalprinter.transport.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Quản lý vòng đời socket RFCOMM Bluetooth.
 */
public final class BluetoothConnection implements PrinterConnection {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

    private final String address;
    private BluetoothSocket socket;
    private int pendingDrainBytes = -1;

    public BluetoothConnection(String address) {
        this.address = address;
    }

    /**
     * Mở socket RFCOMM tới địa chỉ Bluetooth đã cấu hình.
     */
    @Override
    public CompletableFuture<PrinterResult> open() {
        long startedAt = System.currentTimeMillis();
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.CONNECTION_FAILED, "No bluetooth adapter available"));
        }
        if (!adapter.isEnabled()) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.CONNECTION_FAILED, "Bluetooth is not enabled"));
        }

        BluetoothDevice bondedDevice = findBondedDevice(adapter);
        if (bondedDevice == null) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.BLUETOOTH_DEVICE_NOT_FOUND,
                    "Can not find the specified printing device, please pair it in system Bluetooth settings first."));
        }

        closeQuietly();
        try {
            this.socket = openSocket(bondedDevice);
        } catch (IOException e) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.BLUETOOTH_CONNECTION_FAILED,
                    "Failed to connect bluetooth printer: " + e.getMessage(), e));
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    private BluetoothDevice findBondedDevice(BluetoothAdapter adapter) {
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        for (BluetoothDevice candidate : bonded) {
            if (candidate.getAddress().equals(address)) {
                return candidate;
            }
        }
        return null;
    }

    private BluetoothSocket openSocket(BluetoothDevice target) throws IOException {
        BluetoothSocket newSocket = target.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            newSocket.connect();
            return newSocket;
        } catch (IOException e) {
            try {
                newSocket.close();
            } catch (IOException ignored) {
            }
            BluetoothSocket retrySocket = target.createRfcommSocketToServiceRecord(SPP_UUID);
            retrySocket.connect();
            return retrySocket;
        }
    }

    OutputStream getOutputStream() throws IOException {
        return socket.getOutputStream();
    }

    void markPendingDrain(int bytes) {
        this.pendingDrainBytes = bytes;
    }

    private void closeQuietly() {
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }
    }

    /**
     * Đóng socket Bluetooth.
     *
     * <p>Nếu vừa ghi xong (pendingDrainBytes >= 0), chờ 1 khoảng thời gian
     * tỷ lệ số byte trước khi đóng — đóng ngay sau khi ghi có thể cắt dữ
     * liệu chưa kịp truyền hết qua RFCOMM.</p>
     */
    @Override
    public CompletableFuture<PrinterResult> close() {
        long startedAt = System.currentTimeMillis();
        if (socket != null && pendingDrainBytes >= 0) {
            sleepForDrain(pendingDrainBytes);
            pendingDrainBytes = -1;
        }
        closeQuietly();
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    private void sleepForDrain(int bytes) {
        try {
            Thread.sleep(bytes <= 2000 ? 100 : bytes / 5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Socket có đang kết nối không.
     */
    @Override
    public boolean isOpen() {
        return socket != null && socket.isConnected();
    }
}
