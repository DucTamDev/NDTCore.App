package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.transport.ITransport;

import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** Transport giả: điều khiển được ghi chậm, lỗi, hết hạn, trạng thái mở để test mà không cần thiết bị thật. */
final class FakeTransport implements ITransport {

    private static final long GATE_POLL_INTERVAL_MS = 10;

    private final String hardwareAddress;

    /** Địa chỉ trả sau khi mở. */
    private final DeviceAddress address;

    private final String name;

    /** Nhật ký dùng chung giữa các transport để kiểm thứ tự mở/đóng. */
    private final List<String> events;

    final AtomicInteger openCount = new AtomicInteger();

    final AtomicInteger closeCount = new AtomicInteger();

    final AtomicInteger abortCount = new AtomicInteger();

    final List<byte[]> writes = new CopyOnWriteArrayList<>();

    /** Hạn (nano giây, theo `System.nanoTime()`) của từng lần ghi. */
    final List<Long> writeDeadlines = new CopyOnWriteArrayList<>();

    final Queue<byte[]> readResponses = new ConcurrentLinkedQueue<>();

    /** Khác `null` thì `open` chờ latch này mở. */
    volatile CountDownLatch openGate;

    final CountDownLatch openEntered = new CountDownLatch(1);

    /** Khác `null` thì `write` chờ latch này mở, hoặc tới khi transport bị đóng/abort. */
    volatile CountDownLatch writeGate;

    final CountDownLatch writeEntered = new CountDownLatch(1);

    /** Số byte báo đã gửi khi lần ghi đang chờ bị cắt ngang do transport bị đóng. */
    volatile int bytesSentBeforeClose;

    volatile DeviceException nextWriteFailure;

    /** Lỗi ghi kế tiếp làm transport không còn dùng được. */
    volatile boolean closeOnWriteFailure;

    volatile boolean open;

    /** Đã đóng hoặc abort: lần chờ đang dở thôi chờ, giống socket bị cắt ngang. */
    private volatile boolean stopped;

    FakeTransport(
            String hardwareAddress,
            DeviceAddress address,
            String name,
            List<String> events) {
        this.hardwareAddress = hardwareAddress;
        this.address = address;
        this.name = name;
        this.events = events;
    }

    @Override
    public void open() throws DeviceException {
        openEntered.countDown();
        awaitGate(openGate);
        open = true;
        openCount.incrementAndGet();
        events.add("open:" + hardwareAddress);
    }

    @Override
    public void write(byte[] data, long deadlineNanos) throws DeviceException {
        writeDeadlines.add(deadlineNanos);
        writeEntered.countDown();
        awaitGate(writeGate);

        if (!open) {
            throw new DeviceException(DeviceErrorCode.WRITE_FAILED, "đã đóng").withBytesWritten(bytesSentBeforeClose);
        }

        DeviceException failure = nextWriteFailure;

        if (failure != null) {
            nextWriteFailure = null;
            open = !closeOnWriteFailure;
            throw failure;
        }

        writes.add(data);
    }

    @Override
    public byte[] read(int maxBytes, long deadlineNanos) {
        byte[] response = readResponses.poll();
        return response == null ? new byte[0] : response;
    }

    @Override
    public void close() {
        closeCount.incrementAndGet();
        stop("close:");
    }

    @Override
    public void abort() {
        abortCount.incrementAndGet();
        stop("abort:");
    }

    @Override
    public boolean isOpen() {
        return open;
    }

    @Override
    public String hardwareAddress() {
        return hardwareAddress;
    }

    @Override
    public DeviceAddress address() {
        return address;
    }

    @Override
    public String name() {
        return name;
    }

    @Override
    public String manufacturerName() {
        return null;
    }

    @Override
    public String productName() {
        return null;
    }

    private void stop(String eventPrefix) {
        if (open) {
            events.add(eventPrefix + hardwareAddress);
        }

        open = false;
        stopped = true;
    }

    private void awaitGate(CountDownLatch gate) {
        if (gate == null) {
            return;
        }

        try {
            while (!gate.await(GATE_POLL_INTERVAL_MS, TimeUnit.MILLISECONDS) && !stopped) {
                Thread.yield();
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
