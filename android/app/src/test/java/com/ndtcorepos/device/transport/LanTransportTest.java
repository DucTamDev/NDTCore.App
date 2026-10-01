package com.ndtcorepos.device.transport;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class LanTransportTest {

    private static final String LOOPBACK_HOST = "127.0.0.1";

    private static final long READ_DEADLINE_MS = 300;

    private static final int READ_BUFFER_BYTES = 64;

    private ServerSocket server;

    private ScheduledExecutorService timer;

    private LanTransport transport;

    @Before
    public void setUp() throws Exception {
        server = new ServerSocket(0);
        timer = Executors.newSingleThreadScheduledExecutor();
        transport = new LanTransport(LOOPBACK_HOST, server.getLocalPort(), timer);
    }

    @After
    public void tearDown() throws Exception {
        transport.abort();
        server.close();
        timer.shutdownNow();
    }

    @Test
    public void readWithoutDataReturnsEmptyAtDeadline() throws Exception {
        transport.open();
        Socket accepted = server.accept();

        try {
            byte[] received = transport.read(READ_BUFFER_BYTES, deadlineIn(READ_DEADLINE_MS));

            assertEquals(0, received.length);
            assertTrue(transport.isOpen());
        } finally {
            accepted.close();
        }
    }

    @Test
    public void peerCloseIsReadFailedAndTransportIsNoLongerOpen() throws Exception {
        transport.open();
        server.accept().close();

        try {
            transport.read(READ_BUFFER_BYTES, deadlineIn(READ_DEADLINE_MS));
            fail("Mong đợi READ_FAILED");
        } catch (DeviceException failure) {
            assertEquals(DeviceErrorCode.READ_FAILED, failure.errorCode());
        }

        assertFalse(transport.isOpen());
    }

    private static long deadlineIn(long millis) {
        return System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(millis);
    }
}
