package com.ndtcorepos.thermalprinter.module;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import com.ndtcorepos.thermalprinter.device.PrinterDeviceManager;
import com.ndtcorepos.thermalprinter.device.PrinterDeviceRegistry;
import com.ndtcorepos.thermalprinter.device.usb.UsbPrinterDevice;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.identity.usb.UsbConnectionIdentityResolver;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.queue.PrinterQueueManager;

import java.util.List;
import java.util.concurrent.Future;

/**
 * React Native bridge for the native thermal printer layer.
 *
 * The module exposes transport operations only:
 *
 * - device discovery
 * - permission state
 * - connection lifecycle
 * - raw byte transmission
 * - connection state
 *
 * Printer protocols, rendering, encoding, printer type, and paper
 * configuration remain outside the native Android layer.
 */
public final class ThermalPrinterModule
        extends ReactContextBaseJavaModule {

    /**
     * React Native module name exposed to JavaScript.
     */
    private static final String MODULE_NAME =
            "ThermalPrinterModule";

    /**
     * React application context used by native printer services.
     */
    private final ReactApplicationContext reactContext;

    /**
     * Android USB manager used for USB device operations.
     */
    private final UsbManager usbManager;

    /**
     * USB discovery service.
     */
    private final UsbPrinterDiscovery usbDiscovery;

    /**
     * USB connection identity resolver.
     */
    private final UsbConnectionIdentityResolver usbIdentityResolver;

    /**
     * Runtime device manager.
     */
    private final PrinterDeviceManager deviceManager;

    /**
     * Runtime printer queue manager.
     */
    private final PrinterQueueManager queueManager;


    /**
     * Creates the React Native printer module.
     *
     * @param reactContext React application context
     */
    public ThermalPrinterModule(
            ReactApplicationContext reactContext
    ) {
        super(reactContext);

        this.reactContext = reactContext;

        this.usbManager =
                (UsbManager) reactContext.getSystemService(
                        Context.USB_SERVICE
                );

        this.usbDiscovery =
                new UsbPrinterDiscovery(
                        reactContext
                );

        this.usbIdentityResolver =
                new UsbConnectionIdentityResolver();

        this.deviceManager =
                new PrinterDeviceManager(
                        new PrinterDeviceRegistry()
                );

        this.queueManager =
                new PrinterQueueManager();
    }


    /**
     * Returns the name used to register this module with React Native.
     *
     * @return module name
     */
    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }


    /**
     * Discovers currently connected USB printer devices.
     *
     * The result contains transport-neutral device descriptors.
     *
     * @param promise React Native promise receiving the device array
     */
    @ReactMethod
    public void discoverDevices(
            Promise promise
    ) {
        try {
            List<PrinterDescriptor> devices =
                    usbDiscovery.discover();

            WritableArray result =
                    Arguments.createArray();

            for (PrinterDescriptor device : devices) {
                result.pushMap(
                        toWritableMap(device)
                );
            }

            promise.resolve(result);

        } catch (Exception exception) {
            promise.reject(
                    "DISCOVERY_FAILED",
                    exception
            );
        }
    }


    /**
     * Returns the currently connected USB devices.
     *
     * This method is intentionally equivalent to discovery for the current
     * baseline because native runtime registration is separate from physical
     * device discovery.
     *
     * @param promise React Native promise receiving the device array
     */
    @ReactMethod
    public void getDevices(
            Promise promise
    ) {
        discoverDevices(promise);
    }


    /**
     * Checks whether Android has permission to access a USB device.
     *
     * @param deviceName Android USB device name
     * @param promise React Native promise receiving the permission state
     */
    @ReactMethod
    public void hasPermission(
            String deviceName,
            Promise promise
    ) {
        UsbDevice device =
                findUsbDevice(deviceName);

        if (device == null) {
            promise.resolve(false);
            return;
        }

        promise.resolve(
                usbManager.hasPermission(device)
        );
    }


    /**
     * Opens a USB printer runtime for the specified device.
     *
     * Permission must already have been granted before opening.
     *
     * @param deviceName Android USB device name
     * @param promise React Native promise receiving the operation result
     */
    @ReactMethod
    public void open(
            String deviceName,
            Promise promise
    ) {
        try {
            UsbDevice usbDevice =
                    findUsbDevice(deviceName);

            if (usbDevice == null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.failure(
                                        PrinterErrorCode.DEVICE_NOT_FOUND,
                                        0
                                )
                        )
                );

                return;
            }

            if (!usbManager.hasPermission(usbDevice)) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.failure(
                                        PrinterErrorCode.PERMISSION_DENIED,
                                        0
                                )
                        )
                );

                return;
            }

            PrinterDescriptor descriptor =
                    findDescriptor(deviceName);

            if (descriptor == null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.failure(
                                        PrinterErrorCode.DEVICE_NOT_FOUND,
                                        0
                                )
                        )
                );

                return;
            }

            ConnectionIdentity identity =
                    usbIdentityResolver.resolve(
                            descriptor
                    );

            if (deviceManager.get(identity) != null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.success(0)
                        )
                );

                return;
            }

            UsbInterface usbInterface =
                    findPrinterInterface(usbDevice);

            if (usbInterface == null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.failure(
                                        PrinterErrorCode.INVALID_ENDPOINT,
                                        0
                                )
                        )
                );

                return;
            }

            com.ndtcorepos.thermalprinter.connection.usb.UsbConnection connection =
                    new com.ndtcorepos.thermalprinter.connection.usb.UsbConnection(
                            usbManager,
                            usbDevice,
                            usbInterface
                    );

            UsbPrinterDevice device =
                    new UsbPrinterDevice(
                            identity,
                            connection,
                            new com.ndtcorepos.thermalprinter.writer.usb.UsbEndpointResolver()
                    );

            PrinterWriteResult result =
                    device.open();

            if (result.isSuccess()) {
                deviceManager.register(device);
            }

            promise.resolve(
                    toWritableMap(result)
            );

        } catch (Exception exception) {
            promise.reject(
                    "OPEN_FAILED",
                    exception
            );
        }
    }


    /**
     * Writes raw bytes to a printer.
     *
     * The native layer treats the byte array as opaque data.
     *
     * @param deviceName Android USB device name
     * @param data React Native byte array
     * @param promise React Native promise receiving the write result
     */
    @ReactMethod
    public void writeBytes(
            String deviceName,
            ReadableArray data,
            Promise promise
    ) {
        try {
            UsbDevice usbDevice =
                    findUsbDevice(deviceName);

            if (usbDevice == null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.failure(
                                        PrinterErrorCode.DEVICE_NOT_FOUND,
                                        0
                                )
                        )
                );

                return;
            }

            PrinterDescriptor descriptor =
                    findDescriptor(deviceName);

            if (descriptor == null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.failure(
                                        PrinterErrorCode.DEVICE_NOT_FOUND,
                                        0
                                )
                        )
                );

                return;
            }

            ConnectionIdentity identity =
                    usbIdentityResolver.resolve(
                            descriptor
                    );

            com.ndtcorepos.thermalprinter.device.IPrinterDevice device =
                    deviceManager.get(identity);

            if (device == null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.failure(
                                        PrinterErrorCode.CONNECTION_CLOSED,
                                        0
                                )
                        )
                );

                return;
            }

            byte[] bytes =
                    toByteArray(data);

            Future<PrinterWriteResult> future =
                    queueManager.submit(
                            device,
                            bytes
                    );

            PrinterWriteResult result =
                    future.get();

            promise.resolve(
                    toWritableMap(result)
            );

        } catch (Exception exception) {
            promise.reject(
                    "WRITE_FAILED",
                    exception
            );
        }
    }


    /**
     * Closes a USB printer runtime and removes it from the device manager.
     *
     * @param deviceName Android USB device name
     * @param promise React Native promise receiving the operation result
     */
    @ReactMethod
    public void close(
            String deviceName,
            Promise promise
    ) {
        try {
            PrinterDescriptor descriptor =
                    findDescriptor(deviceName);

            if (descriptor == null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.failure(
                                        PrinterErrorCode.DEVICE_NOT_FOUND,
                                        0
                                )
                        )
                );

                return;
            }

            ConnectionIdentity identity =
                    usbIdentityResolver.resolve(
                            descriptor
                    );

            com.ndtcorepos.thermalprinter.device.IPrinterDevice device =
                    deviceManager.get(identity);

            if (device == null) {
                promise.resolve(
                        toWritableMap(
                                PrinterWriteResult.success(0)
                        )
                );

                return;
            }

            PrinterWriteResult result =
                    device.close();

            queueManager.remove(identity);

            deviceManager.remove(identity);

            promise.resolve(
                    toWritableMap(result)
            );

        } catch (Exception exception) {
            promise.reject(
                    "CLOSE_FAILED",
                    exception
            );
        }
    }


    /**
     * Returns whether the specified USB printer runtime is connected.
     *
     * @param deviceName Android USB device name
     * @param promise React Native promise receiving the connection state
     */
    @ReactMethod
    public void isConnected(
            String deviceName,
            Promise promise
    ) {
        PrinterDescriptor descriptor =
                findDescriptor(deviceName);

        if (descriptor == null) {
            promise.resolve(false);
            return;
        }

        ConnectionIdentity identity =
                usbIdentityResolver.resolve(
                        descriptor
                );

        com.ndtcorepos.thermalprinter.device.IPrinterDevice device =
                deviceManager.get(identity);

        promise.resolve(
                device != null
                        && device.getState()
                        == ConnectionState.CONNECTED
        );
    }


    /**
     * Returns the current runtime connection state.
     *
     * @param deviceName Android USB device name
     * @param promise React Native promise receiving the state
     */
    @ReactMethod
    public void getConnectionState(
            String deviceName,
            Promise promise
    ) {
        PrinterDescriptor descriptor =
                findDescriptor(deviceName);

        if (descriptor == null) {
            promise.resolve(
                    ConnectionState.DISCONNECTED.name()
            );

            return;
        }

        ConnectionIdentity identity =
                usbIdentityResolver.resolve(
                        descriptor
                );

        com.ndtcorepos.thermalprinter.device.IPrinterDevice device =
                deviceManager.get(identity);

        if (device == null) {
            promise.resolve(
                    ConnectionState.DISCONNECTED.name()
            );

            return;
        }

        promise.resolve(
                device.getState().name()
        );
    }


    /**
     * Finds an Android USB device by its device name.
     *
     * @param deviceName Android USB device name
     * @return USB device or null
     */
    private UsbDevice findUsbDevice(
            String deviceName
    ) {
        for (UsbDevice device :
                usbManager.getDeviceList().values()) {

            if (device.getDeviceName().equals(deviceName)) {
                return device;
            }
        }

        return null;
    }


    /**
     * Finds a printer descriptor by Android USB device name.
     *
     * @param deviceName Android USB device name
     * @return descriptor or null
     */
    private PrinterDescriptor findDescriptor(
            String deviceName
    ) {
        for (PrinterDescriptor descriptor :
                usbDiscovery.discover()) {

            if (deviceName.equals(
                    descriptor.getDeviceName()
            )) {
                return descriptor;
            }
        }

        return null;
    }


    /**
     * Finds the USB interface containing printer endpoints.
     *
     * @param device Android USB device
     * @return printer interface or null
     */
    private UsbInterface findPrinterInterface(
            UsbDevice device
    ) {
        for (int index = 0;
             index < device.getInterfaceCount();
             index++) {

            UsbInterface usbInterface =
                    device.getInterface(index);

            if (usbInterface.getEndpointCount() > 0) {
                return usbInterface;
            }
        }

        return null;
    }


    /**
     * Converts a React Native byte array into a Java byte array.
     *
     * React Native ReadableArray stores numeric values as doubles,
     * therefore each value is explicitly converted to one unsigned byte.
     *
     * @param data React Native byte array
     * @return Java byte array
     */
    private byte[] toByteArray(
            ReadableArray data
    ) {
        byte[] bytes =
                new byte[data.size()];

        for (int index = 0;
             index < data.size();
             index++) {

            bytes[index] =
                    (byte) data.getInt(index);
        }

        return bytes;
    }


    /**
     * Converts a printer descriptor into a React Native map.
     *
     * @param descriptor printer descriptor
     * @return writable React Native map
     */
    private WritableMap toWritableMap(
            PrinterDescriptor descriptor
    ) {
        WritableMap map =
                Arguments.createMap();

        map.putString(
                "connectionType",
                descriptor.getConnectionType().name()
        );

        map.putString(
                "deviceName",
                descriptor.getDeviceName()
        );

        putNullableString(
                map,
                "manufacturer",
                descriptor.getManufacturer()
        );

        putNullableString(
                map,
                "productName",
                descriptor.getProductName()
        );

        putNullableString(
                map,
                "serialNumber",
                descriptor.getSerialNumber()
        );

        if (descriptor.getVendorId() != null) {
            map.putInt(
                    "vendorId",
                    descriptor.getVendorId()
            );
        }

        if (descriptor.getProductId() != null) {
            map.putInt(
                    "productId",
                    descriptor.getProductId()
            );
        }

        putNullableString(
                map,
                "address",
                descriptor.getAddress()
        );

        if (descriptor.getPort() != null) {
            map.putInt(
                    "port",
                    descriptor.getPort()
            );
        }

        return map;
    }


    /**
     * Converts a printer operation result into a React Native map.
     *
     * @param result printer operation result
     * @return writable React Native map
     */
    private WritableMap toWritableMap(
            PrinterWriteResult result
    ) {
        WritableMap map =
                Arguments.createMap();

        map.putBoolean(
                "success",
                result.isSuccess()
        );

        map.putString(
                "errorCode",
                result.getErrorCode().name()
        );

        map.putInt(
                "bytesWritten",
                result.getBytesWritten()
        );

        return map;
    }


    /**
     * Writes a nullable string into a React Native map.
     *
     * @param map target React Native map
     * @param key map key
     * @param value nullable string value
     */
    private void putNullableString(
            WritableMap map,
            String key,
            String value
    ) {
        if (value != null) {
            map.putString(key, value);
        } else {
            map.putNull(key);
        }
    }
}
