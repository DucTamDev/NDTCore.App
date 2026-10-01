package com.ndtcorepos.device;

import com.ndtcorepos.device.connection.ConnectionPool;
import com.ndtcorepos.device.discovery.IDeviceDiscovery;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.ConnectedDevice;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;
import com.ndtcorepos.device.model.DeviceType;
import com.ndtcorepos.device.monitor.IDisconnectMonitor;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;

/** Cửa vào duy nhất của tầng thiết bị cho bridge: quét, kết nối, ghi/đọc, ngắt và vòng đời. */
public final class DeviceService {

    private final Map<DeviceType, IDeviceDiscovery> discoveries;

    private final ConnectionPool connectionPool;

    private final List<IDisconnectMonitor> monitors;

    /** Một luồng chạy việc quét. */
    private final ExecutorService discoveryExecutor;

    /** Hẹn giờ đóng socket của transport Bluetooth/LAN; service tắt nó khi đóng. */
    private final ScheduledExecutorService timerExecutor;

    private boolean closed;

    public DeviceService(
            Map<DeviceType, IDeviceDiscovery> discoveries,
            ConnectionPool connectionPool,
            List<IDisconnectMonitor> monitors,
            ExecutorService discoveryExecutor,
            ScheduledExecutorService timerExecutor) {
        this.discoveries = discoveries;
        this.connectionPool = connectionPool;
        this.monitors = monitors;
        this.discoveryExecutor = discoveryExecutor;
        this.timerExecutor = timerExecutor;
    }

    /** Chỉ `DeviceFactory` gọi, đúng một lần sau khi tạo. */
    void start() {
        for (IDisconnectMonitor monitor : monitors) {
            monitor.start();
        }
    }

    public CompletableFuture<List<DeviceInfo>> discover(DeviceType type) {
        IDeviceDiscovery discovery = discoveries.get(type);

        if (discovery == null) {
            return failedFuture(new DeviceException(
                    DeviceErrorCode.INVALID_ARGUMENT,
                    "Không quét được thiết bị loại " + type.wireValue()));
        }

        CompletableFuture<List<DeviceInfo>> result = new CompletableFuture<>();

        synchronized (this) {
            if (closed) {
                return failedFuture(serviceClosed());
            }

            discoveryExecutor.execute(() -> runDiscovery(discovery, result));
        }

        return result;
    }

    public CompletableFuture<ConnectedDevice> connect(DeviceAddress address) {
        return connectionPool.connect(address);
    }

    public CompletableFuture<Void> write(
            String connectionId,
            byte[] data,
            long timeoutMillis) {
        return connectionPool.write(connectionId, data, timeoutMillis);
    }

    public CompletableFuture<byte[]> read(
            String connectionId,
            int maxBytes,
            long timeoutMillis) {
        return connectionPool.read(connectionId, maxBytes, timeoutMillis);
    }

    public CompletableFuture<Void> disconnect(String connectionId) {
        return connectionPool.disconnect(connectionId);
    }

    /** Gọi nhiều lần không sao; lần quét đang chạy được chạy xong, mọi lời gọi sau đó bị từ chối. */
    public void close() {
        synchronized (this) {
            if (closed) {
                return;
            }

            closed = true;
            discoveryExecutor.shutdown();
        }

        for (IDisconnectMonitor monitor : monitors) {
            monitor.stop();
        }

        connectionPool.closeAll();
        timerExecutor.shutdown();
    }

    private static void runDiscovery(IDeviceDiscovery discovery, CompletableFuture<List<DeviceInfo>> result) {
        try {
            result.complete(discovery.discover());
        } catch (DeviceException | RuntimeException exception) {
            result.completeExceptionally(exception);
        }
    }

    private static DeviceException serviceClosed() {
        return new DeviceException(DeviceErrorCode.SERVICE_CLOSED, "Dịch vụ thiết bị đã đóng");
    }

    private static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }
}
