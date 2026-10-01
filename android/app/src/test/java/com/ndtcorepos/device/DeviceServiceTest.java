package com.ndtcorepos.device;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.discovery.IDeviceDiscovery;
import com.ndtcorepos.device.enums.TransportType;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;
import com.ndtcorepos.device.monitor.IDisconnectMonitor;

import org.junit.Before;
import org.junit.Test;

import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class DeviceServiceTest {

    private static final long TIMEOUT_SECONDS = 5;

    /** Monitor giả đếm số lần bật/tắt. */
    private static final class CountingMonitor implements IDisconnectMonitor {

        private final AtomicInteger startCount = new AtomicInteger();

        private final AtomicInteger stopCount = new AtomicInteger();

        @Override
        public void start() {
            startCount.incrementAndGet();
        }

        @Override
        public void stop() {
            stopCount.incrementAndGet();
        }
    }

    private final CountingMonitor monitor = new CountingMonitor();

    private final CountDownLatch discoveryGate = new CountDownLatch(1);

    private List<DeviceInfo> usbDevices;

    private DeviceService deviceService;

    @Before
    public void setUp() throws Exception {
        DeviceAddress usbAddress = DeviceAddress.usb(1, 2, null, "/dev/bus/usb/001/004");
        usbDevices = Collections.singletonList(
                DeviceInfo.usb("usb:/dev/bus/usb/001/004", "XP-80C", usbAddress, null, null, false));

        Map<TransportType, IDeviceDiscovery> discoveries = new EnumMap<>(TransportType.class);
        discoveries.put(TransportType.USB, this::discoverUsbAfterGate);

        ConnectionPool connectionPool = new ConnectionPool(
                address -> {
                    throw new DeviceException(DeviceErrorCode.CONNECTION_FAILED, "không dùng");
                },
                (connectionId, reason) -> { },
                Executors.newCachedThreadPool(),
                Executors.newSingleThreadExecutor(),
                Executors::newSingleThreadExecutor);
        deviceService = new DeviceService(
                discoveries,
                connectionPool,
                Collections.singletonList(monitor),
                Executors.newSingleThreadExecutor(),
                Executors.newSingleThreadScheduledExecutor());
        deviceService.start();
    }

    @Test
    public void discoverUsesDiscoveryOfRequestedType() throws Exception {
        discoveryGate.countDown();

        assertSame(usbDevices, await(deviceService.discover(TransportType.USB)));
    }

    @Test
    public void discoverLanIsInvalidArgument() throws Exception {
        DeviceException failure = failureOf(deviceService.discover(TransportType.LAN));

        assertEquals(DeviceErrorCode.INVALID_ARGUMENT, failure.errorCode());
    }

    @Test
    public void startStartsMonitorsAndRepeatedCloseStopsThemOnce() {
        deviceService.close();
        deviceService.close();

        assertEquals(1, monitor.startCount.get());
        assertEquals(1, monitor.stopCount.get());
    }

    @Test
    public void callsAfterCloseAreServiceClosed() throws Exception {
        deviceService.close();

        DeviceAddress lanAddress = DeviceAddress.lan("10.0.0.1", 9100);
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(deviceService.discover(TransportType.USB)).errorCode());
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(deviceService.connect(lanAddress)).errorCode());
        assertEquals(DeviceErrorCode.SERVICE_CLOSED, failureOf(deviceService.disconnect("lan:x")).errorCode());
    }

    @Test
    public void closeLetsRunningDiscoveryFinish() throws Exception {
        CompletableFuture<List<DeviceInfo>> running = deviceService.discover(TransportType.USB);

        deviceService.close();
        discoveryGate.countDown();

        assertSame(usbDevices, await(running));
        assertTrue(running.isDone());
    }

    private List<DeviceInfo> discoverUsbAfterGate() {
        try {
            discoveryGate.await(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }

        return usbDevices;
    }

    private static <T> T await(CompletableFuture<T> future) throws Exception {
        return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    private static DeviceException failureOf(CompletableFuture<?> future) throws Exception {
        try {
            future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (ExecutionException exception) {
            return (DeviceException) exception.getCause();
        }

        throw new AssertionError("Future thành công, mong đợi lỗi");
    }
}
