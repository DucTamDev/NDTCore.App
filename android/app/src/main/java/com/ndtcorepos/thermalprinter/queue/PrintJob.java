package com.ndtcorepos.thermalprinter.queue;

/**
 * 1 lệnh ghi đã được đưa vào hàng đợi.
 */
public record PrintJob(String jobId, String printerId, byte[] data, long createdAt) {
}
