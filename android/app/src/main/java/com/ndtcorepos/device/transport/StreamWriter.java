package com.ndtcorepos.device.transport;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import java.io.Closeable;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Ghi vào một stream không có timeout ghi (socket Bluetooth/TCP) theo khúc, đúng hạn và đếm số byte của các khúc đã
 * ghi xong (`write` + `flush` trả về; không bảo đảm máy in đã nhận). Quá hạn thì đóng kết nối để cắt lần ghi đang kẹt.
 */
public final class StreamWriter {

    private static final int STREAM_CHUNK_SIZE_BYTES = 4_096;

    /** Tiến độ một lần ghi; trạng thái đổi bằng compare-and-set để "ghi xong" và "hết hạn" chỉ một bên thắng. */
    private static final class WriteProgress {

        private static final int RUNNING = 0;

        private static final int FINISHED = 1;

        private static final int TIMED_OUT = 2;

        private final AtomicInteger state = new AtomicInteger(RUNNING);

        private volatile int bytesWritten;

        private boolean markFinished() {
            return state.compareAndSet(RUNNING, FINISHED);
        }

        private boolean markTimedOut() {
            return state.compareAndSet(RUNNING, TIMED_OUT);
        }
    }

    private StreamWriter() {
    }

    public static void writeAll(
            OutputStream stream,
            Closeable connection,
            byte[] data,
            long deadlineNanos,
            ScheduledExecutorService timer) throws DeviceException {
        WriteProgress progress = new WriteProgress();
        long delayNanos = Math.max(0, deadlineNanos - System.nanoTime());
        ScheduledFuture<?> alarm = timer.schedule(
                () -> closeOnTimeout(progress, connection),
                delayNanos,
                TimeUnit.NANOSECONDS);

        try {
            writeChunks(stream, data, progress);
        } catch (IOException exception) {
            throw failure(progress, exception);
        } finally {
            alarm.cancel(false);
        }

        if (!progress.markFinished()) {
            throw timeout(progress);
        }
    }

    private static void writeChunks(
            OutputStream stream,
            byte[] data,
            WriteProgress progress) throws IOException {
        for (int offset = 0; offset < data.length; offset += STREAM_CHUNK_SIZE_BYTES) {
            int length = Math.min(STREAM_CHUNK_SIZE_BYTES, data.length - offset);
            stream.write(data, offset, length);
            stream.flush();
            progress.bytesWritten += length;
        }
    }

    private static void closeOnTimeout(WriteProgress progress, Closeable connection) {
        if (!progress.markTimedOut()) {
            return;
        }

        try {
            connection.close();
        } catch (IOException ignored) {
            // Đóng để cắt lần ghi đang kẹt; đóng lỗi thì lần ghi vẫn kết thúc khi hệ điều hành huỷ socket.
        }
    }

    private static DeviceException failure(WriteProgress progress, IOException cause) {
        if (!progress.markFinished()) {
            return timeout(progress);
        }

        return new DeviceException(DeviceErrorCode.WRITE_FAILED, "Ghi thất bại", cause)
                .withBytesWritten(progress.bytesWritten);
    }

    private static DeviceException timeout(WriteProgress progress) {
        return new DeviceException(DeviceErrorCode.WRITE_TIMEOUT, "Hết hạn khi đang ghi")
                .withBytesWritten(progress.bytesWritten);
    }
}
