package com.ndtcorepos.thermalprinter.transport.network;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;

public final class NetworkPrinterTransport implements IPrinterTransport {

    private Socket socket;

    @Override
    public void connect(PrinterConnection connection) throws PrinterException {
        String host = connection.getLanHost();
        int port = connection.getLanPort();

        if (isConnected() && socket.getInetAddress().getHostAddress().equals(host) && socket.getPort() == port) {
            return;
        }

        try {
            Socket newSocket = new Socket(host, port);
            if (!newSocket.isConnected()) {
                throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED,
                        "Unable to build connection with host: " + host + ", port: " + port);
            }
            disconnect();
            this.socket = newSocket;
        } catch (IOException e) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "Failed to connect printer: " + e.getMessage(), e);
        }
    }

    @Override
    public void write(PrinterData data) throws PrinterException {
        if (!isConnected()) {
            throw new PrinterException(PrinterErrorCode.DEVICE_NOT_CONNECTED,
                    "LAN connection is not built, may be you forgot to connectPrinter");
        }
        try {
            OutputStream out = socket.getOutputStream();
            out.write(data.getBytes());
            out.flush();
        } catch (IOException e) {
            throw new PrinterException(PrinterErrorCode.WRITE_FAILED, "Failed to write data: " + e.getMessage(), e);
        }
    }

    @Override
    public void disconnect() {
        if (socket != null && !socket.isClosed()) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
        socket = null;
    }

    @Override
    public boolean isConnected() {
        return socket != null && !socket.isClosed();
    }
}
