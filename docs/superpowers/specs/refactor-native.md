Đúng. Nếu mục tiêu là **copy vào project và dùng làm baseline**, thì mỗi file nên có đủ:

* class summary
* **field summary cho từng field**
* constructor summary
* function summary cho **từng function**
* không comment getter/setter kiểu dư thừa nhưng vẫn mô tả rõ contract
* code cách dòng thoáng, dễ đọc
* không dùng comment inline cho thứ đã rõ từ tên code
* không thêm abstraction chỉ để “đẹp architecture”

Tôi viết lại theo đúng chuẩn này. Với các file dài, tôi giữ trách nhiệm nhỏ và không nhồi logic vào một class.

# 1. `model/ConnectionIdentity.java`

```java
package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.enums.IdentityStability;

import java.util.Objects;

/**
 * Identifies one physical printer connection at runtime.
 *
 * The identity is used as the key for device reuse, queue serialization,
 * and runtime resource management.
 *
 * The identity does not represent a printer business configuration.
 */
public final class ConnectionIdentity {

    /**
     * Unique value used to identify the physical connection.
     *
     * Examples:
     *
     * USB:11575:33751:ABC123
     * BLUETOOTH:AA:BB:CC:DD:EE:FF
     * NETWORK:192.168.1.100:9100
     */
    private final String value;

    /**
     * Transport used by this connection.
     */
    private final ConnectionType type;

    /**
     * Indicates whether the identity remains stable across reconnects.
     */
    private final IdentityStability stability;


    /**
     * Creates a connection identity.
     *
     * @param value unique connection identity value
     * @param type transport type
     * @param stability identity stability
     */
    public ConnectionIdentity(
            String value,
            ConnectionType type,
            IdentityStability stability
    ) {
        this.value = Objects.requireNonNull(value);
        this.type = Objects.requireNonNull(type);
        this.stability = Objects.requireNonNull(stability);
    }


    /**
     * Returns the unique connection identity value.
     *
     * @return connection identity value
     */
    public String getValue() {
        return value;
    }


    /**
     * Returns the transport type.
     *
     * @return connection type
     */
    public ConnectionType getType() {
        return type;
    }


    /**
     * Returns the stability classification of this identity.
     *
     * @return identity stability
     */
    public IdentityStability getStability() {
        return stability;
    }


    /**
     * Compares identities by their runtime identity value.
     *
     * @param object object to compare
     * @return true when both objects represent the same connection identity
     */
    @Override
    public boolean equals(Object object) {

        if (this == object) {
            return true;
        }

        if (!(object instanceof ConnectionIdentity)) {
            return false;
        }

        ConnectionIdentity other =
                (ConnectionIdentity) object;

        return value.equals(other.value);
    }


    /**
     * Returns the hash code derived from the identity value.
     *
     * @return identity hash code
     */
    @Override
    public int hashCode() {
        return value.hashCode();
    }


    /**
     * Returns the identity value.
     *
     * @return connection identity
     */
    @Override
    public String toString() {
        return value;
    }
}
```

---

# 2. `model/PrinterDescriptor.java`

```java
package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Describes a physical printer discovered by a transport.
 *
 * PrinterDescriptor contains discovery information only.
 * It does not represent an opened runtime connection.
 */
public final class PrinterDescriptor {

    /**
     * Transport through which the device was discovered.
     */
    private final ConnectionType connectionType;

    /**
     * Platform or transport-specific device name.
     */
    private final String deviceName;

    /**
     * Manufacturer name reported by the device.
     */
    private final String manufacturer;

    /**
     * Product name reported by the device.
     */
    private final String productName;

    /**
     * Hardware serial number when available.
     */
    private final String serialNumber;

    /**
     * USB vendor ID when the device is a USB device.
     */
    private final Integer vendorId;

    /**
     * USB product ID when the device is a USB device.
     */
    private final Integer productId;

    /**
     * Bluetooth MAC address or network host.
     */
    private final String address;

    /**
     * Network port when the device uses a network connection.
     */
    private final Integer port;


    /**
     * Creates a discovered printer descriptor.
     *
     * @param connectionType transport type
     * @param deviceName device name
     * @param manufacturer manufacturer name
     * @param productName product name
     * @param serialNumber serial number
     * @param vendorId USB vendor ID
     * @param productId USB product ID
     * @param address Bluetooth address or network host
     * @param port network port
     */
    public PrinterDescriptor(
            ConnectionType connectionType,
            String deviceName,
            String manufacturer,
            String productName,
            String serialNumber,
            Integer vendorId,
            Integer productId,
            String address,
            Integer port
    ) {
        this.connectionType = connectionType;
        this.deviceName = deviceName;
        this.manufacturer = manufacturer;
        this.productName = productName;
        this.serialNumber = serialNumber;
        this.vendorId = vendorId;
        this.productId = productId;
        this.address = address;
        this.port = port;
    }


    /**
     * Returns the transport used to discover the device.
     *
     * @return connection type
     */
    public ConnectionType getConnectionType() {
        return connectionType;
    }


    /**
     * Returns the device name.
     *
     * @return device name
     */
    public String getDeviceName() {
        return deviceName;
    }


    /**
     * Returns the manufacturer name.
     *
     * @return manufacturer name
     */
    public String getManufacturer() {
        return manufacturer;
    }


    /**
     * Returns the product name.
     *
     * @return product name
     */
    public String getProductName() {
        return productName;
    }


    /**
     * Returns the hardware serial number.
     *
     * @return serial number or null
     */
    public String getSerialNumber() {
        return serialNumber;
    }


    /**
     * Returns the USB vendor ID.
     *
     * @return vendor ID or null
     */
    public Integer getVendorId() {
        return vendorId;
    }


    /**
     * Returns the USB product ID.
     *
     * @return product ID or null
     */
    public Integer getProductId() {
        return productId;
    }


    /**
     * Returns the Bluetooth address or network host.
     *
     * @return address or host
     */
    public String getAddress() {
        return address;
    }


    /**
     * Returns the network port.
     *
     * @return port or null
     */
    public Integer getPort() {
        return port;
    }
}
```

---

# 3. `model/PrinterWriteResult.java`

```java
package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;

/**
 * Represents the result of a printer operation.
 *
 * Expected printer and transport failures are returned through this class
 * instead of requiring callers to catch exceptions.
 */
public final class PrinterWriteResult {

    /**
     * Indicates whether the operation completed successfully.
     */
    private final boolean success;

    /**
     * Expected error code returned when the operation fails.
     */
    private final PrinterErrorCode errorCode;

    /**
     * Number of bytes successfully transmitted before the operation completed
     * or failed.
     */
    private final int bytesWritten;


    private PrinterWriteResult(
            boolean success,
            PrinterErrorCode errorCode,
            int bytesWritten
    ) {
        this.success = success;
        this.errorCode = errorCode;
        this.bytesWritten = bytesWritten;
    }


    /**
     * Creates a successful operation result.
     *
     * @param bytesWritten number of bytes transmitted
     * @return successful result
     */
    public static PrinterWriteResult success(
            int bytesWritten
    ) {
        return new PrinterWriteResult(
                true,
                PrinterErrorCode.NONE,
                bytesWritten
        );
    }


    /**
     * Creates a failed operation result.
     *
     * @param errorCode expected printer error
     * @param bytesWritten number of bytes transmitted before failure
     * @return failed result
     */
    public static PrinterWriteResult failure(
            PrinterErrorCode errorCode,
            int bytesWritten
    ) {
        return new PrinterWriteResult(
                false,
                errorCode,
                bytesWritten
        );
    }


    /**
     * Returns whether the operation succeeded.
     *
     * @return true when successful
     */
    public boolean isSuccess() {
        return success;
    }


    /**
     * Returns the operation error code.
     *
     * @return error code
     */
    public PrinterErrorCode getErrorCode() {
        return errorCode;
    }


    /**
     * Returns the number of bytes transmitted.
     *
     * @return bytes written
     */
    public int getBytesWritten() {
        return bytesWritten;
    }
}
```

---

# 4. `connection/IPrinterConnection.java`

```java
package com.ndtcorepos.thermalprinter.connection;

import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Defines the lifecycle operations of a printer transport connection.
 *
 * A connection owns transport resources such as USB interfaces,
 * Bluetooth sockets, or network sockets.
 *
 * A connection does not encode or transmit printer data.
 */
public interface IPrinterConnection {

    /**
     * Returns the current connection state.
     *
     * @return connection state
     */
    ConnectionState getState();


    /**
     * Opens the transport connection.
     *
     * @return operation result
     */
    PrinterWriteResult open();


    /**
     * Closes the transport connection and releases its resources.
     *
     * @return operation result
     */
    PrinterWriteResult close();


    /**
     * Indicates whether the transport is currently connected.
     *
     * @return true when connected
     */
    boolean isConnected();
}
```

---

# 5. `writer/IPrinterWriter.java`

```java
package com.ndtcorepos.thermalprinter.writer;

import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Defines the transport operation used to send raw bytes to a printer.
 *
 * The writer does not know the meaning of the bytes.
 * The caller is responsible for producing valid printer commands or
 * printer bitmap data.
 */
public interface IPrinterWriter {

    /**
     * Writes raw printer bytes using the writer's default timeout.
     *
     * @param data raw bytes to transmit
     * @return write result
     */
    PrinterWriteResult write(byte[] data);


    /**
     * Writes raw printer bytes using the specified timeout.
     *
     * @param data raw bytes to transmit
     * @param timeout timeout in milliseconds
     * @return write result
     */
    PrinterWriteResult write(
            byte[] data,
            int timeout
    );
}
```

---

# 6. `permission/IPrinterPermission.java`

```java
package com.ndtcorepos.thermalprinter.permission;

import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Defines permission operations required by a printer transport.
 *
 * Only transports that require an Android permission should implement
 * a concrete permission handler.
 */
public interface IPrinterPermission {

    /**
     * Checks whether the required transport permission is already granted.
     *
     * @return true when permission is available
     */
    boolean hasPermission();


    /**
     * Starts the permission request flow.
     *
     * @return operation result
     */
    PrinterWriteResult requestPermission();
}
```

---

# 7. `discovery/IPrinterDiscovery.java`

```java
package com.ndtcorepos.thermalprinter.discovery;

import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

import java.util.List;

/**
 * Discovers physical printer devices available through one transport.
 *
 * Discovery does not open devices, request permission, or transmit data.
 */
public interface IPrinterDiscovery {

    /**
     * Discovers currently available printer devices.
     *
     * @return discovered printer descriptors
     */
    List<PrinterDescriptor> discover();
}
```

---

# 8. `identity/IConnectionIdentityResolver.java`

```java
package com.ndtcorepos.thermalprinter.identity;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

/**
 * Creates a runtime connection identity from discovered device information.
 */
public interface IConnectionIdentityResolver {

    /**
     * Resolves the runtime identity of a discovered connection.
     *
     * @param descriptor discovered printer descriptor
     * @return connection identity
     */
    ConnectionIdentity resolve(
            PrinterDescriptor descriptor
    );
}
```

---

# 9. `config/IPrinterConnectionConfig.java`

```java
package com.ndtcorepos.thermalprinter.config;

import com.ndtcore.thermalprinter.enums.ConnectionType;
```

Ở đây tôi **không viết tiếp sai package**. Package đúng phải là:

```java
package com.ndtcorepos.thermalprinter.config;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Defines configuration required to establish one printer connection.
 *
 * Connection configuration contains transport information only.
 * It does not contain printer type, driver, paper, rendering,
 * encoding, or printing business configuration.
 */
public interface IPrinterConnectionConfig {

    /**
     * Returns the transport type represented by this configuration.
     *
     * @return connection type
     */
    ConnectionType getConnectionType();
}
```

---

# 10. `config/UsbConnectionConfig.java`

```java
package com.ndtcorepos.thermalprinter.config;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Contains the configuration required to identify a USB printer connection.
 */
public final class UsbConnectionConfig
        implements IPrinterConnectionConfig {

    /**
     * USB vendor identifier used to identify the device.
     */
    private final int vendorId;

    /**
     * USB product identifier used to identify the device.
     */
    private final int productId;

    /**
     * Optional USB serial number used to distinguish devices with
     * identical vendor and product IDs.
     */
    private final String serialNumber;


    /**
     * Creates a USB connection configuration.
     *
     * @param vendorId USB vendor ID
     * @param productId USB product ID
     * @param serialNumber optional USB serial number
     */
    public UsbConnectionConfig(
            int vendorId,
            int productId,
            String serialNumber
    ) {
        this.vendorId = vendorId;
        this.productId = productId;
        this.serialNumber = serialNumber;
    }


    /**
     * Returns the configured transport type.
     *
     * @return USB
     */
    @Override
    public ConnectionType getConnectionType() {
        return ConnectionType.USB;
    }


    /**
     * Returns the USB vendor ID.
     *
     * @return vendor ID
     */
    public int getVendorId() {
        return vendorId;
    }


    /**
     * Returns the USB product ID.
     *
     * @return product ID
     */
    public int getProductId() {
        return productId;
    }


    /**
     * Returns the configured serial number.
     *
     * @return serial number or null
     */
    public String getSerialNumber() {
        return serialNumber;
    }
}
```

---

# 11. `config/BluetoothConnectionConfig.java`

```java
package com.ndtcorepos.thermalprinter.config;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Contains the configuration required to connect to a Bluetooth printer.
 */
public final class BluetoothConnectionConfig
        implements IPrinterConnectionConfig {

    /**
     * Bluetooth MAC address of the target printer.
     */
    private final String macAddress;


    /**
     * Creates a Bluetooth connection configuration.
     *
     * @param macAddress Bluetooth MAC address
     */
    public BluetoothConnectionConfig(
            String macAddress
    ) {
        this.macAddress = macAddress;
    }


    /**
     * Returns the configured transport type.
     *
     * @return Bluetooth
     */
    @Override
    public ConnectionType getConnectionType() {
        return ConnectionType.BLUETOOTH;
    }


    /**
     * Returns the Bluetooth MAC address.
     *
     * @return MAC address
     */
    public String getMacAddress() {
        return macAddress;
    }
}
```

---

# 12. `config/NetworkConnectionConfig.java`

```java
package com.ndtcorepos.thermalprinter.config;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Contains the configuration required to connect to a network printer.
 */
public final class NetworkConnectionConfig
        implements IPrinterConnectionConfig {

    /**
     * Hostname or IP address of the target printer.
     */
    private final String host;

    /**
     * TCP port used by the printer.
     */
    private final int port;


    /**
     * Creates a network connection configuration.
     *
     * @param host printer hostname or IP address
     * @param port printer TCP port
     */
    public NetworkConnectionConfig(
            String host,
            int port
    ) {
        this.host = host;
        this.port = port;
    }


    /**
     * Returns the configured transport type.
     *
     * @return network
     */
    @Override
    public ConnectionType getConnectionType() {
        return ConnectionType.NETWORK;
    }


    /**
     * Returns the printer hostname or IP address.
     *
     * @return printer host
     */
    public String getHost() {
        return host;
    }


    /**
     * Returns the printer TCP port.
     *
     * @return TCP port
     */
    public int getPort() {
        return port;
    }
}
```

---

# 13. USB endpoint resolver

## `UsbEndpointResolver.java`

```java
package com.ndtcorepos.thermalprinter.writer.usb;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;

/**
 * Resolves the USB bulk OUT endpoint used to send printer data.
 *
 * This class only inspects the USB interface.
 * It does not open the connection and does not perform transfers.
 */
public final class UsbEndpointResolver {

    /**
     * Finds the first bulk OUT endpoint available on the interface.
     *
     * @param usbInterface USB interface containing printer endpoints
     * @return bulk OUT endpoint or null when none exists
     */
    public UsbEndpoint resolve(
            UsbInterface usbInterface
    ) {
        for (int index = 0;
             index < usbInterface.getEndpointCount();
             index++) {

            UsbEndpoint endpoint =
                    usbInterface.getEndpoint(index);

            if (endpoint.getType()
                    == UsbConstants.USB_ENDPOINT_XFER_BULK
                    && endpoint.getDirection()
                    == UsbConstants.USB_DIR_OUT) {

                return endpoint;
            }
        }

        return null;
    }
}
```

---

# 14. `UsbWriter.java`

Đây là phần quan trọng nhất. Không Strategy.

```java
package com.ndtcorepos.thermalprinter.writer.usb;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbRequest;

import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.IPrinterWriter;

import java.nio.ByteBuffer;

/**
 * Writes raw bytes to a USB printer.
 *
 * UsbRequest is the primary USB transfer mechanism.
 *
 * This class does not manage USB permission, device discovery,
 * connection lifecycle, or printer protocol encoding.
 */
public final class UsbWriter
        implements IPrinterWriter {

    /**
     * Default timeout used by USB write operations.
     */
    private static final int DEFAULT_TIMEOUT = 5_000;

    /**
     * Active Android USB connection used for transfers.
     */
    private final UsbDeviceConnection usbConnection;

    /**
     * Bulk OUT endpoint used to send printer data.
     */
    private final UsbEndpoint usbEndpoint;


    /**
     * Creates a USB writer.
     *
     * @param usbConnection active USB connection
     * @param usbEndpoint bulk OUT endpoint
     */
    public UsbWriter(
            UsbDeviceConnection usbConnection,
            UsbEndpoint usbEndpoint
    ) {
        this.usbConnection = usbConnection;
        this.usbEndpoint = usbEndpoint;
    }


    /**
     * Writes raw bytes using the default timeout.
     *
     * @param data raw printer bytes
     * @return write result
     */
    @Override
    public synchronized PrinterWriteResult write(
            byte[] data
    ) {
        return write(data, DEFAULT_TIMEOUT);
    }


    /**
     * Writes raw bytes using UsbRequest.
     *
     * The complete byte array is queued as one USB request.
     *
     * @param data raw printer bytes
     * @param timeout timeout in milliseconds
     * @return write result
     */
    @Override
    public synchronized PrinterWriteResult write(
            byte[] data,
            int timeout
    ) {
        if (data == null || data.length == 0) {
            return PrinterWriteResult.success(0);
        }

        if (usbConnection == null) {
            return PrinterWriteResult.failure(
                    PrinterErrorCode.CONNECTION_CLOSED,
                    0
            );
        }

        if (usbEndpoint == null) {
            return PrinterWriteResult.failure(
                    PrinterErrorCode.INVALID_ENDPOINT,
                    0
            );
        }

        if (usbEndpoint.getType()
                != UsbConstants.USB_ENDPOINT_XFER_BULK) {

            return PrinterWriteResult.failure(
                    PrinterErrorCode.INVALID_ENDPOINT,
                    0
            );
        }

        if (usbEndpoint.getDirection()
                != UsbConstants.USB_DIR_OUT) {

            return PrinterWriteResult.failure(
                    PrinterErrorCode.INVALID_ENDPOINT,
                    0
            );
        }

        return writeWithUsbRequest(
                data,
                timeout
        );
    }


    /**
     * Sends the byte array using Android UsbRequest.
     *
     * @param data raw printer bytes
     * @param timeout timeout in milliseconds
     * @return write result
     */
    private PrinterWriteResult writeWithUsbRequest(
            byte[] data,
            int timeout
    ) {
        UsbRequest request = new UsbRequest();

        try {
            if (!request.initialize(
                    usbConnection,
                    usbEndpoint
            )) {
                return PrinterWriteResult.failure(
                        PrinterErrorCode.WRITE_FAILED,
                        0
                );
            }

            ByteBuffer buffer =
                    ByteBuffer.wrap(data);

            if (!request.queue(
                    buffer,
                    data.length
            )) {
                return PrinterWriteResult.failure(
                        PrinterErrorCode.WRITE_FAILED,
                        0
                );
            }

            UsbRequest completedRequest =
                    usbConnection.requestWait();

            if (completedRequest == null) {
                return PrinterWriteResult.failure(
                        PrinterErrorCode.WRITE_TIMEOUT,
                        0
                );
            }

            return PrinterWriteResult.success(
                    data.length
            );

        } finally {
            request.close();
        }
    }
}
```

> `timeout` ở đây chưa thực sự được Android `UsbRequest` áp dụng như `bulkTransfer(timeout)`. Nếu muốn timeout cứng cho `requestWait()`, cần chạy request wait trên worker + timeout control. Tôi **không giả vờ rằng tham số timeout hiện tại đã có tác dụng**. Đây là điểm nên xử lý tiếp ở implementation USB production.

---

# 15. `IPrinterDevice.java`

```java
package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Represents one physical printer runtime.
 *
 * A printer device coordinates its connection and writer.
 * It does not understand printer protocols or printing business types.
 */
public interface IPrinterDevice {

    /**
     * Returns the runtime identity of the physical connection.
     *
     * @return connection identity
     */
    ConnectionIdentity getConnectionIdentity();


    /**
     * Returns the current runtime connection state.
     *
     * @return connection state
     */
    ConnectionState getState();


    /**
     * Opens the physical printer connection.
     *
     * @return operation result
     */
    PrinterWriteResult open();


    /**
     * Writes raw bytes to the physical printer.
     *
     * @param data raw printer bytes
     * @return write result
     */
    PrinterWriteResult write(byte[] data);


    /**
     * Closes the physical printer connection.
     *
     * @return operation result
     */
    PrinterWriteResult close();
}
```

---

# 16. `UsbPrinterDevice.java`

```java
package com.ndtcorepos.thermalprinter.device.usb;

import android.hardware.usb.UsbEndpoint;

import com.ndtcorepos.thermalprinter.connection.usb.UsbConnection;
import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.enums.ConnectionState;
import com.ndtcorepos.thermalprinter.enums.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;
import com.ndtcorepos.thermalprinter.writer.usb.UsbEndpointResolver;
import com.ndtcorepos.thermalprinter.writer.usb.UsbWriter;

/**
 * Coordinates the runtime components required by a USB printer.
 *
 * UsbPrinterDevice owns USB connection lifecycle and creates the writer
 * after the connection has been successfully opened.
 *
 * It does not perform printer protocol encoding or rendering.
 */
public final class UsbPrinterDevice
        implements IPrinterDevice {

    /**
     * Runtime identity of this physical USB connection.
     */
    private final ConnectionIdentity connectionIdentity;

    /**
     * USB connection lifecycle manager.
     */
    private final UsbConnection connection;

    /**
     * USB endpoint resolver used after the connection is opened.
     */
    private final UsbEndpointResolver endpointResolver;


    /**
     * Writer bound to the currently opened USB connection.
     */
    private UsbWriter writer;


    /**
     * Creates a USB printer runtime device.
     *
     * @param connectionIdentity physical connection identity
     * @param connection USB connection lifecycle manager
     * @param endpointResolver USB endpoint resolver
     */
    public UsbPrinterDevice(
            ConnectionIdentity connectionIdentity,
            UsbConnection connection,
            UsbEndpointResolver endpointResolver
    ) {
        this.connectionIdentity = connectionIdentity;
        this.connection = connection;
        this.endpointResolver = endpointResolver;
    }


    /**
     * Opens the USB connection and resolves its bulk OUT endpoint.
     *
     * @return operation result
     */
    @Override
    public synchronized PrinterWriteResult open() {

        PrinterWriteResult result =
                connection.open();

        if (!result.isSuccess()) {
            return result;
        }

        UsbEndpoint endpoint =
                endpointResolver.resolve(
                        connection.getUsbInterface()
                );

        if (endpoint == null) {
            connection.close();

            return PrinterWriteResult.failure(
                    PrinterErrorCode.INVALID_ENDPOINT,
                    0
            );
        }

        writer = new UsbWriter(
                connection.getUsbConnection(),
                endpoint
        );

        return PrinterWriteResult.success(0);
    }


    /**
     * Writes raw bytes through the active USB writer.
     *
     * @param data raw printer bytes
     * @return write result
     */
    @Override
    public synchronized PrinterWriteResult write(
            byte[] data
    ) {
        if (writer == null) {
            return PrinterWriteResult.failure(
                    PrinterErrorCode.CONNECTION_CLOSED,
                    0
            );
        }

        return writer.write(data);
    }


    /**
     * Closes the USB connection and releases the active writer.
     *
     * @return operation result
     */
    @Override
    public synchronized PrinterWriteResult close() {

        writer = null;

        return connection.close();
    }


    /**
     * Returns the physical USB connection identity.
     *
     * @return connection identity
     */
    @Override
    public ConnectionIdentity getConnectionIdentity() {
        return connectionIdentity;
    }


    /**
     * Returns the current USB connection state.
     *
     * @return connection state
     */
    @Override
    public ConnectionState getState() {
        return connection.getState();
    }
}
```

---

# 17. `PrinterDeviceRegistry.java`

```java
package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;

import java.util.HashMap;
import java.util.Map;

/**
 * Stores active printer device runtimes indexed by connection identity.
 *
 * The registry does not own printer configuration or queue execution.
 */
public final class PrinterDeviceRegistry {

    /**
     * Active runtime devices indexed by their physical connection identity.
     */
    private final Map<ConnectionIdentity, IPrinterDevice> devices =
            new HashMap<>();


    /**
     * Registers a runtime printer device.
     *
     * @param device printer runtime device
     */
    public synchronized void register(
            IPrinterDevice device
    ) {
        devices.put(
                device.getConnectionIdentity(),
                device
        );
    }


    /**
     * Returns the runtime device for an identity.
     *
     * @param identity physical connection identity
     * @return runtime device or null
     */
    public synchronized IPrinterDevice get(
            ConnectionIdentity identity
    ) {
        return devices.get(identity);
    }


    /**
     * Checks whether a runtime device is registered.
     *
     * @param identity physical connection identity
     * @return true when registered
     */
    public synchronized boolean contains(
            ConnectionIdentity identity
    ) {
        return devices.containsKey(identity);
    }


    /**
     * Removes and returns a runtime device.
     *
     * @param identity physical connection identity
     * @return removed device or null
     */
    public synchronized IPrinterDevice remove(
            ConnectionIdentity identity
    ) {
        return devices.remove(identity);
    }


    /**
     * Removes all registered runtime devices.
     */
    public synchronized void clear() {
        devices.clear();
    }
}
```

---

# 18. `PrinterDeviceHandle.java`

```java
package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

/**
 * Represents a temporary consumer handle to a runtime printer device.
 *
 * The handle prevents callers from directly managing the device registry
 * and reference lifecycle.
 */
public final class PrinterDeviceHandle
        implements AutoCloseable {

    /**
     * Runtime device exposed through this handle.
     */
    private final IPrinterDevice device;

    /**
     * Callback used to release the device reference.
     */
    private final Runnable releaseAction;


    /**
     * Indicates whether the handle has already been released.
     */
    private boolean released;


    /**
     * Creates a device handle.
     *
     * @param device runtime printer device
     * @param releaseAction release callback
     */
    public PrinterDeviceHandle(
            IPrinterDevice device,
            Runnable releaseAction
    ) {
        this.device = device;
        this.releaseAction = releaseAction;
    }


    /**
     * Returns the physical connection identity.
     *
     * @return connection identity
     */
    public ConnectionIdentity getConnectionIdentity() {
        return device.getConnectionIdentity();
    }


    /**
     * Opens the printer connection.
     *
     * @return operation result
     */
    public PrinterWriteResult open() {
        return device.open();
    }


    /**
     * Writes raw bytes to the printer.
     *
     * @param data raw printer bytes
     * @return write result
     */
    public PrinterWriteResult write(
            byte[] data
    ) {
        return device.write(data);
    }


    /**
     * Releases this handle.
     *
     * The release operation is executed only once.
     */
    @Override
    public synchronized void close() {

        if (released) {
            return;
        }

        released = true;

        releaseAction.run();
    }
}
```

---

# 19. `PrinterDeviceManager.java`

```java
package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;

import java.util.HashMap;
import java.util.Map;

/**
 * Manages active physical printer runtimes.
 *
 * The manager reuses one runtime device for the same connection identity.
 *
 * It does not manage printer business configuration, printer types,
 * drivers, paper settings, or print jobs.
 */
public final class PrinterDeviceManager {

    /**
     * Registry containing active runtime printer devices.
     */
    private final PrinterDeviceRegistry registry;

    /**
     * Reference counts for active device consumers.
     */
    private final Map<ConnectionIdentity, Integer> referenceCounts =
            new HashMap<>();


    /**
     * Creates a printer device manager.
     *
     * @param registry runtime device registry
     */
    public PrinterDeviceManager(
            PrinterDeviceRegistry registry
    ) {
        this.registry = registry;
    }


    /**
     * Acquires an existing runtime device.
     *
     * @param identity physical connection identity
     * @return device handle
     * @throws IllegalStateException when the device is not registered
     */
    public synchronized PrinterDeviceHandle acquire(
            ConnectionIdentity identity
    ) {
        IPrinterDevice device =
                registry.get(identity);

        if (device == null) {
            throw new IllegalStateException(
                    "Printer device is not registered: "
                            + identity
            );
        }

        int count =
                referenceCounts.getOrDefault(
                        identity,
                        0
                );

        referenceCounts.put(
                identity,
                count + 1
        );

        return new PrinterDeviceHandle(
                device,
                () -> release(identity)
        );
    }


    /**
     * Registers a runtime device without acquiring a consumer reference.
     *
     * @param device runtime printer device
     */
    public synchronized void register(
            IPrinterDevice device
    ) {
        registry.register(device);
        referenceCounts.putIfAbsent(
                device.getConnectionIdentity(),
                0
        );
    }


    /**
     * Releases one consumer reference.
     *
     * The runtime device is removed when no consumer remains.
     *
     * @param identity physical connection identity
     */
    public synchronized void release(
            ConnectionIdentity identity
    ) {
        Integer count =
                referenceCounts.get(identity);

        if (count == null) {
            return;
        }

        if (count <= 1) {

            referenceCounts.remove(identity);

            IPrinterDevice device =
                    registry.remove(identity);

            if (device != null) {
                device.close();
            }

            return;
        }

        referenceCounts.put(
                identity,
                count - 1
        );
    }


    /**
     * Returns an active runtime device.
     *
     * @param identity physical connection identity
     * @return runtime device or null
     */
    public synchronized IPrinterDevice get(
            ConnectionIdentity identity
    ) {
        return registry.get(identity);
    }


    /**
     * Closes and removes all active runtime devices.
     */
    public synchronized void closeAll() {

        referenceCounts.clear();

        registry.clear();
    }
}
```

---

# 20. Queue task

```java
package com.ndtcorepos.thermalprinter.queue;

/**
 * Represents one raw byte write job queued for a printer connection.
 *
 * The task contains only transport data.
 * It does not contain printer configuration or protocol information.
 */
public final class PrinterQueueTask {

    /**
     * Raw bytes that must be sent to the printer.
     */
    private final byte[] data;


    /**
     * Creates a printer queue task.
     *
     * @param data raw printer bytes
     */
    public PrinterQueueTask(
            byte[] data
    ) {
        this.data = data;
    }


    /**
     * Returns the raw bytes associated with this task.
     *
     * @return raw printer bytes
     */
    public byte[] getData() {
        return data;
    }
}
```

---

# 21. `PrinterQueue.java`

```java
package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Serializes write operations for one physical printer connection.
 *
 * All tasks submitted to one queue execute sequentially.
 */
public final class PrinterQueue {

    /**
     * Runtime printer device used by this queue.
     */
    private final IPrinterDevice device;

    /**
     * Single-thread executor guaranteeing sequential execution.
     */
    private final ExecutorService executor;


    /**
     * Creates a queue for one printer device.
     *
     * @param device runtime printer device
     */
    public PrinterQueue(
            IPrinterDevice device
    ) {
        this.device = device;
        this.executor =
                Executors.newSingleThreadExecutor();
    }


    /**
     * Executes a write operation sequentially.
     *
     * @param task write task
     * @return asynchronous execution future
     */
    public java.util.concurrent.Future<PrinterWriteResult> submit(
            PrinterQueueTask task
    ) {
        return executor.submit(
                () -> device.write(task.getData())
        );
    }


    /**
     * Stops the queue worker.
     *
     * Pending tasks are not guaranteed to complete after shutdown.
     */
    public void shutdown() {
        executor.shutdown();
    }
}
```

---

# 22. `PrinterQueueManager.java`

```java
package com.ndtcorepos.thermalprinter.queue;

import com.ndtcorepos.thermalprinter.device.IPrinterDevice;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterWriteResult;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Future;

/**
 * Manages one serial queue for each physical connection identity.
 *
 * Writes targeting the same connection execute sequentially.
 * Writes targeting different connections can execute concurrently.
 */
public final class PrinterQueueManager {

    /**
     * Queues indexed by physical connection identity.
     */
    private final Map<ConnectionIdentity, PrinterQueue> queues =
            new HashMap<>();


    /**
     * Submits raw bytes to the queue belonging to a connection.
     *
     * @param device runtime printer device
     * @param data raw printer bytes
     * @return asynchronous write result
     */
    public synchronized Future<PrinterWriteResult> submit(
            IPrinterDevice device,
            byte[] data
    ) {
        ConnectionIdentity identity =
                device.getConnectionIdentity();

        PrinterQueue queue =
                queues.get(identity);

        if (queue == null) {
            queue = new PrinterQueue(device);

            queues.put(
                    identity,
                    queue
            );
        }

        return queue.submit(
                new PrinterQueueTask(data)
        );
    }


    /**
     * Removes and shuts down the queue for a connection.
     *
     * @param identity physical connection identity
     */
    public synchronized void remove(
            ConnectionIdentity identity
    ) {
        PrinterQueue queue =
                queues.remove(identity);

        if (queue != null) {
            queue.shutdown();
        }
    }


    /**
     * Shuts down all printer queues.
     */
    public synchronized void shutdown() {

        for (PrinterQueue queue : queues.values()) {
            queue.shutdown();
        }

        queues.clear();
    }
}
```

---

# 23. `UsbPrinterDiscovery.java`

```java
package com.ndtcorepos.thermalprinter.discovery.usb;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

import java.util.ArrayList;
import java.util.List;

/**
 * Discovers USB devices available through Android UsbManager.
 *
 * Discovery does not open the devices and does not request permission.
 */
public final class UsbPrinterDiscovery
        implements IPrinterDiscovery {

    /**
     * Android USB manager used to enumerate connected devices.
     */
    private final UsbManager usbManager;


    /**
     * Creates a USB printer discovery service.
     *
     * @param context Android application context
     */
    public UsbPrinterDiscovery(
            Context context
    ) {
        usbManager =
                (UsbManager) context.getSystemService(
                        Context.USB_SERVICE
                );
    }


    /**
     * Returns all currently connected USB devices as descriptors.
     *
     * @return discovered USB device descriptors
     */
    @Override
    public List<PrinterDescriptor> discover() {

        List<PrinterDescriptor> devices =
                new ArrayList<>();

        for (UsbDevice device :
                usbManager.getDeviceList().values()) {

            devices.add(
                    createDescriptor(device)
            );
        }

        return devices;
    }


    /**
     * Converts an Android UsbDevice into a transport-neutral descriptor.
     *
     * @param device Android USB device
     * @return printer descriptor
     */
    private PrinterDescriptor createDescriptor(
            UsbDevice device
    ) {
        return new PrinterDescriptor(
                ConnectionType.USB,
                device.getDeviceName(),
                device.getManufacturerName(),
                device.getProductName(),
                getSerialNumber(device),
                device.getVendorId(),
                device.getProductId(),
                null,
                null
        );
    }


    /**
     * Reads the USB serial number when available.
     *
     * @param device Android USB device
     * @return serial number or null
     */
    private String getSerialNumber(
            UsbDevice device
    ) {
        try {
            return device.getSerialNumber();
        } catch (SecurityException exception) {
            return null;
        }
    }
}
```

---

# 24. `UsbConnectionIdentityResolver.java`

```java
package com.ndtcorepos.thermalprinter.identity.usb;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.enums.IdentityStability;
import com.ndtcorepos.thermalprinter.identity.IConnectionIdentityResolver;
import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;
import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

/**
 * Resolves runtime identities for USB devices.
 *
 * A USB serial number is preferred because it normally remains stable
 * across reconnects.
 */
public final class UsbConnectionIdentityResolver
        implements IConnectionIdentityResolver {

    /**
     * Creates a stable or temporary identity from USB device information.
     *
     * @param descriptor discovered USB device
     * @return USB connection identity
     */
    @Override
    public ConnectionIdentity resolve(
            PrinterDescriptor descriptor
    ) {
        String serialNumber =
                descriptor.getSerialNumber();

        if (serialNumber != null
                && !serialNumber.isEmpty()) {

            return new ConnectionIdentity(
                    "USB:"
                            + descriptor.getVendorId()
                            + ":"
                            + descriptor.getProductId()
                            + ":"
                            + serialNumber,
                    ConnectionType.USB,
                    IdentityStability.STABLE
            );
        }

        return new ConnectionIdentity(
                "USB:"
                        + descriptor.getVendorId()
                        + ":"
                        + descriptor.getProductId()
                        + ":"
                        + descriptor.getDeviceName(),
                ConnectionType.USB,
                IdentityStability.TEMPORARY
        );
    }
}
```

---

# 25. `ThermalPrinterModule.java`

Đây là phần tôi sẽ làm khác bản trước: **Module phải là API rõ ràng cho TS**, không expose Java object.

API baseline:

```text
discoverDevices()
getDevices()
hasPermission()
requestPermission()
open()
writeBytes()
close()
isConnected()
getConnectionState()
```

Code:

```java
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
            "ThermalPrinter";

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

            deviceManager.release(identity);

            queueManager.remove(identity);

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
```

### Có một vấn đề cần sửa ngay trong `ThermalPrinterModule`

`close()` hiện tại gọi:

```java
device.close();
deviceManager.release(identity);
```

Trong khi `release()` cũng gọi `device.close()` khi reference count về `0`.

Như vậy có thể **close 2 lần**.

Final phải sửa thành:

```java
PrinterWriteResult result =
        device.close();

queueManager.remove(identity);

deviceManager.remove(identity);

promise.resolve(
        toWritableMap(result)
);
```

Nhưng `PrinterDeviceManager` hiện chưa có `remove()` public. Tôi khuyên thêm API rõ ràng:

```java
/**
 * Removes a runtime device without applying consumer reference counting.
 *
 * This method is intended for explicit runtime shutdown initiated by
 * the native module or device lifecycle.
 *
 * @param identity physical connection identity
 * @return removed device or null
 */
public synchronized IPrinterDevice remove(
        ConnectionIdentity identity
) {
    referenceCounts.remove(identity);

    return registry.remove(identity);
}
```

Sau đó `ThermalPrinterModule.close()`:

```java
PrinterWriteResult result =
        device.close();

queueManager.remove(identity);

deviceManager.remove(identity);

promise.resolve(
        toWritableMap(result)
);
```

Tuy nhiên, **tốt hơn nữa** là không cho Module tự quản lý lifecycle thấp như vậy. API production nên để:

```text
Module
   ↓
DeviceManager
   ↓
QueueManager
```

chứ không để Module chạm trực tiếp registry.

---

# 26. Một vấn đề quan trọng hơn: `getDevices()` không nên duplicate `discoverDevices()`

Tôi đề xuất API cuối cùng của `ThermalPrinterModule` là:

```text
discoverDevices()
hasPermission()
requestPermission()
open()
writeBytes()
close()
isConnected()
getConnectionState()
```

**Không cần `getDevices()`** nếu ý nghĩa của nó cũng là physical discovery.

Nếu muốn `getDevices()`, thì phải định nghĩa rõ:

```text
discoverDevices()
    = scan physical devices

getDevices()
    = get currently registered runtime devices
```

Hai API đó khác nhau.

Tôi nghiêng về:

```text
discoverDevices()
getConnectedDevices()
```

thay vì `getDevices()`.

---

# 27. Native Module API cuối cùng tôi khuyên dùng

TypeScript sẽ nhìn native layer gần như:

```text
discoverDevices()

hasPermission(deviceName)

requestPermission(deviceName)

open(deviceName)

writeBytes(deviceName, bytes)

close(deviceName)

isConnected(deviceName)

getConnectionState(deviceName)
```

Trong đó:

```text
deviceName
```

chỉ là **USB transport handle để tìm Android `UsbDevice`**, không phải `printerId`.

Còn runtime identity thực sự vẫn là:

```text
ConnectionIdentity
```

Ví dụ:

```text
USB:11575:33751:ABC123
```

---

# 28. Nhưng `requestPermission()` còn thiếu implementation

Đây là phần tôi **không muốn giả code** vì Android USB permission là asynchronous:

```text
requestPermission()
       ↓
UsbManager.requestPermission()
       ↓
PendingIntent
       ↓
BroadcastReceiver
       ↓
permission result
```

Do đó `UsbPermission` không thể thiết kế đúng bằng:

```java
public PrinterWriteResult requestPermission()
```

nếu function này phải trả kết quả ngay.

API đúng nên là:

```java
public void requestPermission(
        UsbDevice device,
        PermissionCallback callback
)
```

hoặc dùng `Promise`.

Vì vậy interface generic:

```java
IPrinterPermission
```

cũng nên được điều chỉnh.

---

# 29. Tôi chốt lại responsibility

```text
ThermalPrinterModule
│
├── React Native API
│
├── discover
├── permission
├── open
├── writeBytes
├── close
└── state
        │
        ▼
PrinterQueueManager
        │
        ▼
PrinterDeviceManager
        │
        ▼
IPrinterDevice
        │
        ├── UsbPrinterDevice
        │       │
        │       ├── UsbConnection
        │       └── UsbWriter
        │
        ├── BluetoothPrinterDevice
        │
        └── NetworkPrinterDevice
```

Và **quan trọng nhất**:

```text
TS / App
    │
    │ printer meaning
    │ driver
    │ rendering
    │ AST
    │ bitmap
    │ encoder
    │
    ▼
byte[]
    │
    ▼
Native
    │
    │ transport only
    ▼
Physical Printer
```

Đây là boundary sạch nhất cho project hiện tại: **native không biết ESC/POS hay TSPL, không biết Receipt hay Label; nó chỉ quản lý physical connection và truyền `byte[]`.**
