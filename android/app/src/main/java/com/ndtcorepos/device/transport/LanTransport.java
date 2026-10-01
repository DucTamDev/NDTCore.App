package com.ndtcorepos.device.transport;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.Arrays;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Truyền byte qua TCP. */
public final class LanTransport implements ITransport {

    private static final int LAN_CONNECT_TIMEOUT_MS = 5_000;

    private final String host;

    private final int port;

    /** Hẹn giờ đóng socket khi lần ghi quá hạn (rút dây mạng thường không làm socket báo lỗi ngay). */
    private final ScheduledExecutorService timer;

    private volatile Socket socket;

    public LanTransport(
            String host,
            int port,
            ScheduledExecutorService timer) {
        this.host = host;
        this.port = port;
        this.timer = timer;
    }

    @Override
    public void open() throws DeviceException {
        Socket candidate = new Socket();

        try {
            candidate.connect(new InetSocketAddress(host, port), LAN_CONNECT_TIMEOUT_MS);
            socket = candidate;
        } catch (IOException exception) {
            closeQuietly(candidate);
            throw new DeviceException(
                    DeviceErrorCode.CONNECTION_FAILED,
                    "Không kết nối được " + hardwareAddress(),
                    exception);
        }
    }

    @Override
    public void write(byte[] data, long deadlineNanos) throws DeviceException {
        Socket current = requireSocket();

        try {
            StreamWriter.writeAll(current.getOutputStream(), current, data, deadlineNanos, timer);
        } catch (IOException exception) {
            abort();
            throw new DeviceException(DeviceErrorCode.WRITE_FAILED, "Không ghi được qua mạng", exception);
        }
    }

    /** Không phát hiện được máy in đã chết nếu hệ điều hành chưa báo lỗi hay EOF; khi đó chỉ hết hạn, trả mảng rỗng. */
    @Override
    public byte[] read(int maxBytes, long deadlineNanos) throws DeviceException {
        Socket current = requireSocket();
        long remainingMillis = TimeUnit.NANOSECONDS.toMillis(deadlineNanos - System.nanoTime());

        if (remainingMillis <= 0) {
            return new byte[0];
        }

        try {
            current.setSoTimeout((int) Math.min(Integer.MAX_VALUE, remainingMillis));
            byte[] buffer = new byte[maxBytes];
            int received = current.getInputStream().read(buffer);
            return received < 0 ? closedByPeer() : Arrays.copyOf(buffer, received);
        } catch (SocketTimeoutException exception) {
            return new byte[0];
        } catch (IOException exception) {
            abort();
            throw new DeviceException(DeviceErrorCode.READ_FAILED, "Không đọc được qua mạng", exception);
        }
    }

    /** TCP không giữ dữ liệu chờ gửi phía app sau `flush`, nên đóng bình thường cũng là đóng ngay. */
    @Override
    public void close() {
        abort();
    }

    @Override
    public void abort() {
        Socket current = socket;
        socket = null;

        if (current != null) {
            closeQuietly(current);
        }
    }

    @Override
    public boolean isOpen() {
        Socket current = socket;
        return current != null && current.isConnected() && !current.isClosed();
    }

    @Override
    public String hardwareAddress() {
        return host + ":" + port;
    }

    @Override
    public String serialNumber() {
        return null;
    }

    /** Máy in đóng kết nối phía nó: đóng phía app để `isOpen()` phản ánh đúng rồi báo lỗi. */
    private byte[] closedByPeer() throws DeviceException {
        abort();
        throw new DeviceException(DeviceErrorCode.READ_FAILED, "Máy in đã đóng kết nối");
    }

    private Socket requireSocket() throws DeviceException {
        Socket current = socket;

        if (current == null) {
            throw new DeviceException(DeviceErrorCode.NOT_CONNECTED, "Kết nối mạng chưa mở");
        }

        return current;
    }

    private static void closeQuietly(Socket target) {
        try {
            target.close();
        } catch (IOException ignored) {
            // Socket đang đóng dở; không còn việc gì để làm thêm.
        }
    }
}
