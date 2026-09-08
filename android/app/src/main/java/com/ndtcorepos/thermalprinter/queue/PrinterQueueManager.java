package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.printer.PrinterRegistry;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Map printerId → PrinterQueue, tạo lười khi có job đầu tiên cho 1 printerId.
 */
public final class PrinterQueueManager {

    private final PrinterRegistry registry;
    private final Map<String, PrinterQueue> queues = new ConcurrentHashMap<>();

    public PrinterQueueManager(PrinterRegistry registry) {
        this.registry = registry;
    }

    /**
     * Lấy queue của 1 printer, tạo mới nếu chưa có.
     *
     * @param printerId printer cần lấy queue
     * @return queue tương ứng
     */
    public PrinterQueue getOrCreate(String printerId) {
        return queues.computeIfAbsent(printerId, id -> new PrinterQueue(id, registry));
    }

    /**
     * Lấy queue của 1 printer NẾU đã tồn tại — không tự tạo mới (dùng cho
     * getQueueStatus, tránh spin lên 1 executor thừa chỉ để hỏi trạng thái).
     *
     * @param printerId printer cần tra cứu
     * @return queue tương ứng, null nếu chưa từng có job nào
     */
    public PrinterQueue getIfExists(String printerId) {
        return queues.get(printerId);
    }

    /**
     * Huỷ 1 job theo id — tìm trong tất cả queue đang quản lý.
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công
     */
    public boolean cancel(String jobId) {
        for (PrinterQueue queue : queues.values()) {
            if (queue.cancel(jobId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Đóng tất cả queue đang quản lý.
     */
    public void shutdownAll() {
        queues.values().forEach(PrinterQueue::shutdown);
    }
}
