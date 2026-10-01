package com.ndtcorepos.device.connection;

import static com.ndtcorepos.device.connection.Futures.await;
import static com.ndtcorepos.device.connection.Futures.awaitLatch;
import static com.ndtcorepos.device.connection.Futures.failureOf;
import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class ConnectionTest {

    private static final long LONG_TIMEOUT_MS = 10_000;

    private static final long SHORT_TIMEOUT_MS = 100;

    private static final long QUEUE_DELAY_MS = 300;

    private final FakeTransport transport =
            new FakeTransport("10.0.0.1:9100", null, Collections.synchronizedList(new ArrayList<>()));

    private final AtomicInteger transportLostCount = new AtomicInteger();

    private Connection connection;

    @Before
    public void setUp() throws Exception {
        transport.open();
        connection = new Connection(
                "lan:10.0.0.1:9100",
                transport,
                Executors.newSingleThreadExecutor(),
                lost -> transportLostCount.incrementAndGet());
    }

    @Test
    public void writesRunInCallOrder() throws Exception {
        CompletableFuture<Void> first = connection.write(new byte[] {1}, LONG_TIMEOUT_MS);
        CompletableFuture<Void> second = connection.write(new byte[] {2}, LONG_TIMEOUT_MS);
        CompletableFuture<Void> third = connection.write(new byte[] {3}, LONG_TIMEOUT_MS);
        await(CompletableFuture.allOf(first, second, third));

        assertEquals(3, transport.writes.size());
        assertArrayEquals(new byte[] {1}, transport.writes.get(0));
        assertArrayEquals(new byte[] {2}, transport.writes.get(1));
        assertArrayEquals(new byte[] {3}, transport.writes.get(2));
    }

    @Test
    public void deadlineCountsFromWhenOperationStartsNotWhenQueued() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        transport.writeGate = gate;
        CompletableFuture<Void> first = connection.write(new byte[] {1}, LONG_TIMEOUT_MS);
        awaitLatch(transport.writeEntered);

        long queuedAt = System.nanoTime();
        CompletableFuture<Void> second = connection.write(new byte[] {2}, SHORT_TIMEOUT_MS);
        Thread.sleep(QUEUE_DELAY_MS);
        gate.countDown();
        await(CompletableFuture.allOf(first, second));

        long secondDeadline = transport.writeDeadlines.get(1);
        assertTrue(secondDeadline >= queuedAt + TimeUnit.MILLISECONDS.toNanos(QUEUE_DELAY_MS + SHORT_TIMEOUT_MS));
    }

    @Test
    public void closeWaitsForQueuedOperations() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        transport.writeGate = gate;
        CompletableFuture<Void> write = connection.write(new byte[] {1}, LONG_TIMEOUT_MS);
        awaitLatch(transport.writeEntered);

        CompletableFuture<Void> close = connection.close();
        Thread.sleep(SHORT_TIMEOUT_MS);
        assertFalse(close.isDone());
        assertTrue(transport.isOpen());

        gate.countDown();
        await(close);
        await(write);
        assertFalse(transport.isOpen());
        assertEquals(1, transport.closeCount.get());
        assertEquals(0, transport.abortCount.get());
    }

    @Test
    public void operationAfterCloseIsNotConnected() throws Exception {
        await(connection.close());

        DeviceException failure = failureOf(connection.write(new byte[] {1}, LONG_TIMEOUT_MS));

        assertEquals(DeviceErrorCode.NOT_CONNECTED, failure.errorCode());
    }

    @Test
    public void abortEndsRunningAndWaitingOperationsWithConnectionLost() throws Exception {
        transport.writeGate = new CountDownLatch(1);
        transport.bytesSentBeforeClose = 7;
        CompletableFuture<Void> running = connection.write(new byte[10], LONG_TIMEOUT_MS);
        awaitLatch(transport.writeEntered);
        CompletableFuture<Void> waiting = connection.write(new byte[] {2}, LONG_TIMEOUT_MS);

        connection.abort();

        DeviceException runningFailure = failureOf(running);
        assertEquals(DeviceErrorCode.CONNECTION_LOST, runningFailure.errorCode());
        assertEquals(7, runningFailure.bytesWritten());
        assertEquals(DeviceErrorCode.CONNECTION_LOST, failureOf(waiting).errorCode());
        assertEquals(0, transportLostCount.get());
        assertEquals(1, transport.abortCount.get());
        assertEquals(0, transport.closeCount.get());
    }

    @Test
    public void failureThatLeavesTransportClosedReportsTransportLost() throws Exception {
        transport.nextWriteFailure = new DeviceException(DeviceErrorCode.WRITE_TIMEOUT, "hết hạn").withBytesWritten(3);
        transport.closeOnWriteFailure = true;

        DeviceException failure = failureOf(connection.write(new byte[10], LONG_TIMEOUT_MS));

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(3, failure.bytesWritten());
        assertEquals(1, transportLostCount.get());
    }

    @Test
    public void timeoutWithTransportStillOpenKeepsConnection() throws Exception {
        transport.nextWriteFailure = new DeviceException(DeviceErrorCode.WRITE_TIMEOUT, "hết hạn");

        DeviceException failure = failureOf(connection.write(new byte[10], LONG_TIMEOUT_MS));

        assertEquals(DeviceErrorCode.WRITE_TIMEOUT, failure.errorCode());
        assertEquals(0, transportLostCount.get());
        assertTrue(connection.isAlive());
        await(connection.write(new byte[] {1}, LONG_TIMEOUT_MS));
    }

    @Test
    public void abortDuringCloseCompletesCloseNormally() throws Exception {
        transport.writeGate = new CountDownLatch(1);
        connection.write(new byte[] {1}, LONG_TIMEOUT_MS);
        awaitLatch(transport.writeEntered);
        CompletableFuture<Void> close = connection.close();

        connection.abort();

        assertNull(await(close));
        assertFalse(transport.isOpen());
        assertEquals(0, transport.closeCount.get());
    }

    @Test
    public void readReturnsAvailableBytesOrEmptyArray() throws Exception {
        transport.readResponses.add(new byte[] {1, 2});

        assertArrayEquals(new byte[] {1, 2}, await(connection.read(16, LONG_TIMEOUT_MS)));
        assertEquals(0, await(connection.read(16, SHORT_TIMEOUT_MS)).length);
    }
}