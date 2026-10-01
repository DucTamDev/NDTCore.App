package com.ndtcorepos.common;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;

import org.junit.Test;

public class CodedExceptionTest {

    private static final class SampleException extends CodedException {

        private SampleException(String message, Throwable cause) {
            super(message, cause);
        }

        @Override
        public String code() {
            return "SAMPLE_CODE";
        }
    }

    @Test
    public void keepsCodeMessageAndCause() {
        IllegalStateException cause = new IllegalStateException("gốc");

        CodedException exception = new SampleException("thông báo", cause);

        assertEquals("SAMPLE_CODE", exception.code());
        assertEquals("thông báo", exception.getMessage());
        assertSame(cause, exception.getCause());
    }
}
