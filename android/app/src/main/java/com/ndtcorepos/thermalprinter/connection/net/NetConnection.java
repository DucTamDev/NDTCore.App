package com.ndtcorepos.thermalprinter.connection.net;

import com.ndtcorepos.thermalprinter.connection.IPrinterConnection;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

/** Manages the lifecycle of a TCP socket to one network printer. */
public final class NetConnection implements IPrinterConnection {

    private static final int CONNECT_TIMEOUT_MS = 5_000;

    private final String host;
    private final int port;
    private Socket socket;
    private ConnectionState state = ConnectionState.DISCONNECTED;

    public NetConnection(String host, int port) {
        this.host = host;
        this.port = port;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        if (isConnected()) {
            return PrinterWriteResult.success(0);
        }

        state = ConnectionState.CONNECTING;

        try {
            Socket newSocket = new Socket();
            newSocket.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
            socket = newSocket;
        } catch (IOException exception) {
            state = ConnectionState.DISCONNECTED;
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }

        state = ConnectionState.CONNECTED;
        return PrinterWriteResult.success(0);
    }

    public OutputStream getOutputStream() throws IOException {
        return socket.getOutputStream();
    }

    @Override
    public synchronized PrinterWriteResult close() {
        state = ConnectionState.CLOSING;

        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }

        state = ConnectionState.DISCONNECTED;
        return PrinterWriteResult.success(0);
    }

    @Override
    public synchronized ConnectionState getState() {
        return state;
    }

    @Override
    public synchronized boolean isConnected() {
        return state == ConnectionState.CONNECTED && socket != null && socket.isConnected() && !socket.isClosed();
    }
}
