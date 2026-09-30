package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Serializes write operations for one physical printer connection.
 *
 * All tasks submitted to one queue execute sequentially.
 */
public final class PrinterQueue {

    /**
     * Runtime printer device used by this queue.
     */
    private final IPrinterDevice device;

    /**
     * Single-thread executor guaranteeing sequential execution.
     */
    private final ExecutorService executor;


    /**
     * Creates a queue for one printer device.
     *
     * @param device runtime printer device
     */
    public PrinterQueue(
            IPrinterDevice device
    ) {
        this.device = device;
        this.executor =
                Executors.newSingleThreadExecutor();
    }


    /**
     * Executes a write operation sequentially.
     *
     * @param task write task
     * @return asynchronous execution future
     */
    public java.util.concurrent.Future<PrinterWriteResult> submit(
            PrinterQueueTask task
    ) {
        return executor.submit(
                () -> device.write(task.getData())
        );
    }


    /**
     * Stops the queue worker.
     *
     * Pending tasks are not guaranteed to complete after shutdown.
     */
    public void shutdown() {
        executor.shutdown();
    }
}
