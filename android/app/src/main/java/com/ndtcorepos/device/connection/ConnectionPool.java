package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.ConnectedDevice;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DisconnectReason;
import com.ndtcorepos.device.transport.ITransport;
import com.ndtcorepos.device.transport.ITransportFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.function.Supplier;

/** Nơi duy nhất sở hữu các kết nối native: mở, dùng lại, đóng, xử lý mất kết nối và chen ngang. */
public final class ConnectionPool {

    private enum EntryState {
        OPENING,
        OPEN,
        CLOSING
    }

    /** Trạng thái một thiết bị trong pool; mọi field chỉ đọc/ghi trong khoá của pool. */
    private static final class Entry {

        private EntryState state = EntryState.OPENING;

        /** `null` khi đang mở. */
        private Connection connection;

        /** Hoàn tất khi lần mở hoặc lần đóng đang diễn ra xong; bên muốn dùng thiết bị chờ nó rồi giữ chỗ lại. */
        private CompletableFuture<Void> transition = new CompletableFuture<>();
    }

    /** Kết quả giữ chỗ: dùng lại kết nối đang mở, chờ một lần mở/đóng khác xong, hoặc được quyền tự mở. */
    private static final class Reservation {

        private final Connection existing;

        private final CompletableFuture<Void> busy;

        private final Entry opening;

        private Reservation(
                Connection existing,
                CompletableFuture<Void> busy,
                Entry opening) {
            this.existing = existing;
            this.busy = busy;
            this.opening = opening;
        }

        private static Reservation reuse(Connection existing) {
            return new Reservation(existing, null, null);
        }

        private static Reservation waitFor(CompletableFuture<Void> busy) {
            return new Reservation(null, busy, null);
        }

        private static Reservation open(Entry opening) {
            return new Reservation(null, null, opening);
        }
    }

    private final ITransportFactory transportFactory;

    private final IDisconnectListener listener;

    /** Chạy tìm thiết bị + mở transport; được phép chặn (chờ quyền USB, mở socket). */
    private final ExecutorService connectExecutor;

    /** Abort kết nối bị mất ngoài luồng gọi (broadcast chạy trên luồng UI). */
    private final ExecutorService abortExecutor;

    /** Tạo luồng riêng cho mỗi kết nối mới. */
    private final Supplier<ExecutorService> operationExecutorFactory;

    private final Object lock = new Object();

    /** Thiết bị đang mở dở, đang mở hoặc đang đóng, theo `connectionId`. */
    private final Map<String, Entry> entries = new HashMap<>();

    /** Các lần `connect` đang chạy, gộp theo `DeviceAddress.lookupKey()` (trước khi biết là thiết bị nào). */
    private final Map<String, CompletableFuture<ConnectedDevice>> pendingByLookupKey = new HashMap<>();

    private boolean closed;

    public ConnectionPool(
            ITransportFactory transportFactory,
            IDisconnectListener listener,
            ExecutorService connectExecutor,
            ExecutorService abortExecutor,
            Supplier<ExecutorService> operationExecutorFactory) {
        this.transportFactory = transportFactory;
        this.listener = listener;
        this.connectExecutor = connectExecutor;
        this.abortExecutor = abortExecutor;
        this.operationExecutorFactory = operationExecutorFactory;
    }

    public CompletableFuture<ConnectedDevice> connect(DeviceAddress address) {
        String lookupKey = address.lookupKey();

        synchronized (lock) {
            if (closed) {
                return failedFuture(serviceClosed());
            }

            CompletableFuture<ConnectedDevice> pending = pendingByLookupKey.get(lookupKey);

            if (pending != null) {
                return pending;
            }

            CompletableFuture<ConnectedDevice> result = new CompletableFuture<>();
            pendingByLookupKey.put(lookupKey, result);
            result.whenComplete((connectedDevice, error) -> removePending(lookupKey, result));
            connectExecutor.execute(() -> connectOnWorker(address, result));
            return result;
        }
    }

    public CompletableFuture<Void> write(
            String connectionId,
            byte[] data,
            long timeoutMillis) {
        try {
            return findOpenConnection(connectionId).write(data, timeoutMillis);
        } catch (DeviceException exception) {
            return failedFuture(exception);
        }
    }

    public CompletableFuture<byte[]> read(
            String connectionId,
            int maxBytes,
            long timeoutMillis) {
        try {
            return findOpenConnection(connectionId).read(maxBytes, timeoutMillis);
        } catch (DeviceException exception) {
            return failedFuture(exception);
        }
    }

    /**
     * Chuyển sang đang đóng ngay trong khoá: lời gọi ghi/đọc sau đó nhận `NOT_CONNECTED`, thao tác đã xếp trước chạy
     * xong rồi mới đóng. Không phát sự kiện mất kết nối.
     */
    public CompletableFuture<Void> disconnect(String connectionId) {
        synchronized (lock) {
            if (closed) {
                return failedFuture(serviceClosed());
            }

            Entry entry = entries.get(connectionId);

            if (entry == null) {
                return CompletableFuture.completedFuture(null);
            }

            if (entry.state == EntryState.OPENING) {
                return entry.transition
                        .handle((ignored, error) -> null)
                        .thenCompose(ignored -> disconnect(connectionId));
            }

            if (entry.state == EntryState.CLOSING) {
                return entry.transition;
            }

            return beginClosing(connectionId, entry);
        }
    }

    /** Monitor báo một thiết bị vật lý đã mất. */
    public void onHardwareLost(String hardwareAddress, DisconnectReason reason) {
        Connection lostConnection = findOpenByHardwareAddress(hardwareAddress);

        if (lostConnection != null) {
            loseConnection(lostConnection, reason);
        }
    }

    /**
     * Abort mọi kết nối, không chờ, không phát sự kiện; ngắt luồng đang chờ quyền USB hoặc mở socket. Mọi lời gọi sau
     * đó, kể cả `connect` đang dở, kết thúc với `SERVICE_CLOSED`.
     */
    public void closeAll() {
        List<Connection> connectionsToAbort;

        synchronized (lock) {
            if (closed) {
                return;
            }

            closed = true;
            connectionsToAbort = openedConnections();
            entries.clear();
            connectExecutor.shutdownNow();
            abortExecutor.shutdown();
        }

        for (Connection connection : connectionsToAbort) {
            connection.abort();
        }
    }

    /** Kết nối đã mở của mọi `Entry`; gọi trong khoá của pool. */
    private List<Connection> openedConnections() {
        List<Connection> connections = new ArrayList<>();

        for (Entry entry : entries.values()) {
            if (entry.connection != null) {
                connections.add(entry.connection);
            }
        }

        return connections;
    }

    private void connectOnWorker(DeviceAddress address, CompletableFuture<ConnectedDevice> result) {
        try {
            ITransport transport = transportFactory.create(address);
            String connectionId = address.type().wireValue() + ":" + transport.hardwareAddress();
            Connection connection = acquireConnection(connectionId, transport);
            result.complete(new ConnectedDevice(connectionId, connection.serialNumber()));
        } catch (DeviceException | RuntimeException exception) {
            result.completeExceptionally(isClosed() ? serviceClosed() : exception);
        }
    }

    /** Giữ chỗ trước khi mở: chỉ một bên được mở một thiết bị, bên còn lại huỷ transport chưa mở của mình. */
    private Connection acquireConnection(String connectionId, ITransport transport) throws DeviceException {
        while (true) {
            Reservation reservation = reserve(connectionId, transport);

            if (reservation.existing != null) {
                transport.abort();
                return reservation.existing;
            }

            if (reservation.opening != null) {
                return openReserved(connectionId, transport, reservation.opening);
            }

            awaitQuietly(reservation.busy);
        }
    }

    private Reservation reserve(String connectionId, ITransport transport) throws DeviceException {
        synchronized (lock) {
            throwIfClosed(transport);
            Entry entry = entries.get(connectionId);

            if (entry != null && entry.state == EntryState.OPEN && entry.connection.isAlive()) {
                return Reservation.reuse(entry.connection);
            }

            if (entry != null && entry.state == EntryState.OPEN) {
                discardDeadConnection(connectionId, entry);
                entry = null;
            }

            if (entry != null) {
                return Reservation.waitFor(entry.transition);
            }

            Entry opening = new Entry();
            entries.put(connectionId, opening);
            return Reservation.open(opening);
        }
    }

    /** Chuyển trạng thái trong khoá rồi mới hoàn tất `transition`, vì callback của bên chờ chạy ngay lúc đó. */
    private Connection openReserved(
            String connectionId,
            ITransport transport,
            Entry opening) throws DeviceException {
        CompletableFuture<Void> transition = opening.transition;
        Connection connection;

        try {
            transport.open();
            connection = new Connection(
                    connectionId,
                    transport,
                    operationExecutorFactory.get(),
                    this::onTransportLost);
            publish(connectionId, opening, connection);
        } catch (DeviceException | RuntimeException exception) {
            transport.abort();
            removeEntry(connectionId, opening);
            transition.completeExceptionally(exception);
            throw exception;
        }

        transition.complete(null);
        return connection;
    }

    /** Pool đã đóng thì huỷ ngay để không bao giờ thêm kết nối sau `closeAll`. */
    private void publish(
            String connectionId,
            Entry opening,
            Connection connection) throws DeviceException {
        synchronized (lock) {
            if (!closed && entries.get(connectionId) == opening) {
                opening.connection = connection;
                opening.state = EntryState.OPEN;
                return;
            }
        }

        connection.abort();
        throw serviceClosed();
    }

    /** `transition` do pool giữ và chỉ hoàn tất sau khi bỏ `Entry`, để bên chờ giữ chỗ lại không gặp `CLOSING` cũ. */
    private CompletableFuture<Void> beginClosing(String connectionId, Entry entry) {
        CompletableFuture<Void> transition = new CompletableFuture<>();
        entry.state = EntryState.CLOSING;
        entry.transition = transition;
        entry.connection.close().whenComplete((ignored, error) -> {
            removeEntry(connectionId, entry);
            transition.complete(null);
        });
        return transition;
    }

    private void onTransportLost(Connection connection) {
        loseConnection(connection, DisconnectReason.IO_ERROR);
    }

    /** Nơi duy nhất chuyển một kết nối sang "mất": chỉ lần bỏ khỏi pool đầu tiên thành công mới báo và abort. */
    private void loseConnection(Connection connection, DisconnectReason reason) {
        synchronized (lock) {
            Entry entry = entries.get(connection.connectionId());

            if (entry == null || entry.state != EntryState.OPEN || entry.connection != connection) {
                return;
            }

            entries.remove(connection.connectionId());
            abortExecutor.execute(connection::abort);
        }

        listener.onDisconnected(connection.connectionId(), reason);
    }

    private Connection findOpenByHardwareAddress(String hardwareAddress) {
        synchronized (lock) {
            return entries.values().stream()
                    .filter(entry -> isOpenAt(entry, hardwareAddress))
                    .map(entry -> entry.connection)
                    .findFirst()
                    .orElse(null);
        }
    }

    private static boolean isOpenAt(Entry entry, String hardwareAddress) {
        return entry.state == EntryState.OPEN && entry.connection.hardwareAddress().equalsIgnoreCase(hardwareAddress);
    }

    private Connection findOpenConnection(String connectionId) throws DeviceException {
        synchronized (lock) {
            if (closed) {
                throw serviceClosed();
            }

            Entry entry = entries.get(connectionId);

            if (entry == null || entry.state != EntryState.OPEN) {
                throw new DeviceException(DeviceErrorCode.NOT_CONNECTED, "Chưa kết nối: " + connectionId);
            }

            return entry.connection;
        }
    }

    /** Kết nối còn trong pool nhưng transport đã chết: bỏ đi không phát sự kiện, để mở lại. */
    private void discardDeadConnection(String connectionId, Entry deadEntry) {
        entries.remove(connectionId);
        abortExecutor.execute(deadEntry.connection::abort);
    }

    private void throwIfClosed(ITransport transport) throws DeviceException {
        if (closed) {
            transport.abort();
            throw serviceClosed();
        }
    }

    private boolean isClosed() {
        synchronized (lock) {
            return closed;
        }
    }

    private void removePending(String lookupKey, CompletableFuture<ConnectedDevice> pending) {
        synchronized (lock) {
            pendingByLookupKey.remove(lookupKey, pending);
        }
    }

    private void removeEntry(String connectionId, Entry entry) {
        synchronized (lock) {
            entries.remove(connectionId, entry);
        }
    }

    private static void awaitQuietly(CompletableFuture<Void> future) {
        try {
            future.join();
        } catch (CompletionException ignored) {
            // Lần mở/đóng kia lỗi thì vòng giữ chỗ tiếp theo tự xử lý lại từ đầu.
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
