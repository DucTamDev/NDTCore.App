package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceException;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

/** Tiện ích chờ kết quả bất đồng bộ trong test, có giới hạn thời gian để test không treo. */
final class Futures {

    private static final long TIMEOUT_SECONDS = 5;

    private static final long POLL_INTERVAL_MS = 10;

    private Futures() {
    }

    static <T> T await(CompletableFuture<T> future) throws Exception {
        return future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    /** Lỗi thiết bị mà future kết thúc với; future thành công thì ném AssertionError. */
    static DeviceException failureOf(CompletableFuture<?> future) throws Exception {
        try {
            future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (ExecutionException exception) {
            return (DeviceException) exception.getCause();
        }

        throw new AssertionError("Future thành công, mong đợi lỗi");
    }

    static void awaitLatch(CountDownLatch latch) throws InterruptedException {
        if (!latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            throw new AssertionError("Chờ latch quá lâu");
        }
    }

    static void awaitCondition(BooleanSupplier condition) throws InterruptedException {
        long deadlineNanos = System.nanoTime() + TimeUnit.SECONDS.toNanos(TIMEOUT_SECONDS);

        while (!condition.getAsBoolean()) {
            if (System.nanoTime() > deadlineNanos) {
                throw new AssertionError("Chờ điều kiện quá lâu");
            }

            Thread.sleep(POLL_INTERVAL_MS);
        }
    }
}