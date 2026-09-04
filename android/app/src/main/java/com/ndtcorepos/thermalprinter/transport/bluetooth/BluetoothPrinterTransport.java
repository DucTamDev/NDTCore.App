package com.ndtcorepos.thermalprinter.transport.bluetooth;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

public final class BluetoothPrinterTransport implements IPrinterTransport {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

    private BluetoothDevice device;
    private BluetoothSocket socket;
    private int pendingDrainBytes = -1;

    @Override
    public void connect(PrinterConnection target) throws PrinterException {
        if (!(target instanceof PrinterConnection.Bluetooth bluetooth)) {
            throw new PrinterException(PrinterErrorCode.UNSUPPORTED_CONNECTION,
                    "BluetoothPrinterTransport chỉ nhận PrinterConnection.Bluetooth");
        }
        String address = bluetooth.address();

        if (device != null && device.getAddress().equals(address) && isConnected()) {
            return;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "No bluetooth adapter available");
        }
        if (!adapter.isEnabled()) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "Bluetooth is not enabled");
        }

        BluetoothDevice bondedDevice = findBondedDevice(adapter, address);
        if (bondedDevice == null) {
            throw new PrinterException(PrinterErrorCode.DEVICE_NOT_FOUND,
                    "Can not find the specified printing device, please pair it in system Bluetooth settings first.");
        }

        disconnect();
        try {
            BluetoothSocket newSocket = openSocket(bondedDevice);
            this.device = bondedDevice;
            this.socket = newSocket;
        } catch (IOException e) {
            throw new PrinterException(PrinterErrorCode.CONNECTION_FAILED, "Failed to connect bluetooth printer: " + e.getMessage(), e);
        }
    }

    private BluetoothDevice findBondedDevice(BluetoothAdapter adapter, String address) {
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        for (BluetoothDevice candidate : bonded) {
            if (candidate.getAddress().equals(address)) {
                return candidate;
            }
        }
        return null;
    }

    private BluetoothSocket openSocket(BluetoothDevice target) throws IOException {
        BluetoothSocket socket = target.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            socket.connect();
            return socket;
        } catch (IOException e) {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            BluetoothSocket retrySocket = target.createRfcommSocketToServiceRecord(SPP_UUID);
            retrySocket.connect();
            return retrySocket;
        }
    }

    @Override
    public void write(PrinterData data) throws PrinterException {
        if (!isConnected()) {
            throw new PrinterException(PrinterErrorCode.DEVICE_NOT_CONNECTED,
                    "Bluetooth connection is not built, may be you forgot to connectPrinter");
        }
        try {
            byte[] bytes = data.getBytes();
            OutputStream out = socket.getOutputStream();
            out.write(bytes);
            out.flush();
            pendingDrainBytes = bytes.length;
        } catch (IOException e) {
            throw new PrinterException(PrinterErrorCode.WRITE_FAILED, "Failed to write data: " + e.getMessage(), e);
        }
    }

    @Override
    public void disconnect() {
        if (socket != null) {
            if (pendingDrainBytes >= 0) {
                sleepForDrain(pendingDrainBytes);
                pendingDrainBytes = -1;
            }
            try {
                socket.close();
            } catch (IOException ignored) {
            }
            socket = null;
        }
        device = null;
    }

    private void sleepForDrain(int bytes) {
        try {
            Thread.sleep(bytes <= 2000 ? 100 : bytes / 5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public boolean isConnected() {
        return socket != null && socket.isConnected();
    }
}
