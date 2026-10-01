package com.ndtcorepos.device.transport;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Truyền byte qua Bluetooth cổ điển (RFCOMM, Serial Port Profile). */
public final class BluetoothTransport implements ITransport {

    private static final UUID SERIAL_PORT_PROFILE_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private static final long READ_POLL_INTERVAL_MS = 20;

    private static final long DRAIN_MIN_WAIT_MS = 100;

    private static final int DRAIN_SMALL_PAYLOAD_BYTES = 2_000;

    /** Tốc độ ước lượng máy in nhận dữ liệu qua SPP, dùng để chờ dữ liệu cuối kịp gửi trước khi đóng. */
    private static final int DRAIN_BYTES_PER_MS = 5;

    private final BluetoothDevice device;

    /** Hẹn giờ đóng socket khi lần ghi quá hạn. */
    private final ScheduledExecutorService timer;

    private volatile BluetoothSocket socket;

    private volatile int lastWriteSizeBytes;

    private volatile long lastWriteCompletedAtNanos;

    public BluetoothTransport(BluetoothDevice device, ScheduledExecutorService timer) {
        this.device = device;
        this.timer = timer;
    }

    /** Mở socket RFCOMM; lần đầu hay lỗi với một số máy in giá rẻ nên thử lại một lần. */
    @Override
    public void open() throws DeviceException {
        try {
            socket = connectWithRetry();
        } catch (SecurityException exception) {
            throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "Thiếu quyền Bluetooth", exception);
        } catch (IOException exception) {
            throw new DeviceException(DeviceErrorCode.CONNECTION_FAILED, "Không kết nối được Bluetooth", exception);
        }
    }

    @Override
    public void write(byte[] data, long deadlineNanos) throws DeviceException {
        BluetoothSocket current = requireSocket();

        try {
            StreamWriter.writeAll(current.getOutputStream(), current, data, deadlineNanos, timer);
            lastWriteSizeBytes = data.length;
            lastWriteCompletedAtNanos = System.nanoTime();
        } catch (IOException exception) {
            abort();
            throw new DeviceException(DeviceErrorCode.WRITE_FAILED, "Không ghi được Bluetooth", exception);
        }
    }

    /** BluetoothSocket không có timeout đọc nên hỏi số byte sẵn có theo chu kỳ tới khi có dữ liệu hoặc hết hạn. */
    @Override
    public byte[] read(int maxBytes, long deadlineNanos) throws DeviceException {
        BluetoothSocket current = requireSocket();

        try {
            InputStream input = current.getInputStream();

            if (!waitForData(input, deadlineNanos)) {
                return new byte[0];
            }

            byte[] buffer = new byte[Math.min(maxBytes, input.available())];
            int received = input.read(buffer);
            return received < 0 ? closedByPeer() : Arrays.copyOf(buffer, received);
        } catch (IOException exception) {
            abort();
            throw new DeviceException(DeviceErrorCode.READ_FAILED, "Không đọc được Bluetooth", exception);
        }
    }

    /**
     * `flush` không bảo đảm máy in đã nhận: một số máy in Bluetooth mất phần cuối nếu socket đóng ngay sau lần ghi,
     * nên chờ theo cỡ lần ghi gần nhất rồi mới đóng.
     */
    @Override
    public void close() {
        if (isOpen()) {
            sleepQuietly(drainWaitMillis(lastWriteSizeBytes, System.nanoTime() - lastWriteCompletedAtNanos));
        }

        abort();
    }

    @Override
    public void abort() {
        BluetoothSocket current = socket;
        socket = null;

        if (current != null) {
            closeQuietly(current);
        }
    }

    @Override
    public boolean isOpen() {
        BluetoothSocket current = socket;
        return current != null && current.isConnected();
    }

    @Override
    public String hardwareAddress() {
        return device.getAddress().toUpperCase(Locale.ROOT);
    }

    @Override
    public String serialNumber() {
        return null;
    }

    private BluetoothSocket connectWithRetry() throws IOException {
        try {
            return connectOnce();
        } catch (IOException firstFailure) {
            return connectOnce();
        }
    }

    private BluetoothSocket connectOnce() throws IOException {
        BluetoothSocket candidate = device.createRfcommSocketToServiceRecord(SERIAL_PORT_PROFILE_UUID);

        try {
            candidate.connect();
            return candidate;
        } catch (IOException exception) {
            closeQuietly(candidate);
            throw exception;
        }
    }

    /** Máy in đóng kết nối phía nó: đóng phía app để `isOpen()` phản ánh đúng rồi báo lỗi. */
    private byte[] closedByPeer() throws DeviceException {
        abort();
        throw new DeviceException(DeviceErrorCode.READ_FAILED, "Máy in đã đóng kết nối");
    }

    private BluetoothSocket requireSocket() throws DeviceException {
        BluetoothSocket current = socket;

        if (current == null) {
            throw new DeviceException(DeviceErrorCode.NOT_CONNECTED, "Bluetooth chưa mở");
        }

        return current;
    }

    private static boolean waitForData(InputStream input, long deadlineNanos) throws IOException {
        while (input.available() == 0) {
            if (System.nanoTime() - deadlineNanos >= 0) {
                return false;
            }

            sleepQuietly(READ_POLL_INTERVAL_MS);
        }

        return true;
    }

    /** Thời gian còn phải chờ để dữ liệu của lần ghi cuối kịp gửi: ước lượng theo cỡ trừ đi thời gian đã trôi qua. */
    static long drainWaitMillis(
            int lastWriteSizeBytes,
            long elapsedSinceWriteNanos) {
        if (lastWriteSizeBytes <= 0) {
            return 0;
        }

        long estimateMillis = lastWriteSizeBytes <= DRAIN_SMALL_PAYLOAD_BYTES
                ? DRAIN_MIN_WAIT_MS
                : lastWriteSizeBytes / DRAIN_BYTES_PER_MS;
        return Math.max(0, estimateMillis - TimeUnit.NANOSECONDS.toMillis(elapsedSinceWriteNanos));
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    private static void closeQuietly(BluetoothSocket target) {
        try {
            target.close();
        } catch (IOException ignored) {
            // Socket đang đóng dở; không còn việc gì để làm thêm.
        }
    }
}
