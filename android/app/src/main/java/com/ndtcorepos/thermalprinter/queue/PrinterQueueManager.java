package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Future;

/**
 * Manages one serial queue for each physical connection identity.
 *
 * Writes targeting the same connection execute sequentially.
 * Writes targeting different connections can execute concurrently.
 */
public final class PrinterQueueManager {

    /**
     * Queues indexed by physical connection identity.
     */
    private final Map<ConnectionIdentity, PrinterQueue> queues =
            new HashMap<>();


    /**
     * Submits raw bytes to the queue belonging to a connection.
     *
     * @param device runtime printer device
     * @param data raw printer bytes
     * @return asynchronous write result
     */
    public synchronized Future<PrinterWriteResult> submit(
            IPrinterDevice device,
            byte[] data
    ) {
        ConnectionIdentity identity =
                device.getConnectionIdentity();

        PrinterQueue queue =
                queues.get(identity);

        if (queue == null) {
            queue = new PrinterQueue(device);

            queues.put(
                    identity,
                    queue
            );
        }

        return queue.submit(
                new PrinterQueueTask(data)
        );
    }


    /**
     * Removes and shuts down the queue for a connection.
     *
     * @param identity physical connection identity
     */
    public synchronized void remove(
            ConnectionIdentity identity
    ) {
        PrinterQueue queue =
                queues.remove(identity);

        if (queue != null) {
            queue.shutdown();
        }
    }


    /**
     * Shuts down all printer queues.
     */
    public synchronized void shutdown() {

        for (PrinterQueue queue : queues.values()) {
            queue.shutdown();
        }

        queues.clear();
    }
}
