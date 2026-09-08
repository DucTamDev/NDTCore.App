package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.PrinterDevice;
import com.ndtcorepos.thermalprinter.printer.PrinterRegistry;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Hàng đợi FIFO cho 1 printer — chạy trên 1 single-thread executor riêng.
 */
public final class PrinterQueue {

    private final String printerId;
    private final PrinterRegistry registry;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Map<String, Future<?>> pendingFutures = new ConcurrentHashMap<>();
    private final AtomicInteger pendingCount = new AtomicInteger(0);
    private volatile String runningJobId;

    public PrinterQueue(String printerId, PrinterRegistry registry) {
        this.printerId = printerId;
        this.registry = registry;
    }

    /**
     * Thêm job vào cuối hàng đợi — thực thi đúng thứ tự FIFO.
     *
     * @param job job cần thực thi
     */
    public CompletableFuture<PrintJobResult> enqueue(PrintJob job) {
        pendingCount.incrementAndGet();
        CompletableFuture<PrintJobResult> resultFuture = new CompletableFuture<>();
        Future<?> submitted = executor.submit(() -> runJob(job, resultFuture));
        pendingFutures.put(job.jobId(), submitted);
        return resultFuture;
    }

    private void runJob(PrintJob job, CompletableFuture<PrintJobResult> resultFuture) {
        pendingCount.decrementAndGet();
        pendingFutures.remove(job.jobId());
        runningJobId = job.jobId();
        long startedAt = System.currentTimeMillis();
        try {
            PrinterDevice device = registry.get(job.printerId());
            if (device == null) {
                resultFuture.complete(PrintJobResult.failure(job.jobId(), job.printerId(), PrinterErrorCode.PRINTER_NOT_FOUND,
                        "Printer not found: " + job.printerId(), System.currentTimeMillis() - startedAt));
                return;
            }
            device.write(job.data()).get();
            resultFuture.complete(PrintJobResult.success(job.jobId(), job.printerId(), System.currentTimeMillis() - startedAt));
        } catch (Exception e) {
            resultFuture.complete(PrintJobResult.failure(job.jobId(), job.printerId(), errorCodeOf(e), e.getMessage(),
                    System.currentTimeMillis() - startedAt));
        } finally {
            runningJobId = null;
        }
    }

    private PrinterErrorCode errorCodeOf(Exception e) {
        Throwable cause = e.getCause() != null ? e.getCause() : e;
        if (cause instanceof PrinterException printerException) {
            return printerException.getCode();
        }
        return PrinterErrorCode.UNKNOWN_ERROR;
    }

    /**
     * Huỷ job — chỉ thành công nếu job còn PENDING (chưa tới lượt chạy).
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công
     */
    public boolean cancel(String jobId) {
        Future<?> future = pendingFutures.remove(jobId);
        if (future == null) {
            return false;
        }
        boolean cancelled = future.cancel(false);
        if (cancelled) {
            pendingCount.decrementAndGet();
        }
        return cancelled;
    }

    /**
     * Số job đang chờ và job đang chạy (nếu có).
     */
    public QueueStatus status() {
        return new QueueStatus(pendingCount.get(), runningJobId);
    }

    /**
     * Đóng executor — không nhận job mới.
     */
    public void shutdown() {
        executor.shutdown();
    }
}
