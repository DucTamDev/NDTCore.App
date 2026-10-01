package com.ndtcorepos.common;

/** Lỗi có mã dạng chuỗi; bridge reject Promise bằng mã này mà không cần biết lỗi thuộc tính năng nào. */
public abstract class CodedException extends Exception {

    protected CodedException(String message, Throwable cause) {
        super(message, cause);
    }

    /** Mã lỗi JS nhận được. */
    public abstract String code();
}
