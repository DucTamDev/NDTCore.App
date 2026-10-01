package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.transport.ITransport;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/** Một kết nối đang mở; mọi thao tác chạy lần lượt trên một luồng riêng. */
public final class Connection {

    private enum State {
        OPEN,
        CLOSING,
        CLOSED,
        ABORTED
    }

    /** Một thao tác trên transport. */
    private interface IOperation<T> {
        T run() throws DeviceException;
    }

    /** Mã của kết nối, xác định từ thiết bị vật lý nên mọi địa chỉ trỏ tới cùng máy cho cùng mã. */
    private final String connectionId;

    private final ITransport transport;

    /** Một luồng duy nhất: ghi/đọc/đóng của cùng kết nối không bao giờ chạy song song. */
    private final ExecutorService operationExecutor;

    /** Báo pool khi transport không còn dùng được sau một lỗi. */
    private final Consumer<Connection> transportLostHandler;

    /** Hoàn tất khi kết nối đã đóng, dù đóng bình thường hay bị abort. */
    private final CompletableFuture<Void> closeFuture = new CompletableFuture<>();

    /** Thao tác đã nhận nhưng chưa xong; chỉ đọc/ghi trong khoá của đối tượng. */
    private final Set<CompletableFuture<?>> unfinishedOperations = new HashSet<>();

    /** Thao tác đang chạy trên transport; abort để nó tự kết thúc khi transport đóng nhằm giữ đúng số byte đã gửi. */
    private CompletableFuture<?> runningOperation;

    private State state = State.OPEN;

    Connection(
            String connectionId,
            ITransport transport,
            ExecutorService operationExecutor,
            Consumer<Connection> transportLostHandler) {
        this.connectionId = connectionId;
        this.transport = transport;
        this.operationExecutor = operationExecutor;
        this.transportLostHandler = transportLostHandler;
    }

    public String connectionId() {
        return connectionId;
    }

    public String hardwareAddress() {
        return transport.hardwareAddress();
    }

    public String serialNumber() {
        return transport.serialNumber();
    }

    public synchronized boolean isAlive() {
        return state == State.OPEN && transport.isOpen();
    }

    /** Hạn ghi tính từ lúc tới lượt chạy, không tính thời gian chờ thao tác trước. */
    public CompletableFuture<Void> write(byte[] data, long timeoutMillis) {
        return enqueue(() -> {
            transport.write(data, deadlineAfter(timeoutMillis));
            return null;
        });
    }

    /** Hạn đọc tính từ lúc tới lượt chạy; hết hạn mà chưa có byte thì trả mảng rỗng. */
    public CompletableFuture<byte[]> read(int maxBytes, long timeoutMillis) {
        return enqueue(() -> transport.read(maxBytes, deadlineAfter(timeoutMillis)));
    }

    /** Đóng sau khi các thao tác đã nhận chạy xong; gọi lại trả cùng một future. */
    public synchronized CompletableFuture<Void> close() {
        if (state != State.OPEN) {
            return closeFuture;
        }

        state = State.CLOSING;
        operationExecutor.execute(this::closeTransport);
        operationExecutor.shutdown();
        return closeFuture;
    }

    /** Đóng ngay, không chờ: giải phóng luồng đang kẹt và kết thúc mọi thao tác chưa xong với `CONNECTION_LOST`. */
    public void abort() {
        List<CompletableFuture<?>> waitingOperations;

        synchronized (this) {
            if (state == State.CLOSED || state == State.ABORTED) {
                return;
            }

            state = State.ABORTED;
            waitingOperations = new ArrayList<>(unfinishedOperations);
            waitingOperations.remove(runningOperation);
        }

        transport.abort();

        for (CompletableFuture<?> operation : waitingOperations) {
            operation.completeExceptionally(connectionLost(0));
        }

        operationExecutor.shutdown();
        closeFuture.complete(null);
    }

    private <T> CompletableFuture<T> enqueue(IOperation<T> operation) {
        CompletableFuture<T> result = new CompletableFuture<>();

        synchronized (this) {
            if (state != State.OPEN) {
                result.completeExceptionally(notConnected());
                return result;
            }

            unfinishedOperations.add(result);
            operationExecutor.execute(() -> runOperation(operation, result));
        }

        return result;
    }

    private <T> void runOperation(IOperation<T> operation, CompletableFuture<T> result) {
        if (!markRunning(result)) {
            return;
        }

        try {
            succeed(result, operation.run());
        } catch (DeviceException exception) {
            fail(result, exception);
        } catch (RuntimeException exception) {
            result.completeExceptionally(exception);
        } finally {
            markFinished(result);
        }
    }

    private synchronized boolean markRunning(CompletableFuture<?> result) {
        if (result.isDone()) {
            return false;
        }

        runningOperation = result;
        return true;
    }

    private synchronized void markFinished(CompletableFuture<?> result) {
        unfinishedOperations.remove(result);

        if (runningOperation == result) {
            runningOperation = null;
        }
    }

    private synchronized <T> void succeed(CompletableFuture<T> result, T value) {
        if (state == State.ABORTED) {
            result.completeExceptionally(connectionLost(0));
            return;
        }

        result.complete(value);
    }

    /** Báo mất kết nối trước khi trả lỗi để nơi gọi thử lại ngay không rơi vào kết nối đã chết. */
    private void fail(CompletableFuture<?> result, DeviceException exception) {
        DeviceException outcome;

        synchronized (this) {
            outcome = state == State.ABORTED ? connectionLost(exception.bytesWritten()) : exception;
        }

        if (outcome == exception && !transport.isOpen()) {
            transportLostHandler.accept(this);
        }

        result.completeExceptionally(outcome);
    }

    /** Đã bị abort trong lúc chờ tới lượt thì transport đã đóng, không đóng bình thường lần nữa. */
    private void closeTransport() {
        synchronized (this) {
            if (state != State.CLOSING) {
                return;
            }
        }

        transport.close();

        synchronized (this) {
            if (state == State.CLOSING) {
                state = State.CLOSED;
            }
        }

        closeFuture.complete(null);
    }

    private static long deadlineAfter(long timeoutMillis) {
        return System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
    }

    private DeviceException notConnected() {
        return new DeviceException(DeviceErrorCode.NOT_CONNECTED, "Kết nối đã đóng: " + connectionId);
    }

    private DeviceException connectionLost(int bytesWritten) {
        return new DeviceException(DeviceErrorCode.CONNECTION_LOST, "Mất kết nối: " + connectionId)
                .withBytesWritten(bytesWritten);
    }
}
