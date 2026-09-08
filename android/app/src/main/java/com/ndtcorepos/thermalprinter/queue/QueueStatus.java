package com.ndtcorepos.thermalprinter.queue;

/**
 * Trạng thái hàng đợi tại 1 thời điểm.
 */
public record QueueStatus(int pendingCount, String runningJobId) {
}
