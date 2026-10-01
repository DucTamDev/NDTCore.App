package com.ndtcorepos.device.transport;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

public class UsbTransportTest {

    private static final long LONG_DEADLINE_MS = 5_000;

    private static final long SHORT_DEADLINE_MS = 50;

    private static final long SLOW_TRANSFER_MS = 100;

    private static final int PARTIAL_TRANSFER_BYTES = 1_000;

    private final List<Integer> chunkLengths = new ArrayList<>();

    @Test
    public void splitsIntoSixteenKilobyteChunks() throws Exception {
        UsbTransport.writeInChunks(new byte[40_960], deadlineIn(LONG_DEADLINE_MS), this::acceptAll);

        assertEquals(Arrays.asList(16_384, 16_384, 8_192), chunkLengths);
    }

    @Test
    public void continuesAfterPartialTransfers() throws Exception {
        UsbTransport.writeInChunks(new byte[5_000], deadlineIn(LONG_DEADLINE_MS), this::acceptPartially);

        assertEquals(5, chunkLengths.size());
    }

    @Test
    public void failedTransferAfterDeadlineIsTimeoutWithBytesWritten() {
        DeviceException failure = writeExpectingFailure(deadlineIn(SHORT_DEADLINE_MS), this::failSecondChunkSlowly);

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(16_384, failure.bytesWritten());
    }

    @Test
    public void failedTransferBeforeDeadlineIsWriteFailed() {
        DeviceException failure = writeExpectingFailure(deadlineIn(LONG_DEADLINE_MS), this::failSecondChunk);

        assertEquals(DeviceErrorCode.WRITE_FAILED, failure.errorCode());
        assertEquals(16_384, failure.bytesWritten());
    }

    @Test
    public void expiredDeadlineTimesOutWithoutTransferring() {
        DeviceException failure = writeExpectingFailure(System.nanoTime() - 1, this::acceptAll);

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(0, failure.bytesWritten());
        assertTrue(chunkLengths.isEmpty());
    }

    private int acceptAll(
            byte[] buffer,
            int offset,
            int length,
            int timeoutMillis) {
        chunkLengths.add(length);
        return length;
    }

    private int acceptPartially(
            byte[] buffer,
            int offset,
            int length,
            int timeoutMillis) {
        chunkLengths.add(length);
        return Math.min(length, PARTIAL_TRANSFER_BYTES);
    }

    private int failSecondChunk(
            byte[] buffer,
            int offset,
            int length,
            int timeoutMillis) {
        chunkLengths.add(length);
        return chunkLengths.size() == 1 ? length : -1;
    }

    private int failSecondChunkSlowly(
            byte[] buffer,
            int offset,
            int length,
            int timeoutMillis) {
        if (chunkLengths.size() == 1) {
            sleepQuietly(SLOW_TRANSFER_MS);
        }

        return failSecondChunk(buffer, offset, length, timeoutMillis);
    }

    private DeviceException writeExpectingFailure(long deadlineNanos, UsbTransport.IChunkWriter chunkWriter) {
        try {
            UsbTransport.writeInChunks(new byte[40_960], deadlineNanos, chunkWriter);
        } catch (DeviceException exception) {
            return exception;
        }

        fail("Mong đợi lỗi khi ghi");
        return null;
    }

    private static long deadlineIn(long millis) {
        return System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(millis);
    }

    private static void sleepQuietly(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
