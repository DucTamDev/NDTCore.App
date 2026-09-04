package com.ndtcorepos.thermalprinter.application;

public final class WriteResult {

    private final int bytesWritten;
    private final long durationMs;

    public WriteResult(int bytesWritten, long durationMs) {
        this.bytesWritten = bytesWritten;
        this.durationMs = durationMs;
    }

    public int getBytesWritten() {
        return bytesWritten;
    }

    public long getDurationMs() {
        return durationMs;
    }
}
