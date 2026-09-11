package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.IPrinterDevice;
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
    private final Map<String, PendingJob> pendingJobs = new ConcurrentHashMap<>();
    private final AtomicInteger pendingCount = new AtomicInteger(0);
    private volatile String runningJobId;

    /**
     * Job đã submit nhưng chưa chạy — giữ cả handle của executor lẫn future
     * trả về cho caller, để cancel() hoàn tất được future đó thay vì bỏ treo.
     *
     * @param submitted handle executor trả về, dùng để chặn job chạy
     * @param resultFuture future đã trao cho caller ở enqueue()
     */
    private record PendingJob(Future<?> submitted, CompletableFuture<PrintJobResult> resultFuture) {
    }

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
        pendingJobs.put(job.jobId(), new PendingJob(submitted, resultFuture));
        return resultFuture;
    }

    private void runJob(PrintJob job, CompletableFuture<PrintJobResult> resultFuture) {
        pendingCount.decrementAndGet();
        pendingJobs.remove(job.jobId());
        runningJobId = job.jobId();

        long startedAt = System.currentTimeMillis();

        try {
            IPrinterDevice device = registry.get(job.printerId());

            if (device == null) {
                long durationMs = System.currentTimeMillis() - startedAt;
                PrintJobResult result = PrintJobResult.failure(job.jobId(), job.printerId(), PrinterErrorCode.PRINTER_NOT_FOUND,
                        "Printer not found: " + job.printerId(), durationMs);
                resultFuture.complete(result);
                return;
            }

            device.write(job.data()).get();

            long durationMs = System.currentTimeMillis() - startedAt;
            resultFuture.complete(PrintJobResult.success(job.jobId(), job.printerId(), durationMs));
        } catch (Exception exception) {
            long durationMs = System.currentTimeMillis() - startedAt;
            PrintJobResult result = PrintJobResult.failure(job.jobId(), job.printerId(), errorCodeOf(exception), exception.getMessage(), durationMs);
            resultFuture.complete(result);
        } finally {
            runningJobId = null;
        }
    }

    private PrinterErrorCode errorCodeOf(Exception exception) {
        Throwable cause = exception.getCause() != null ? exception.getCause() : exception;

        if (cause instanceof PrinterException printerException) {
            return printerException.getCode();
        }

        return PrinterErrorCode.UNKNOWN_ERROR;
    }

    /**
     * Huỷ job — chỉ thành công nếu job còn PENDING (chưa tới lượt chạy).
     *
     * <p>Khi huỷ được, future đã trả cho caller ở enqueue() được hoàn tất
     * bằng JOB_CANCELLED — job không bao giờ chạy nên runJob() không còn cơ
     * hội hoàn tất nó, để nguyên sẽ treo promise phía JS.</p>
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công
     */
    public boolean cancel(String jobId) {
        PendingJob pending = pendingJobs.remove(jobId);

        if (pending == null) {
            return false;
        }

        boolean cancelled = pending.submitted().cancel(false);

        if (!cancelled) {
            return false;
        }

        pendingCount.decrementAndGet();

        PrintJobResult result = PrintJobResult.failure(jobId, printerId, PrinterErrorCode.JOB_CANCELLED, "Job cancelled", 0);
        pending.resultFuture().complete(result);

        return true;
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
