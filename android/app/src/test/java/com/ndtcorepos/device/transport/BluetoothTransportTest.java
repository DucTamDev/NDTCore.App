package com.ndtcorepos.device.transport;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.util.concurrent.TimeUnit;

public class BluetoothTransportTest {

    private static final long JUST_WRITTEN_NANOS = 0;

    private static final int SMALL_PAYLOAD_BYTES = 1_000;

    private static final int LARGE_PAYLOAD_BYTES = 100_000;

    private static final int NEVER_WRITTEN_BYTES = 0;

    @Test
    public void smallPayloadJustWrittenWaitsTheMinimum() {
        assertEquals(100, BluetoothTransport.drainWaitMillis(SMALL_PAYLOAD_BYTES, JUST_WRITTEN_NANOS));
    }

    @Test
    public void largePayloadJustWrittenWaitsByTransferRate() {
        assertEquals(20_000, BluetoothTransport.drainWaitMillis(LARGE_PAYLOAD_BYTES, JUST_WRITTEN_NANOS));
    }

    @Test
    public void elapsedTimeIsSubtractedFromTheEstimate() {
        long elapsedNanos = TimeUnit.MILLISECONDS.toNanos(15_000);

        assertEquals(5_000, BluetoothTransport.drainWaitMillis(LARGE_PAYLOAD_BYTES, elapsedNanos));
    }

    @Test
    public void elapsedBeyondTheEstimateWaitsNothing() {
        long elapsedNanos = TimeUnit.MILLISECONDS.toNanos(60_000);

        assertEquals(0, BluetoothTransport.drainWaitMillis(LARGE_PAYLOAD_BYTES, elapsedNanos));
    }

    @Test
    public void neverWrittenWaitsNothing() {
        assertEquals(0, BluetoothTransport.drainWaitMillis(NEVER_WRITTEN_BYTES, JUST_WRITTEN_NANOS));
    }
}
