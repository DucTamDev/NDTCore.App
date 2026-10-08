package com.ndtcorepos.device.connection;

import static com.ndtcorepos.device.connection.Futures.await;
import static com.ndtcorepos.device.connection.Futures.awaitCondition;
import static com.ndtcorepos.device.connection.Futures.awaitLatch;
import static com.ndtcorepos.device.connection.Futures.failureOf;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import com.ndtcorepos.device.enums.DisconnectReason;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.ConnectedDevice;
import com.ndtcorepos.device.model.DeviceAddress;

import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class ConnectionPoolTest {

    private static final long TIMEOUT_MS = 10_000;

    private static final long SETTLE_MS = 100;

    private static final String USB_PATH = "/dev/bus/usb/001/004";

    private static final int RACE_ROUNDS = 100;

    private static final int WRITES_PER_ROUND = 20;

    /** `closeAll` phải ngắt việc chờ quyền ngay, không đợi hết thời gian chờ của bản giả. */
    private static final long INTERRUPT_DEADLINE_SECONDS = 2;

    private final FakeTransportFactory factory = new FakeTransportFactory();

    private final List<String> disconnectEvents = Collections.synchronizedList(new ArrayList<>());

    private ConnectionPool pool;

    private DeviceAddress printerA;

    private DeviceAddress printerB;

    @Before
    public void setUp() throws Exception {
        pool = new ConnectionPool(
                factory,
                (connectionId, reason) -> disconnectEvents.add(connectionId + "|" + reason.wireValue()),
                Executors.newCachedThreadPool(),
                Executors.newSingleThreadExecutor(),
                Executors::newSingleThreadExecutor);
        printerA = DeviceAddress.lan("10.0.0.1", 9100);
        printerB = DeviceAddress.lan("10.0.0.2", 9100);
    }

    @Test
    public void connectReturnsSessionIdAndDeviceReadAfterOpen() throws Exception {
        DeviceAddress requested = DeviceAddress.usb(1155, 22222, null, "/dev/bus/usb/001/004");
        factory.hardwareByLookupKey.put(requested.lookupKey(), "/dev/bus/usb/001/004");
        factory.openedAddress = DeviceAddress.usb(1155, 22222, "SN1", "/dev/bus/usb/001/004");
        factory.name = "XP-58";

        ConnectedDevice connected = await(pool.connect(requested));

        assertEquals("usb:/dev/bus/usb/001/004", connected.connectionId());
        assertEquals("usb:1155:22222:SN1", connected.deviceId());
        assertEquals("SN1", connected.address().serialNumber());
        assertEquals("XP-58", connected.name());
    }

    @Test
    public void concurrentConnectsToSameAddressOpenOnce() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        factory.createGate = gate;

        CompletableFuture<ConnectedDevice> first = pool.connect(printerA);
        CompletableFuture<ConnectedDevice> second = pool.connect(printerA);
        gate.countDown();

        assertSame(first, second);
        assertEquals("lan:10.0.0.1:9100", await(first).connectionId());
        assertEquals(1, factory.created.size());
        assertEquals(1, factory.transport(0).openCount.get());
    }

    @Test
    public void differentAddressesOfSameDeviceShareOneConnection() throws Exception {
        DeviceAddress bySerial = DeviceAddress.usb(1, 2, "SN", null);
        DeviceAddress byPath = DeviceAddress.usb(1, 2, null, USB_PATH);
        factory.hardwareByLookupKey.put(bySerial.lookupKey(), USB_PATH);
        factory.hardwareByLookupKey.put(byPath.lookupKey(), USB_PATH);

        String firstId = await(pool.connect(bySerial)).connectionId();
        String secondId = await(pool.connect(byPath)).connectionId();

        assertEquals("usb:" + USB_PATH, firstId);
        assertEquals(firstId, secondId);
        assertEquals(1, factory.transport(0).openCount.get());
        assertEquals(0, factory.transport(1).openCount.get());
        assertEquals(1, factory.transport(1).abortCount.get());
    }

    @Test
    public void concurrentDifferentAddressesOfSameDeviceOpenOnce() throws Exception {
        DeviceAddress bySerial = DeviceAddress.usb(1, 2, "SN", null);
        DeviceAddress byPath = DeviceAddress.usb(1, 2, null, USB_PATH);
        factory.hardwareByLookupKey.put(bySerial.lookupKey(), USB_PATH);
        factory.hardwareByLookupKey.put(byPath.lookupKey(), USB_PATH);
        CountDownLatch openGate = new CountDownLatch(1);
        factory.openGate = openGate;

        CompletableFuture<ConnectedDevice> first = pool.connect(bySerial);
        awaitCondition(() -> factory.created.size() == 1);
        awaitLatch(factory.transport(0).openEntered);
        CompletableFuture<ConnectedDevice> second = pool.connect(byPath);
        awaitCondition(() -> factory.created.size() == 2);
        Thread.sleep(SETTLE_MS);
        openGate.countDown();

        assertEquals(await(first).connectionId(), await(second).connectionId());
        assertEquals(1, factory.transport(0).openCount.get());
        assertEquals(0, factory.transport(1).openCount.get());
    }

    @Test
    public void deadConnectionIsReplacedWithoutDisconnectEvent() throws Exception {
        await(pool.connect(printerA));
        factory.transport(0).open = false;

        await(pool.connect(printerA));

        assertEquals(1, factory.transport(1).openCount.get());
        assertTrue(disconnectEvents.isEmpty());
    }

    @Test
    public void connectWhileClosingWaitsForCloseToFinish() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        CountDownLatch writeGate = new CountDownLatch(1);
        factory.transport(0).writeGate = writeGate;
        pool.write(connectionId, new byte[] {1}, TIMEOUT_MS);
        awaitLatch(factory.transport(0).writeEntered);

        CompletableFuture<Void> disconnect = pool.disconnect(connectionId);
        CompletableFuture<ConnectedDevice> reconnect = pool.connect(printerA);
        Thread.sleep(SETTLE_MS);
        assertFalse(reconnect.isDone());

        writeGate.countDown();
        await(disconnect);
        await(reconnect);
        List<String> events = new ArrayList<>(factory.events);
        assertTrue(events.indexOf("close:10.0.0.1:9100") < events.lastIndexOf("open:10.0.0.1:9100"));
    }

    @Test
    public void disconnectCallbackCanReconnectSameDevice() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        CountDownLatch writeGate = new CountDownLatch(1);
        factory.transport(0).writeGate = writeGate;
        pool.write(connectionId, new byte[] {1}, TIMEOUT_MS);
        awaitLatch(factory.transport(0).writeEntered);

        CompletableFuture<ConnectedDevice> reconnect = pool.disconnect(connectionId)
                .thenApply(ignored -> pool.connect(printerA).join());
        writeGate.countDown();

        assertEquals(connectionId, await(reconnect).connectionId());
        assertEquals(2, factory.created.size());
    }

    @Test
    public void writeToUnknownOrDisconnectedIdIsNotConnected() throws Exception {
        DeviceException unknownId = failureOf(pool.write("lan:x", new byte[1], TIMEOUT_MS));
        assertEquals(DeviceErrorCode.NOT_CONNECTED, unknownId.errorCode());

        String connectionId = await(pool.connect(printerA)).connectionId();
        await(pool.disconnect(connectionId));

        DeviceException failure = failureOf(pool.write(connectionId, new byte[1], TIMEOUT_MS));
        assertEquals(DeviceErrorCode.NOT_CONNECTED, failure.errorCode());
    }

    @Test
    public void disconnectUnknownIdResolves() throws Exception {
        await(pool.disconnect("lan:unknown"));
    }

    @Test
    public void disconnectWhileOpeningWaitsThenCloses() throws Exception {
        CountDownLatch openGate = new CountDownLatch(1);
        factory.openGate = openGate;
        CompletableFuture<ConnectedDevice> connect = pool.connect(printerA);
        awaitCondition(() -> factory.created.size() == 1);
        awaitLatch(factory.transport(0).openEntered);

        CompletableFuture<Void> disconnect = pool.disconnect("lan:10.0.0.1:9100");
        Thread.sleep(SETTLE_MS);
        assertFalse(disconnect.isDone());

        openGate.countDown();
        await(connect);
        await(disconnect);
        assertFalse(factory.transport(0).isOpen());
    }

    @Test
    public void hardwareLostRemovesOnlyMatchingConnectionAndReportsOnce() throws Exception {
        String idA = await(pool.connect(printerA)).connectionId();
        String idB = await(pool.connect(printerB)).connectionId();

        pool.onHardwareLost("10.0.0.1:9100", DisconnectReason.USB_DETACHED);
        pool.onHardwareLost("10.0.0.1:9100", DisconnectReason.USB_DETACHED);

        assertEquals(Collections.singletonList("lan:10.0.0.1:9100|usb_detached"), disconnectEvents);
        assertEquals(DeviceErrorCode.NOT_CONNECTED, failureOf(pool.write(idA, new byte[1], TIMEOUT_MS)).errorCode());
        await(pool.write(idB, new byte[1], TIMEOUT_MS));
    }

    @Test
    public void ioErrorThenBroadcastReportsOnceWithFirstReason() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        factory.transport(0).nextWriteFailure = new DeviceException(DeviceErrorCode.WRITE_FAILED, "lỗi I/O");
        factory.transport(0).closeOnWriteFailure = true;

        DeviceException writeFailure = failureOf(pool.write(connectionId, new byte[1], TIMEOUT_MS));
        assertEquals(DeviceErrorCode.WRITE_FAILED, writeFailure.errorCode());
        awaitCondition(() -> disconnectEvents.size() == 1);
        pool.onHardwareLost("10.0.0.1:9100", DisconnectReason.BLUETOOTH_DISCONNECTED);

        assertEquals(Collections.singletonList("lan:10.0.0.1:9100|io_error"), disconnectEvents);
    }

    @Test
    public void hardwareLostDuringDisconnectIsNotReported() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        CountDownLatch writeGate = new CountDownLatch(1);
        factory.transport(0).writeGate = writeGate;
        pool.write(connectionId, new byte[] {1}, TIMEOUT_MS);
        awaitLatch(factory.transport(0).writeEntered);

        CompletableFuture<Void> disconnect = pool.disconnect(connectionId);
        pool.onHardwareLost("10.0.0.1:9100", DisconnectReason.USB_DETACHED);
        writeGate.countDown();
        await(disconnect);

        assertTrue(disconnectEvents.isEmpty());
    }

    @Test
    public void closeAllAbortsWithoutEventsAndRejectsLaterCalls() throws Exception {
        String connectionId = await(pool.connect(printerA)).connectionId();
        factory.transport(0).writeGate = new CountDownLatch(1);
        CompletableFuture<Void> write = pool.write(connectionId, new byte[] {1}, TIMEOUT_MS);
        awaitLatch(factory.transport(0).writeEntered);

        pool.closeAll();

        assertEquals(DeviceErrorCode.CONNECTION_LOST, failureOf(write).errorCode());
        assertTrue(disconnectEvents.isEmpty());
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(pool.connect(printerA)).errorCode());
        DeviceException writeAfterClose = failureOf(pool.write(connectionId, new byte[1], TIMEOUT_MS));
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, writeAfterClose.errorCode());
    }

    @Test
    public void closeAllWhileOpeningNeverAddsConnection() throws Exception {
        CountDownLatch openGate = new CountDownLatch(1);
        factory.openGate = openGate;
        CompletableFuture<ConnectedDevice> connect = pool.connect(printerA);
        awaitCondition(() -> factory.created.size() == 1);
        awaitLatch(factory.transport(0).openEntered);

        pool.closeAll();
        openGate.countDown();

        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(connect).errorCode());
        assertFalse(factory.transport(0).isOpen());
    }

    @Test
    public void closeAllInterruptsWaitForPermissionAndRejectsWithServiceClosed() throws Exception {
        factory.createGate = new CountDownLatch(1);
        CompletableFuture<ConnectedDevice> connect = pool.connect(printerA);
        awaitLatch(factory.createEntered);

        pool.closeAll();

        DeviceException failure = failureWithin(connect, INTERRUPT_DEADLINE_SECONDS);
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failure.errorCode());
        assertTrue(factory.created.isEmpty());
    }

    @Test
    public void writesRacingDisconnectNeverRunAfterTransportCloses() throws Exception {
        for (int round = 0; round < RACE_ROUNDS; round++) {
            String connectionId = await(pool.connect(printerA)).connectionId();
            List<CompletableFuture<Void>> writes = new CopyOnWriteArrayList<>();
            Thread writer = new Thread(() -> writeRepeatedly(connectionId, writes));

            writer.start();
            CompletableFuture<Void> disconnect = pool.disconnect(connectionId);
            writer.join();
            await(disconnect);

            for (CompletableFuture<Void> write : writes) {
                assertWriteSucceededOrNotConnected(write);
            }
        }
    }

    private void writeRepeatedly(String connectionId, List<CompletableFuture<Void>> writes) {
        for (int index = 0; index < WRITES_PER_ROUND; index++) {
            writes.add(pool.write(connectionId, new byte[] {1}, TIMEOUT_MS));
        }
    }

    /** Ghi chạy sau khi transport đóng sẽ ra WRITE_FAILED (bản giả báo vậy) — điều không được xảy ra. */
    private static void assertWriteSucceededOrNotConnected(CompletableFuture<Void> write) throws Exception {
        try {
            await(write);
        } catch (ExecutionException exception) {
            DeviceException failure = (DeviceException) exception.getCause();
            assertEquals(DeviceErrorCode.NOT_CONNECTED, failure.errorCode());
        }
    }

    private static DeviceException failureWithin(CompletableFuture<?> future, long seconds) throws Exception {
        try {
            future.get(seconds, TimeUnit.SECONDS);
        } catch (ExecutionException exception) {
            return (DeviceException) exception.getCause();
        }

        throw new AssertionError("Future thành công, mong đợi lỗi");
    }
}
