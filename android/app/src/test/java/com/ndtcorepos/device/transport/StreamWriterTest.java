package com.ndtcorepos.device.transport;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.Closeable;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class StreamWriterTest {

    private static final long LONG_DEADLINE_MS = 5_000;

    private static final long SHORT_DEADLINE_MS = 200;

    private static final long AFTER_DEADLINE_MS = 400;

    private static final int NEVER = -1;

    /** Stream giả ghi lại kích thước từng khúc; có thể chặn ở một khúc tới khi bị đóng, hoặc lỗi ở một khúc. */
    private static final class RecordingStream extends OutputStream implements Closeable {

        private final List<Integer> chunkSizes = new CopyOnWriteArrayList<>();

        private volatile int blockAtChunk = NEVER;

        private volatile int failAtChunk = NEVER;

        private volatile boolean closed;

        @Override
        public void write(int value) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void write(
                byte[] buffer,
                int offset,
                int length) throws IOException {
            int chunkIndex = chunkSizes.size();
            waitWhileBlocked(chunkIndex);

            if (closed || chunkIndex == failAtChunk) {
                throw new IOException("stream lỗi");
            }

            chunkSizes.add(length);
        }

        @Override
        public void close() {
            closed = true;
        }

        private void waitWhileBlocked(int chunkIndex) {
            while (chunkIndex == blockAtChunk && !closed) {
                Thread.yield();
            }
        }
    }

    private final RecordingStream stream = new RecordingStream();

    private ScheduledExecutorService timer;

    @Before
    public void setUp() {
        timer = Executors.newSingleThreadScheduledExecutor();
    }

    @After
    public void tearDown() {
        timer.shutdownNow();
    }

    @Test
    public void writesInChunksOfFourKilobytes() throws Exception {
        StreamWriter.writeAll(stream, stream, new byte[10_000], deadlineIn(LONG_DEADLINE_MS), timer);

        assertEquals(Arrays.asList(4_096, 4_096, 1_808), stream.chunkSizes);
    }

    @Test
    public void deadlineClosesConnectionAndReportsBytesSent() {
        stream.blockAtChunk = 1;

        DeviceException failure = writeExpectingFailure(new byte[10_000], deadlineIn(SHORT_DEADLINE_MS));

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(4_096, failure.bytesWritten());
        assertTrue(stream.closed);
    }

    @Test
    public void finishedWriteIsNeverReportedAsTimeout() throws Exception {
        StreamWriter.writeAll(stream, stream, new byte[100], deadlineIn(SHORT_DEADLINE_MS), timer);
        Thread.sleep(AFTER_DEADLINE_MS);

        assertFalse(stream.closed);
    }

    @Test
    public void ioErrorIsWriteFailedWithBytesSent() {
        stream.failAtChunk = 2;

        DeviceException failure = writeExpectingFailure(new byte[10_000], deadlineIn(LONG_DEADLINE_MS));

        assertEquals(DeviceErrorCode.WRITE_FAILED, failure.errorCode());
        assertEquals(8_192, failure.bytesWritten());
    }

    @Test
    public void expiredDeadlineTimesOutBeforeAnyByte() {
        stream.blockAtChunk = 0;

        DeviceException failure = writeExpectingFailure(new byte[10], System.nanoTime() - 1);

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(0, failure.bytesWritten());
    }

    private DeviceException writeExpectingFailure(byte[] data, long deadlineNanos) {
        try {
            StreamWriter.writeAll(stream, stream, data, deadlineNanos, timer);
        } catch (DeviceException exception) {
            return exception;
        }

        fail("Mong đợi lỗi khi ghi");
        return null;
    }

    private static long deadlineIn(long millis) {
        return System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(millis);
    }
}
