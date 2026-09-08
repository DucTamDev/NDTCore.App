package com.ndtcorepos.thermalprinter.transport.net;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.exception.PrinterConnectionException;
import com.ndtcorepos.thermalprinter.printer.PrinterResult;
import com.ndtcorepos.thermalprinter.transport.PrinterConnection;

import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;
import java.util.concurrent.CompletableFuture;

/**
 * Quản lý vòng đời kết nối TCP tới printer mạng.
 */
public final class NetConnection implements PrinterConnection {

    private final String host;
    private final int port;
    private Socket socket;

    public NetConnection(String host, int port) {
        this.host = host;
        this.port = port;
    }

    /**
     * Mở socket TCP tới host/port đã cấu hình.
     */
    @Override
    public CompletableFuture<PrinterResult> open() {
        long startedAt = System.currentTimeMillis();
        closeQuietly();
        try {
            Socket newSocket = new Socket(host, port);
            if (!newSocket.isConnected()) {
                return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.NETWORK_CONNECTION_FAILED,
                        "Unable to build connection with host: " + host + ", port: " + port));
            }
            this.socket = newSocket;
        } catch (IOException e) {
            return CompletableFuture.failedFuture(new PrinterConnectionException(PrinterErrorCode.NETWORK_CONNECTION_FAILED,
                    "Failed to connect printer: " + e.getMessage(), e));
        }
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    OutputStream getOutputStream() throws IOException {
        return socket.getOutputStream();
    }

    private void closeQuietly() {
        if (socket != null && !socket.isClosed()) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
        socket = null;
    }

    /**
     * Đóng socket TCP.
     */
    @Override
    public CompletableFuture<PrinterResult> close() {
        long startedAt = System.currentTimeMillis();
        closeQuietly();
        return CompletableFuture.completedFuture(PrinterResult.success(System.currentTimeMillis() - startedAt));
    }

    /**
     * Socket có đang kết nối không.
     */
    @Override
    public boolean isOpen() {
        return socket != null && !socket.isClosed();
    }
}
