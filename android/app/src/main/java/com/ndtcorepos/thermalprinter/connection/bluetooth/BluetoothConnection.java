package com.ndtcorepos.thermalprinter.connection.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.ndtcorepos.thermalprinter.connection.IPrinterConnection;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/** Manages the lifecycle of an RFCOMM Bluetooth socket to one bonded printer. */
public final class BluetoothConnection implements IPrinterConnection {

    private static final UUID SPP_UUID =
            UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

    private final String address;
    private BluetoothSocket socket;
    private ConnectionState state = ConnectionState.DISCONNECTED;
    private int pendingDrainBytes = -1;

    public BluetoothConnection(String address) {
        this.address = address;
    }

    @Override
    public synchronized PrinterWriteResult open() {
        if (isConnected()) {
            return PrinterWriteResult.success(0);
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();

        if (adapter == null || !adapter.isEnabled()) {
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }

        BluetoothDevice bondedDevice = findBondedDevice(adapter);

        if (bondedDevice == null) {
            return PrinterWriteResult.failure(PrinterErrorCode.DEVICE_NOT_FOUND, 0);
        }

        state = ConnectionState.CONNECTING;

        try {
            socket = openSocket(bondedDevice);
        } catch (IOException exception) {
            state = ConnectionState.DISCONNECTED;
            return PrinterWriteResult.failure(PrinterErrorCode.CONNECTION_FAILED, 0);
        }

        state = ConnectionState.CONNECTED;
        return PrinterWriteResult.success(0);
    }

    /** Finds the bonded device matching this connection's address among paired devices. */
    private BluetoothDevice findBondedDevice(BluetoothAdapter adapter) {
        Set<BluetoothDevice> bonded;

        try {
            bonded = adapter.getBondedDevices();
        } catch (SecurityException exception) {
            return null;
        }

        for (BluetoothDevice candidate : bonded) {
            if (candidate.getAddress().equals(address)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Opens an RFCOMM socket and retries once with a fresh socket if the first
     * connect() attempt fails — some Bluetooth printers need a retry to complete
     * the handshake.
     */
    private BluetoothSocket openSocket(BluetoothDevice target) throws IOException {
        BluetoothSocket firstAttempt = target.createRfcommSocketToServiceRecord(SPP_UUID);

        try {
            firstAttempt.connect();
            return firstAttempt;
        } catch (IOException firstFailure) {
            try {
                firstAttempt.close();
            } catch (IOException ignored) {
            }

            BluetoothSocket retry = target.createRfcommSocketToServiceRecord(SPP_UUID);
            retry.connect();
            return retry;
        }
    }

    public OutputStream getOutputStream() throws IOException {
        return socket.getOutputStream();
    }

    /** Records the byte count of the last write so close() can wait for RFCOMM to drain. */
    public void markPendingDrain(int bytes) {
        this.pendingDrainBytes = bytes;
    }

    @Override
    public synchronized PrinterWriteResult close() {
        state = ConnectionState.CLOSING;

        if (socket != null && pendingDrainBytes >= 0) {
            sleepForDrain(pendingDrainBytes);
            pendingDrainBytes = -1;
        }

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

    /**
     * Blocks briefly before closing so recently written bytes have time to leave
     * the RFCOMM buffer — closing immediately after a write can truncate output.
     */
    private void sleepForDrain(int bytes) {
        try {
            Thread.sleep(bytes <= 2000 ? 100 : bytes / 5);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public synchronized ConnectionState getState() {
        return state;
    }

    @Override
    public synchronized boolean isConnected() {
        return state == ConnectionState.CONNECTED && socket != null && socket.isConnected();
    }
}
