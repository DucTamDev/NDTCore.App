package com.ndtcorepos.thermalprinter.module;

import android.bluetooth.BluetoothAdapter;
import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;

import com.ndtcorepos.thermalprinter.application.PrinterService;
import com.ndtcorepos.thermalprinter.application.TransportResolver;
import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.bluetooth.BluetoothPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.model.PrinterDevice;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.transport.IPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.bluetooth.BluetoothPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.network.NetworkPrinterTransport;
import com.ndtcorepos.thermalprinter.transport.usb.UsbPrinterTransport;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * RN bridge duy nhất cho printer — Callback boundary. Từ PrinterService trở
 * xuống không còn biết React Native tồn tại (return/throw PrinterException).
 */
public class ThermalPrinterModule extends ReactContextBaseJavaModule {

    private final PrinterService printerService;
    private final UsbPermission usbPermission;
    private boolean usbPermissionRegistered = false;

    public ThermalPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);

        this.usbPermission = new UsbPermission(reactContext);

        Map<ConnectionType, IPrinterTransport> transports = new EnumMap<>(ConnectionType.class);
        transports.put(ConnectionType.USB, new UsbPrinterTransport(reactContext, usbPermission));
        transports.put(ConnectionType.BLUETOOTH, new BluetoothPrinterTransport());
        transports.put(ConnectionType.LAN, new NetworkPrinterTransport());

        Map<ConnectionType, IPrinterDiscovery> discoveries = new EnumMap<>(ConnectionType.class);
        discoveries.put(ConnectionType.USB, new UsbPrinterDiscovery(reactContext));
        discoveries.put(ConnectionType.BLUETOOTH, new BluetoothPrinterDiscovery());

        this.printerService = new PrinterService(new TransportResolver(transports), discoveries);
    }

    @Override
    public String getName() {
        return "ThermalPrinterModule";
    }

    @ReactMethod
    public void init(String connectionType, Callback successCallback, Callback errorCallback) {
        try {
            ConnectionType type = ConnectionType.fromWireValue(connectionType);
            if (type == ConnectionType.USB) {
                if (!usbPermissionRegistered) {
                    usbPermission.register();
                    usbPermissionRegistered = true;
                }
            } else if (type == ConnectionType.BLUETOOTH) {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    errorCallback.invoke("No bluetooth adapter available");
                    return;
                }
                if (!adapter.isEnabled()) {
                    errorCallback.invoke("bluetooth adapter is not enabled");
                    return;
                }
            }
            successCallback.invoke();
        } catch (Exception e) {
            errorCallback.invoke(e.getMessage());
        }
    }

    @ReactMethod
    public void getDeviceList(String connectionType, Callback successCallback, Callback errorCallback) {
        try {
            ConnectionType type = ConnectionType.fromWireValue(connectionType);
            List<PrinterDevice> devices = printerService.discover(type);
            if (devices.isEmpty()) {
                errorCallback.invoke("No Device Found");
                return;
            }
            WritableArray result = Arguments.createArray();
            for (PrinterDevice device : devices) {
                result.pushMap(device.toWritableMap());
            }
            successCallback.invoke(result);
        } catch (PrinterException e) {
            errorCallback.invoke(e.getMessage());
        }
    }

    @ReactMethod
    public void connectPrinter(ReadableMap connection, Callback successCallback, Callback errorCallback) {
        try {
            printerService.connect(toPrinterConnection(connection));
            successCallback.invoke(Arguments.createMap());
        } catch (PrinterException e) {
            errorCallback.invoke(e.getMessage());
        }
    }

    @ReactMethod
    public void closeConn(String connectionType) {
        try {
            printerService.disconnect(ConnectionType.fromWireValue(connectionType));
        } catch (PrinterException ignored) {
        }
    }

    @ReactMethod
    public void printRawData(String connectionType, String base64Data, Boolean keepConnection,
            Callback successCallback, Callback errorCallback) {
        new Thread(() -> {
            try {
                ConnectionType type = ConnectionType.fromWireValue(connectionType);
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                printerService.write(type, new PrinterData(bytes), keepConnection);
                successCallback.invoke("Print SuccessFully");
            } catch (PrinterException e) {
                errorCallback.invoke(e.getMessage());
            } catch (IllegalArgumentException e) {
                errorCallback.invoke("Invalid base64 data: " + e.getMessage());
            }
        }).start();
    }

    private PrinterConnection toPrinterConnection(ReadableMap connection) {
        ConnectionType type = ConnectionType.fromWireValue(connection.getString("type"));
        switch (type) {
            case USB:
                return PrinterConnection.usb(connection.getInt("vendorId"), connection.getInt("productId"));
            case BLUETOOTH:
                return PrinterConnection.bluetooth(connection.getString("innerAddress"));
            case LAN:
                return PrinterConnection.lan(connection.getString("host"), connection.getInt("port"));
            default:
                throw new IllegalArgumentException("Unsupported connection type: " + type);
        }
    }
}
