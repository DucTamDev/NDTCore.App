package com.ndtcorepos.thermalprinter.module;

import android.bluetooth.BluetoothAdapter;
import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;

import com.ndtcorepos.thermalprinter.application.PrinterService;
import com.ndtcorepos.thermalprinter.application.PrinterServiceFactory;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.model.IPrinterDevice;
import com.ndtcorepos.thermalprinter.model.PrinterConnection;
import com.ndtcorepos.thermalprinter.model.PrinterData;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;

import java.util.List;

/**
 * RN bridge duy nhất cho printer — Promise boundary. Từ PrinterService trở
 * xuống không còn biết React Native tồn tại (return/throw PrinterException).
 */
public class ThermalPrinterModule extends ReactContextBaseJavaModule {

    private final PrinterService printerService;
    private final UsbPermission usbPermission;
    private boolean usbPermissionRegistered = false;

    public ThermalPrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.usbPermission = new UsbPermission(reactContext);
        this.printerService = PrinterServiceFactory.create(reactContext, usbPermission);
    }

    @Override
    public String getName() {
        return "ThermalPrinterModule";
    }

    @ReactMethod
    public void init(String connectionType, Promise promise) {
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
                    new PrinterErrorResult(PrinterErrorCode.CONNECTION_FAILED, "No bluetooth adapter available").rejectTo(promise);
                    return;
                }
                if (!adapter.isEnabled()) {
                    new PrinterErrorResult(PrinterErrorCode.CONNECTION_FAILED, "bluetooth adapter is not enabled").rejectTo(promise);
                    return;
                }
            }
            promise.resolve(null);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        } catch (Exception e) {
            new PrinterErrorResult(PrinterErrorCode.CONNECTION_FAILED, e.getMessage()).rejectTo(promise);
        }
    }

    @ReactMethod
    public void getDeviceList(String connectionType, Promise promise) {
        try {
            ConnectionType type = ConnectionType.fromWireValue(connectionType);
            List<IPrinterDevice> devices = printerService.discover(type);
            if (devices.isEmpty()) {
                new PrinterErrorResult(PrinterErrorCode.DEVICE_NOT_FOUND, "No Device Found").rejectTo(promise);
                return;
            }
            WritableArray result = Arguments.createArray();
            for (IPrinterDevice device : devices) {
                result.pushMap(device.toWritableMap());
            }
            promise.resolve(result);
        } catch (PrinterException e) {
            PrinterErrorResult.from(e).rejectTo(promise);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        }
    }

    /** RN method name: `connect` (cũ: `connectPrinter`). */
    @ReactMethod
    public void connect(ReadableMap connection, Promise promise) {
        try {
            printerService.connect(toPrinterConnection(connection));
            promise.resolve(Arguments.createMap());
        } catch (PrinterException e) {
            PrinterErrorResult.from(e).rejectTo(promise);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        }
    }

    /** RN method name: `disconnect` (cũ: `closeConn`). */
    @ReactMethod
    public void disconnect(String connectionType, Promise promise) {
        try {
            printerService.disconnect(ConnectionType.fromWireValue(connectionType));
            promise.resolve(null);
        } catch (PrinterException e) {
            PrinterErrorResult.from(e).rejectTo(promise);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
        }
    }

    /** RN method name: `writeByBase64` (cũ: `printRawData`). */
    @ReactMethod
    public void writeByBase64(String connectionType, String base64Data, Boolean keepConnection, Promise promise) {
        ConnectionType type;
        try {
            type = ConnectionType.fromWireValue(connectionType);
        } catch (IllegalArgumentException e) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, e.getMessage()).rejectTo(promise);
            return;
        }
        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                printerService.write(type, new PrinterData(bytes), keepConnection);
                promise.resolve("Print SuccessFully");
            } catch (PrinterException e) {
                PrinterErrorResult.from(e).rejectTo(promise);
            } catch (IllegalArgumentException e) {
                new PrinterErrorResult(PrinterErrorCode.INVALID_ARGUMENT, "Invalid print data: " + e.getMessage()).rejectTo(promise);
            } catch (Exception e) {
                new PrinterErrorResult(PrinterErrorCode.WRITE_FAILED, e.getMessage()).rejectTo(promise);
            }
        }).start();
    }

    private PrinterConnection toPrinterConnection(ReadableMap connection) {
        ConnectionType type = ConnectionType.fromWireValue(connection.getString("type"));
        return switch (type) {
            case USB -> new PrinterConnection.Usb(connection.getInt("vendorId"), connection.getInt("productId"));
            case BLUETOOTH -> new PrinterConnection.Bluetooth(connection.getString("innerAddress"));
            case LAN -> new PrinterConnection.Lan(connection.getString("host"), connection.getInt("port"));
        };
    }
}
