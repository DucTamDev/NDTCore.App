package com.ndtcorepos.thermalprinter.model;

/** Raw printer bytes bất biến — Native không biết nội dung là gì. */
public final class PrinterData {

    private final byte[] bytes;

    public PrinterData(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("Printer data must not be empty");
        }
        this.bytes = bytes.clone();
    }

    public byte[] getBytes() {
        return bytes.clone();
    }

    public int size() {
        return bytes.length;
    }
}
