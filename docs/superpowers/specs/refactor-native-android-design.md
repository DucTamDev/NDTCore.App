Được. Dưới đây là bản **docs thiết kế lại đầy đủ** cho native Android Printer Layer, trong đó tôi chốt rõ `Detector`, `Device`, `Connection`, `Writer`, `Queue`, `Discovery`, `Capabilities`, `Promise`, concurrency và các edge case.

# NDTCore POS — Native Android Printer Architecture

## 1. Mục tiêu

Native Android Printer Layer chịu trách nhiệm:

* Quản lý printer device.
* Kết nối/ngắt kết nối printer.
* Ghi raw bytes xuống printer.
* Quản lý USB / Bluetooth / Network.
* Xử lý permission của Android.
* Discovery thiết bị.
* Detect native capabilities.
* Quản lý queue.
* Đảm bảo FIFO theo từng `printerId`.
* Cho phép nhiều printer khác nhau chạy song song.
* Quản lý concurrency/resource lock.
* Timeout, retry, cancellation và lifecycle.
* Chuẩn hóa error/result.
* Expose API cho React Native thông qua `Promise`.

Native layer **không chịu trách nhiệm**:

* ESC/POS.
* TSPL.
* Receipt.
* Label.
* Barcode.
* QR Code.
* Rendering.
* Font.
* Layout.
* Protocol detection.
* Base64 business logic.

Các phần trên thuộc React Native / Driver layer.

---

# 2. Nguyên tắc kiến trúc

Architecture dựa trên 6 nguyên tắc chính:

```text
Device
Connection
Writer
Discovery
Detector
Queue
```

Mỗi thành phần chỉ có một trách nhiệm rõ ràng.

Luồng tổng quát:

```text
React Native
     │
     ▼
PrinterModule
     │
     ▼
PrinterManager
     │
     ├───────────────┐
     ▼               ▼
Registry          QueueManager
     │               │
     ▼               ▼
PrinterDevice     PrinterQueue
     │               │
     ├───────┐       │
     ▼       ▼       ▼
Connection Writer   PrintJob
     │       │
     ▼       ▼
Android Platform
```

---

# 3. Dependency Rule

Dependency phải đi theo hướng:

```text
PrinterModule
      ↓
PrinterManager
      ↓
PrinterDevice
      ↓
PrinterConnection / PrinterWriter
      ↓
Android API
```

Không được:

```text
Android USB
    ↓
PrinterManager
```

hoặc:

```text
UsbConnection
    ↓
ESC/POS
```

Native transport không được biết protocol.

---

# 4. Folder Structure

Không sử dụng Clean Architecture nhiều tầng.

Cấu trúc đề xuất:

```text
android/
└── src/main/java/com/ndtcorepos/thermalprinter/
    │
    ├── PrinterModule.java
    │
    ├── printer/
    │   ├── PrinterManager.java
    │   ├── PrinterDevice.java
    │   ├── PrinterRegistry.java
    │   ├── PrinterInfo.java
    │   ├── PrinterCapabilities.java
    │   ├── CapabilityState.java
    │   ├── PrinterState.java
    │   ├── PrinterResult.java
    │   └── PrinterErrorCode.java
    │
    ├── device/
    │   ├── UsbPrinterDevice.java
    │   ├── BluetoothPrinterDevice.java
    │   └── NetPrinterDevice.java
    │
    ├── transport/
    │   ├── PrinterConnection.java
    │   ├── PrinterWriter.java
    │   │
    │   ├── usb/
    │   │   ├── UsbConnection.java
    │   │   ├── UsbWriter.java
    │   │   ├── UsbPermissionManager.java
    │   │   └── UsbEndpointResolver.java
    │   │
    │   ├── bluetooth/
    │   │   ├── BluetoothConnection.java
    │   │   ├── BluetoothWriter.java
    │   │   └── BluetoothPermissionManager.java
    │   │
    │   └── net/
    │       ├── NetConnection.java
    │       └── NetWriter.java
    │
    ├── queue/
    │   ├── PrinterQueueManager.java
    │   ├── PrinterQueue.java
    │   ├── PrintJob.java
    │   └── PrintJobResult.java
    │
    ├── discovery/
    │   ├── PrinterDiscovery.java
    │   ├── UsbPrinterDiscovery.java
    │   ├── BluetoothPrinterDiscovery.java
    │   └── NetPrinterDiscovery.java
    │
    ├── detector/
    │   ├── CapabilityDetector.java
    │   ├── UsbCapabilityDetector.java
    │   ├── BluetoothCapabilityDetector.java
    │   └── NetCapabilityDetector.java
    │
    ├── exception/
    │   ├── PrinterException.java
    │   ├── PrinterConnectionException.java
    │   ├── PrinterPermissionException.java
    │   ├── PrinterWriteException.java
    │   └── PrinterTimeoutException.java
    │
    └── util/
        ├── PrinterLogger.java
        └── ByteUtils.java
```

---

# 5. `PrinterModule`

`PrinterModule` là **React Native boundary**.

Nó không được chứa business logic về printer.

Nhiệm vụ:

1. Nhận request từ JS.
2. Validate input.
3. Decode Base64.
4. Gọi `PrinterManager`.
5. Map result → JS object.
6. Resolve/reject `Promise`.

Ví dụ API:

```java
/**
 * React Native bridge exposing native printer functionality.
 *
 * <p>This class is responsible only for communication between
 * JavaScript and the native printer layer.</p>
 */
public class PrinterModule extends ReactContextBaseJavaModule {

    /**
     * Writes Base64 encoded raw data to a printer.
     *
     * @param printerId target printer identifier
     * @param base64Data Base64 encoded printer data
     * @param promise React Native promise receiving the operation result
     */
    @ReactMethod
    public void writeByBase64(
            String printerId,
            String base64Data,
            Promise promise) {
        // ...
    }
}
```

### Quan trọng

Không:

```java
PrinterModule
    ↓
UsbDeviceConnection
```

Mà:

```text
PrinterModule
      ↓
PrinterManager
      ↓
PrinterQueue
      ↓
PrinterDevice
```

---

# 6. `PrinterManager`

`PrinterManager` là facade chính của native printer system.

```java
/**
 * Central facade for managing native printer devices,
 * connections, writes, and print jobs.
 */
public final class PrinterManager {

    /**
     * Registers a printer device.
     *
     * @param device printer device
     * @return registration result
     */
    public PrinterResult register(PrinterDevice device);

    /**
     * Removes a printer from the registry.
     *
     * @param printerId printer identifier
     * @return removal result
     */
    public PrinterResult unregister(String printerId);

    /**
     * Gets printer information.
     *
     * @param printerId printer identifier
     * @return printer information
     */
    public PrinterInfo getInfo(String printerId);

    /**
     * Gets printer capabilities.
     *
     * @param printerId printer identifier
     * @return printer capabilities
     */
    public PrinterCapabilities getCapabilities(String printerId);

    /**
     * Connects to a printer asynchronously.
     *
     * @param printerId printer identifier
     * @return future containing the operation result
     */
    public CompletableFuture<PrinterResult> connect(String printerId);

    /**
     * Disconnects from a printer asynchronously.
     *
     * @param printerId printer identifier
     * @return future containing the operation result
     */
    public CompletableFuture<PrinterResult> disconnect(String printerId);

    /**
     * Enqueues a raw write operation.
     *
     * @param printerId target printer
     * @param data raw bytes
     * @return future containing the print result
     */
    public CompletableFuture<PrintJobResult> write(
            String printerId,
            byte[] data);
}
```

`PrinterManager` không biết:

```text
UsbManager
BluetoothSocket
Socket
UsbEndpoint
```

---

# 7. `PrinterDevice`

`PrinterDevice` đại diện cho **một printer cụ thể**.

```java
/**
 * Represents a physical printer endpoint.
 *
 * <p>A printer device owns the lifecycle of its connection
 * and delegates actual communication to connection/writer
 * implementations.</p>
 */
public interface PrinterDevice {

    /**
     * Returns printer metadata.
     */
    PrinterInfo getInfo();

    /**
     * Returns currently known printer capabilities.
     */
    PrinterCapabilities getCapabilities();

    /**
     * Opens the printer connection.
     */
    CompletableFuture<PrinterResult> connect();

    /**
     * Closes the printer connection.
     */
    CompletableFuture<PrinterResult> disconnect();

    /**
     * Returns whether the printer is currently connected.
     */
    boolean isConnected();

    /**
     * Writes raw bytes to the printer.
     */
    CompletableFuture<PrinterResult> write(byte[] data);

    /**
     * Returns the current lifecycle state.
     */
    PrinterState getState();
}
```

Đây là abstraction quan trọng nhất ở tầng native.

---

# 8. Concrete Printer Devices

Có 3 implementation:

```text
PrinterDevice
     │
     ├── UsbPrinterDevice
     ├── BluetoothPrinterDevice
     └── NetPrinterDevice
```

## `UsbPrinterDevice`

```java
/**
 * Printer device implementation for Android USB printers.
 */
public final class UsbPrinterDevice implements PrinterDevice {
}
```

Chịu trách nhiệm phối hợp:

```text
UsbPermissionManager
        +
UsbConnection
        +
UsbWriter
```

---

## `BluetoothPrinterDevice`

```java
/**
 * Printer device implementation for Bluetooth printers.
 */
public final class BluetoothPrinterDevice implements PrinterDevice {
}
```

Chịu trách nhiệm phối hợp:

```text
BluetoothPermissionManager
        +
BluetoothConnection
        +
BluetoothWriter
```

---

## `NetPrinterDevice`

```java
/**
 * Printer device implementation for TCP/IP network printers.
 */
public final class NetPrinterDevice implements PrinterDevice {
}
```

Chịu trách nhiệm phối hợp:

```text
NetConnection
        +
NetWriter
```

---

# 9. `PrinterConnection`

`PrinterConnection` chỉ quản lý lifecycle của communication channel.

```java
/**
 * Represents the lifecycle of a printer communication connection.
 *
 * <p>This interface does not perform printer writes.</p>
 */
public interface PrinterConnection {

    /**
     * Opens the underlying communication channel.
     */
    CompletableFuture<PrinterResult> open();

    /**
     * Closes the communication channel.
     */
    CompletableFuture<PrinterResult> close();

    /**
     * Returns whether the channel is currently open.
     */
    boolean isOpen();
}
```

Không có:

```java
write()
```

Đây là intentional.

---

# 10. `PrinterWriter`

`PrinterWriter` chỉ chịu trách nhiệm ghi bytes.

```java
/**
 * Writes raw bytes to an already established printer connection.
 */
public interface PrinterWriter {

    /**
     * Writes the supplied bytes to the printer.
     *
     * @param data raw printer bytes
     * @return result of the write operation
     */
    CompletableFuture<PrinterResult> write(byte[] data);
}
```

Không có:

```java
connect()
disconnect()
```

---

# 11. USB

## `UsbConnection`

Chịu trách nhiệm:

* Android USB permission.
* `UsbManager`.
* `UsbDeviceConnection`.
* Claim interface.
* Release interface.
* Open/close lifecycle.

```java
/**
 * Manages the lifecycle of an Android USB printer connection.
 */
public final class UsbConnection implements PrinterConnection {

    /**
     * Android application context.
     */
    private final Context context;

    /**
     * USB manager provided by Android.
     */
    private final UsbManager usbManager;

    /**
     * Target USB device.
     */
    private final UsbDevice usbDevice;

    /**
     * Active USB device connection.
     */
    private UsbDeviceConnection connection;

    /**
     * Opens the USB connection.
     */
    @Override
    public CompletableFuture<PrinterResult> open();

    /**
     * Closes and releases the USB connection.
     */
    @Override
    public CompletableFuture<PrinterResult> close();

    /**
     * Returns whether the USB connection is open.
     */
    @Override
    public boolean isOpen();
}
```

---

# 12. `UsbWriter`

`UsbWriter` thực hiện:

```java
bulkTransfer(...)
```

nhưng code bên ngoài không biết điều này.

```java
/**
 * Writes raw bytes through an Android USB bulk OUT endpoint.
 */
public final class UsbWriter implements PrinterWriter {

    /**
     * Active USB connection.
     */
    private final UsbConnection connection;

    /**
     * USB OUT endpoint used for printer writes.
     */
    private final UsbEndpoint outputEndpoint;

    /**
     * Writes raw bytes through USB bulk transfer.
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data);
}
```

---

# 13. `UsbEndpointResolver`

Không để `UsbWriter` tự tìm endpoint.

```java
/**
 * Resolves a valid USB bulk OUT endpoint for a printer.
 */
public final class UsbEndpointResolver {

    /**
     * Finds the endpoint used to send data to the printer.
     *
     * @param device USB printer device
     * @return resolved OUT endpoint
     * @throws PrinterException when no valid endpoint exists
     */
    public UsbEndpoint resolve(UsbDevice device);
}
```

Logic:

```text
UsbDevice
    ↓
UsbInterface
    ↓
UsbEndpoint
    ↓
BULK
    ↓
OUT
```

Nếu không tìm được:

```text
USB_ENDPOINT_NOT_FOUND
```

---

# 14. USB Permission

USB permission là asynchronous.

```java
/**
 * Handles Android USB permission requests.
 */
public final class UsbPermissionManager {

    /**
     * Checks whether the application already has access
     * to the specified USB device.
     */
    public boolean hasPermission(UsbDevice device);

    /**
     * Requests Android permission for the USB device.
     *
     * <p>The result is asynchronous because Android delivers
     * the permission response through a broadcast.</p>
     */
    public CompletableFuture<PrinterResult> requestPermission(
            UsbDevice device);
}
```

Không block:

```java
Thread.sleep(...)
```

để chờ permission.

---

# 15. Bluetooth

## `BluetoothConnection`

```java
/**
 * Manages a Bluetooth RFCOMM printer connection.
 */
public final class BluetoothConnection
        implements PrinterConnection {

    /**
     * Bluetooth device address.
     */
    private final String address;

    /**
     * Active Bluetooth socket.
     */
    private BluetoothSocket socket;

    /**
     * Opens the Bluetooth socket.
     */
    @Override
    public CompletableFuture<PrinterResult> open();

    /**
     * Closes the Bluetooth socket.
     */
    @Override
    public CompletableFuture<PrinterResult> close();

    /**
     * Returns whether the socket is connected.
     */
    @Override
    public boolean isOpen();
}
```

---

# 16. `BluetoothWriter`

```java
/**
 * Writes raw bytes through a Bluetooth output stream.
 */
public final class BluetoothWriter implements PrinterWriter {

    /**
     * Bluetooth connection used for writing.
     */
    private final BluetoothConnection connection;

    /**
     * Writes raw bytes to the Bluetooth output stream.
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data);
}
```

---

# 17. Network

Network printer thường sử dụng TCP.

```text
Printer
   ↑
TCP Socket
   ↑
OutputStream
```

## `NetConnection`

```java
/**
 * Manages a TCP connection to a network printer.
 */
public final class NetConnection
        implements PrinterConnection {

    /**
     * Printer IP address or hostname.
     */
    private final String host;

    /**
     * Printer TCP port.
     */
    private final int port;

    /**
     * Active TCP socket.
     */
    private Socket socket;

    /**
     * Opens the TCP connection.
     */
    @Override
    public CompletableFuture<PrinterResult> open();

    /**
     * Closes the TCP connection.
     */
    @Override
    public CompletableFuture<PrinterResult> close();

    /**
     * Returns whether the socket is connected.
     */
    @Override
    public boolean isOpen();
}
```

## `NetWriter`

```java
/**
 * Writes raw bytes to a network printer through TCP.
 */
public final class NetWriter implements PrinterWriter {

    /**
     * Active network connection.
     */
    private final NetConnection connection;

    /**
     * Writes raw bytes to the printer.
     */
    @Override
    public CompletableFuture<PrinterResult> write(byte[] data);
}
```

---

# 18. PrinterInfo

`PrinterInfo` trả lời:

> "Đây là thiết bị nào?"

Ví dụ:

```java
/**
 * Immutable metadata describing a printer device.
 */
public final class PrinterInfo {

    /** Application-level printer identifier. */
    private final String printerId;

    /** Printer connection type. */
    private final ConnectionType connectionType;

    /** Human-readable printer name. */
    private final String name;

    /** Stable identity used for duplicate detection. */
    private final String identityKey;

    /** Resource key used for concurrency control. */
    private final String resourceKey;

    /** Manufacturer when available. */
    private final String manufacturer;

    /** Product name when available. */
    private final String productName;

    /** USB vendor identifier when available. */
    private final Integer vendorId;

    /** USB product identifier when available. */
    private final Integer productId;

    /** USB serial number when available. */
    private final String serialNumber;

    /** Bluetooth address when applicable. */
    private final String bluetoothAddress;

    /** Network host when applicable. */
    private final String host;

    /** Network port when applicable. */
    private final Integer port;
}
```

---

# 19. `identityKey`

`identityKey` dùng để trả lời:

> "Đây có phải cùng một physical printer không?"

Ví dụ:

```text
USB
identityKey =
usb:<vendorId>:<productId>:<serial>
```

Bluetooth:

```text
bluetooth:<mac>
```

Network:

```text
net:<host>:<port>
```

Nhưng phải có fallback khi USB không có serial.

Không được giả định mọi Android USB device đều có serial number.

---

# 20. `resourceKey`

`resourceKey` trả lời:

> "Những operation nào đang tranh chấp cùng một native resource?"

Đây **không nhất thiết giống `identityKey`**.

Ví dụ:

```text
Printer A
printerId = printer-a
identityKey = usb:11575:33751:S001
resourceKey = usb

Printer B
printerId = printer-b
identityKey = usb:11575:33751:S002
resourceKey = usb
```

Nếu underlying native USB implementation sử dụng một global singleton/resource thì A và B có thể cần resource lock chung.

Nhưng queue vẫn:

```text
Queue A
Queue B
```

riêng biệt.

---

# 21. PrinterCapabilities

Không dùng capability để biểu diễn protocol.

Không:

```java
supportsEscPos
supportsTspl
```

Native không nên biết các khái niệm đó.

Thay vào đó:

```java
/**
 * Describes capabilities that can be determined by the native layer.
 */
public final class PrinterCapabilities {

    /** Whether native raw byte writing is supported. */
    private final CapabilityState rawWrite;

    /** Whether paper status can be queried natively. */
    private final CapabilityState paperStatus;

    /** Whether cover status can be queried natively. */
    private final CapabilityState coverStatus;

    /** Whether printer status can be queried natively. */
    private final CapabilityState printerStatus;
}
```

---

# 22. CapabilityState

```java
/**
 * Represents the certainty of a detected capability.
 */
public enum CapabilityState {

    /** The capability is confirmed to be supported. */
    SUPPORTED,

    /** The capability is confirmed to be unsupported. */
    UNSUPPORTED,

    /** The native layer cannot determine the capability. */
    UNKNOWN
}
```

`UNKNOWN` rất quan trọng.

Ví dụ native không thể query paper sensor:

```text
paperStatus = UNKNOWN
```

Không nên:

```text
paperStatus = false
```

vì `false` mang nghĩa "chắc chắn không hỗ trợ".

---

# 23. Detector

Đây là phần cần phân biệt rõ.

`CapabilityDetector` chỉ detect **native capability**.

```java
/**
 * Detects printer capabilities that are observable
 * by the native Android layer.
 *
 * <p>This interface must remain protocol-agnostic.</p>
 */
public interface CapabilityDetector {

    /**
     * Detects capabilities for a printer.
     *
     * @param printerInfo printer metadata
     * @return detected capabilities
     */
    PrinterCapabilities detect(PrinterInfo printerInfo);
}
```

---

# 24. Không dùng Detector để detect ESC/POS / TSPL

Không làm:

```text
Xprinter
   ↓
Detector
   ↓
TSPL
```

hoặc:

```text
USB VID/PID
   ↓
Detector
   ↓
ESC/POS
```

Vì:

```text
VID/PID ≠ protocol
Manufacturer ≠ protocol
Model ≠ guaranteed protocol
ConnectionType ≠ protocol
```

Protocol detection thuộc tầng Driver/RN.

---

# 25. Discovery

Discovery trả lời:

> "Có những printer nào đang available?"

```java
/**
 * Discovers printer devices available through a transport.
 */
public interface PrinterDiscovery {

    /**
     * Discovers available printers.
     *
     * @return discovered printer information
     */
    CompletableFuture<List<PrinterInfo>> discover();
}
```

Có:

```text
UsbPrinterDiscovery
BluetoothPrinterDiscovery
NetPrinterDiscovery
```

---

# 26. Discovery không connect printer

Không nên:

```text
discover()
   ↓
connect()
   ↓
print()
```

Discovery chỉ:

```text
OS
 ↓
Devices
 ↓
PrinterInfo
```

Connection lifecycle thuộc `PrinterDevice`.

---

# 27. Queue Architecture

Đây là phần rất quan trọng.

Requirement:

> Printer khác nhau có thể print song song.

> Cùng một printer phải FIFO.

Architecture:

```text
PrinterQueueManager
       │
       ├── printer-A → PrinterQueue A
       │
       ├── printer-B → PrinterQueue B
       │
       └── printer-C → PrinterQueue C
```

Ví dụ:

```text
Printer A:
Job 1
Job 2
Job 3

Printer B:
Job 4
Job 5
```

Execution:

```text
A1 ──→ A2 ──→ A3
          +
B4 ──→ B5
```

A và B chạy parallel.

---

# 28. PrinterQueue

```java
/**
 * Serial FIFO queue for a single printer.
 *
 * <p>Only one job for this printer may execute at a time.</p>
 */
public final class PrinterQueue {

    /** Identifier of the printer owning this queue. */
    private final String printerId;

    /** FIFO collection of pending print jobs. */
    private final Queue<PrintJob> jobs;

    /** Maximum number of queued jobs. */
    private final int maxQueueSize;

    /**
     * Adds a job to the queue.
     */
    public CompletableFuture<PrintJobResult> enqueue(
            PrintJob job);

    /**
     * Starts processing pending jobs.
     */
    public void start();

    /**
     * Stops accepting new jobs.
     */
    public void shutdown();

    /**
     * Returns the number of pending jobs.
     */
    public int size();
}
```

---

# 29. Strict FIFO

Nếu:

```text
enqueue(Job A)
enqueue(Job B)
enqueue(Job C)
```

thì:

```text
A → B → C
```

Không được:

```text
A → C → B
```

kể cả C chạy nhanh hơn B.

---

# 30. Failure không được block queue

Ví dụ:

```text
Job A → FAILED
Job B → PENDING
Job C → PENDING
```

Kết quả:

```text
A → FAILED
B → EXECUTE
C → EXECUTE
```

Một failed job không được làm queue deadlock.

---

# 31. Retry

Retry phải thuộc job.

Ví dụ:

```text
Job A
attempt 1 → timeout
attempt 2 → success
```

Trong thời gian retry:

```text
Job B
```

không được vượt lên trước A nếu strict FIFO được yêu cầu.

Do đó:

```text
A retry
   ↓
A success/final failure
   ↓
B
```

---

# 32. PrintJob

```java
/**
 * Represents one immutable native printer write operation.
 */
public final class PrintJob {

    /** Unique identifier of the print job. */
    private final String jobId;

    /** Target printer identifier. */
    private final String printerId;

    /** Raw bytes to send to the printer. */
    private final byte[] data;

    /** Time when the job was created. */
    private final long createdAt;

    /** Maximum number of retry attempts. */
    private final int maxAttempts;
}
```

Không giữ reference tới `Promise`.

Queue không được biết React Native.

---

# 33. PrintJobResult

```java
/**
 * Represents the final result of a queued print job.
 */
public final class PrintJobResult {

    /** Unique identifier of the completed job. */
    private final String jobId;

    /** Target printer identifier. */
    private final String printerId;

    /** Whether the job completed successfully. */
    private final boolean success;

    /** Error code when the job fails. */
    private final PrinterErrorCode errorCode;

    /** Human-readable error message. */
    private final String message;

    /** Number of attempts used. */
    private final int attempts;

    /** Total operation duration. */
    private final long durationMs;
}
```

---

# 34. Resource Lock

Queue và resource lock là **hai khái niệm khác nhau**.

### Queue

Đảm bảo:

```text
same printer → FIFO
```

### Resource lock

Đảm bảo:

```text
same native resource → no unsafe concurrent access
```

Architecture:

```text
PrinterQueue
     │
     ▼
ResourceLock
     │
     ▼
PrinterDevice
```

---

# 35. Ví dụ USB A/B

```text
Printer A
Queue A
   │
   └── Job A1
        ↓
    resource lock usb
        ↓
    USB backend

Printer B
Queue B
   │
   └── Job B1
        ↓
    resource lock usb
        ↓
    USB backend
```

Nếu USB backend thực sự dùng chung resource:

```text
A1 → USB
B1 → USB
```

sẽ được serialize ở resource lock.

Nhưng:

```text
Queue A ≠ Queue B
```

vẫn được giữ riêng.

---

# 36. Không nên dùng global printer queue

Sai:

```text
GlobalQueue
 ├── Printer A Job
 ├── Printer B Job
 ├── Printer A Job
 └── Printer C Job
```

Điều này làm:

```text
Printer A
```

chậm:

```text
Printer B
```

không liên quan.

Đúng:

```text
Queue A
Queue B
Queue C
```

---

# 37. PrinterRegistry

```java
/**
 * Thread-safe registry of currently managed printer devices.
 */
public final class PrinterRegistry {

    /**
     * Registers a printer device.
     *
     * @throws PrinterException if the printerId already exists
     */
    public PrinterResult register(PrinterDevice device);

    /**
     * Removes a printer device.
     */
    public PrinterResult unregister(String printerId);

    /**
     * Finds a printer by identifier.
     */
    public PrinterDevice get(String printerId);

    /**
     * Returns whether a printer is registered.
     */
    public boolean contains(String printerId);

    /**
     * Returns all registered printers.
     */
    public List<PrinterDevice> getAll();
}
```

Registry phải thread-safe.

---

# 38. PrinterState

```java
/**
 * Represents the lifecycle state of a printer device.
 */
public enum PrinterState {

    /** Device exists but has not been connected. */
    REGISTERED,

    /** Connection is being established. */
    CONNECTING,

    /** Device is connected and ready for writes. */
    CONNECTED,

    /** Connection is being closed. */
    DISCONNECTING,

    /** Device is disconnected. */
    DISCONNECTED,

    /** Device encountered a recoverable or terminal error. */
    ERROR,

    /** Device has been permanently closed. */
    CLOSED
}
```

---

# 39. State transition

```text
REGISTERED
    │
    ▼
CONNECTING
    │
    ├──── success ────► CONNECTED
    │
    └──── failure ────► ERROR

CONNECTED
    │
    ▼
DISCONNECTING
    │
    ▼
DISCONNECTED
```

Không được:

```text
CLOSED → CONNECTED
```

Không được:

```text
DISCONNECTED
   ↓
write()
```

mà không có policy reconnect.

---

# 40. Auto reconnect

`write()` có thể có policy:

```text
write()
   │
   ├── connected → write
   │
   └── disconnected
          ↓
       connect
          ↓
        write
```

Nhưng phải configurable.

Không nên để mọi writer tự động reconnect vì dễ tạo race condition.

---

# 41. Concurrency trên cùng Printer

Không được:

```text
Thread 1 → connect()
Thread 2 → disconnect()
Thread 3 → write()
```

cùng lúc.

Per-printer queue/device serialization phải đảm bảo:

```text
connect
   ↓
write
   ↓
write
   ↓
disconnect
```

hoặc lifecycle lock tương đương.

---

# 42. Threading Model

Không được thực hiện blocking I/O trên:

```text
Android Main Thread
React Native JS Thread
```

Có thể dùng:

```text
ExecutorService
```

hoặc:

```text
ScheduledExecutorService
```

Ví dụ:

```text
PrinterManager
      ↓
Executor
      ↓
PrinterQueue
      ↓
Blocking I/O
```

---

# 43. CompletableFuture

Native core có thể dùng:

```java
CompletableFuture<PrinterResult>
```

để biểu diễn asynchronous operation.

Ví dụ:

```java
public CompletableFuture<PrinterResult> connect(
        String printerId)
```

và:

```java
public CompletableFuture<PrintJobResult> write(
        String printerId,
        byte[] data)
```

React Native vẫn nhận:

```text
Promise
```

---

# 44. Promise Boundary

Flow:

```text
JS
 │
 │ writeByBase64()
 ▼
PrinterModule
 │
 │ decode Base64
 ▼
byte[]
 │
 ▼
PrinterManager
 │
 ▼
CompletableFuture
 │
 ├── success → Promise.resolve()
 │
 └── failure → Promise.reject()
```

---

# 45. `writeByBase64`

API mới:

```java
@ReactMethod
public void writeByBase64(
        String printerId,
        String base64Data,
        Promise promise)
```

Không còn:

```java
printRawData(...)
```

Native core:

```java
write(byte[] data)
```

RN bridge:

```text
Base64 → byte[]
```

---

# 46. Base64 không thuộc native core

Không cần:

```text
util/Base64Decoder.java
```

Nếu chỉ dùng bởi RN API.

Có thể trực tiếp:

```java
byte[] data = Base64.decode(
        base64Data,
        Base64.DEFAULT);
```

trong `PrinterModule`.

Điều này giúp core không biết encoding transport payload.

---

# 47. Error Model

Không nên dùng:

```java
Exception.getMessage()
```

làm API contract.

Dùng:

```java
/**
 * Stable error codes exposed by the native printer layer.
 */
public enum PrinterErrorCode {

    NONE,

    INVALID_ARGUMENT,

    PRINTER_NOT_FOUND,

    PRINTER_ALREADY_REGISTERED,

    PRINTER_CLOSED,

    PRINTER_BUSY,

    PERMISSION_DENIED,

    PERMISSION_REQUIRED,

    CONNECTION_FAILED,

    CONNECTION_TIMEOUT,

    NOT_CONNECTED,

    WRITE_FAILED,

    WRITE_TIMEOUT,

    USB_DEVICE_NOT_FOUND,

    USB_ENDPOINT_NOT_FOUND,

    USB_INTERFACE_CLAIM_FAILED,

    BLUETOOTH_DEVICE_NOT_FOUND,

    BLUETOOTH_CONNECTION_FAILED,

    NETWORK_CONNECTION_FAILED,

    NETWORK_TIMEOUT,

    QUEUE_FULL,

    JOB_CANCELLED,

    OPERATION_CANCELLED,

    UNSUPPORTED,

    UNKNOWN_ERROR
}
```

---

# 48. Exception hierarchy

```text
PrinterException
    │
    ├── PrinterConnectionException
    │
    ├── PrinterPermissionException
    │
    ├── PrinterWriteException
    │
    ├── PrinterTimeoutException
    │
    └── PrinterUnsupportedException
```

Mỗi exception nên chứa:

```text
errorCode
message
cause
printerId
operationId
```

nếu cần tracing.

---

# 49. PrinterResult

```java
/**
 * Generic result for native printer operations.
 */
public final class PrinterResult {

    /** Indicates whether the operation succeeded. */
    private final boolean success;

    /** Stable error code. */
    private final PrinterErrorCode errorCode;

    /** Human-readable message. */
    private final String message;

    /** Operation duration in milliseconds. */
    private final long durationMs;

    /**
     * Creates a successful result.
     */
    public static PrinterResult success(long durationMs);

    /**
     * Creates a failed result.
     */
    public static PrinterResult failure(
            PrinterErrorCode errorCode,
            String message,
            long durationMs);
}
```

---

# 50. Timeout

Mọi blocking operation phải có timeout.

Ví dụ:

```text
connect timeout
write timeout
network socket timeout
Bluetooth connection timeout
USB bulk transfer timeout
```

Không được:

```java
bulkTransfer(..., 0);
```

nếu implementation đó có thể block vô hạn.

---

# 51. USB Write

Ví dụ conceptual:

```text
write(data)
   ↓
validate connection
   ↓
validate endpoint
   ↓
bulkTransfer()
   ↓
bytesWritten
   ↓
verify result
```

Nếu:

```text
bytesWritten < data.length
```

không nên mặc định success.

Phải xác định policy:

```text
partial write → WRITE_FAILED
```

hoặc loop gửi phần còn lại nếu driver/backend hỗ trợ.

Đối với printer raw stream, cần xử lý partial transfer cẩn thận.

---

# 52. Bluetooth Write

Flow:

```text
write(data)
   ↓
socket connected?
   ↓
OutputStream
   ↓
write(data)
   ↓
flush()
```

Nếu socket chết:

```text
WRITE_FAILED
```

Không swallow exception.

---

# 53. Network Write

Flow:

```text
write(data)
   ↓
Socket
   ↓
OutputStream
   ↓
write()
   ↓
flush()
```

Network phải xử lý:

* connect timeout
* read timeout nếu có
* broken socket
* connection reset
* host unreachable
* refused connection
* DNS failure nếu host là hostname.

---

# 54. Disconnect Safety

`disconnect()` phải idempotent.

Gọi:

```text
disconnect()
disconnect()
disconnect()
```

không được crash.

Kết quả có thể:

```text
success
```

nếu trạng thái cuối cùng là disconnected.

---

# 55. Connect Safety

`connect()` cũng phải idempotent hoặc trả trạng thái phù hợp.

Ví dụ:

```text
CONNECTED
    ↓
connect()
```

Không cần mở thêm socket.

Có thể return:

```text
success
alreadyConnected = true
```

---

# 56. Register Duplicate

Không cho:

```text
register(printer-A)
register(printer-A)
```

Error:

```text
PRINTER_ALREADY_REGISTERED
```

Ngoài `printerId`, application layer nên kiểm tra:

```text
identityKey
```

để tránh cùng physical printer được đăng ký nhiều lần.

---

# 57. USB Device Disconnection

Đây là edge case quan trọng.

Ví dụ:

```text
Queue A
   ↓
write()
   ↓
USB unplugged
```

Kết quả:

```text
WRITE_FAILED
```

Sau đó:

```text
PrinterState = ERROR / DISCONNECTED
```

Job tiếp theo phải theo policy:

```text
retry connect
```

hoặc:

```text
fail until reconnect
```

Không được giữ queue blocked vô thời hạn.

---

# 58. Bluetooth Disconnection

Tương tự:

```text
CONNECTED
    ↓
Bluetooth link lost
    ↓
write()
    ↓
failure
```

Connection phải chuyển trạng thái phù hợp.

---

# 59. Network Disconnect

Network có thể mất giữa lúc write.

```text
Socket connected
      ↓
partial write
      ↓
connection reset
```

Không được retry blindly nếu không biết printer đã nhận bao nhiêu byte.

Đây là lý do retry raw print job cần cẩn thận.

---

# 60. Retry và duplicate printing

Đây là edge case cực kỳ quan trọng.

Ví dụ:

```text
send receipt
    ↓
printer receives all bytes
    ↓
network connection dies
    ↓
client sees WRITE_TIMEOUT
```

Client không biết:

```text
printed?
```

Nếu retry:

```text
same receipt
```

có thể thành:

```text
duplicate print
```

Do đó:

> Native retry không thể đảm bảo exactly-once printing.

Chỉ có thể đảm bảo:

```text
at-least-once
```

hoặc:

```text
best-effort
```

trừ khi protocol/application có acknowledgement/idempotency mechanism.

---

# 61. Queue Full

Không cho queue tăng vô hạn.

Ví dụ:

```java
maxQueueSize = 100;
```

Job thứ 101:

```text
QUEUE_FULL
```

Điều này tránh:

```text
POS app
   ↓
1000 print jobs
   ↓
memory pressure
```

---

# 62. Cancellation

Mỗi `PrintJob` nên có:

```text
jobId
```

để có thể cancel pending job.

Phân biệt:

```text
PENDING
```

có thể cancel dễ dàng.

Nhưng:

```text
RUNNING
```

không đảm bảo có thể dừng giữa `write()`.

Không nên promise:

> cancel running USB write = guaranteed.

---

# 63. Shutdown

Khi app bị destroy:

```text
React Native
    ↓
PrinterModule.onCatalystInstanceDestroy()
    ↓
PrinterManager.shutdown()
    ↓
QueueManager.shutdown()
    ↓
disconnect all devices
    ↓
shutdown executors
```

Không để thread native chạy vô hạn sau khi app destroyed.

---

# 64. Discovery Architecture

```text
PrinterDiscovery
      │
      ├── UsbPrinterDiscovery
      ├── BluetoothPrinterDiscovery
      └── NetPrinterDiscovery
```

### USB

Android:

```text
UsbManager.getDeviceList()
```

sau đó convert:

```text
UsbDevice
    ↓
PrinterInfo
```

### Bluetooth

```text
BluetoothAdapter
    ↓
paired/discovered devices
    ↓
PrinterInfo
```

### Network

Network discovery phức tạp hơn vì không phải printer nào cũng expose discovery protocol.

Có thể hỗ trợ:

```text
manual IP + port
```

và optional discovery sau này.

---

# 65. Detector Architecture

```text
CapabilityDetector
      │
      ├── UsbCapabilityDetector
      ├── BluetoothCapabilityDetector
      └── NetCapabilityDetector
```

Detector chỉ được sử dụng khi capability có thể xác định một cách đáng tin cậy.

Nếu không:

```text
UNKNOWN
```

Không được "đoán".

---

# 66. Device Detection khác Capability Detection

Có hai khái niệm:

### Device Discovery

```text
Có device nào?
```

### Capability Detection

```text
Native có biết device này hỗ trợ capability gì?
```

Không nên gộp thành một `Detector` khổng lồ.

---

# 67. Protocol Detection

Nếu cần:

```text
ESC/POS
TSPL
Unknown
```

thì đó phải là layer khác:

```text
React Native
    ↓
PrinterResolver / ProtocolDetector
    ↓
PrinterDriver
```

Native Android không phụ trách.

---

# 68. Full End-to-End Flow

Ví dụ JS:

```text
writeByBase64(
    printerId,
    base64Data
)
```

Flow:

```text
JavaScript
    │
    ▼
PrinterModule
    │
    ├── validate printerId
    ├── validate Base64
    └── decode Base64
            │
            ▼
          byte[]
            │
            ▼
      PrinterManager
            │
            ▼
      PrinterQueueManager
            │
            ▼
       PrinterQueue
            │
            ▼
         PrintJob
            │
            ▼
      PrinterResourceLock
            │
            ▼
       PrinterDevice
            │
            ▼
       PrinterConnection
            │
            ▼
        PrinterWriter
            │
            ▼
      Android platform
```

---

# 69. Successful USB Flow

```text
writeByBase64()
      ↓
decode Base64
      ↓
enqueue Job
      ↓
PrinterQueue
      ↓
lock resource
      ↓
UsbPrinterDevice
      ↓
check permission
      ↓
UsbConnection.open()
      ↓
UsbEndpointResolver
      ↓
UsbWriter.write()
      ↓
bulkTransfer()
      ↓
release resource
      ↓
PrintJobResult
      ↓
PrinterModule
      ↓
Promise.resolve()
```

---

# 70. Failed USB Permission

```text
writeByBase64()
      ↓
queue
      ↓
USB permission required
      ↓
requestPermission()
      ↓
DENIED
      ↓
PERMISSION_DENIED
      ↓
job completed as failed
      ↓
next job continues
```

Không để queue chết.

---

# 71. Failed Printer

```text
Job A
   ↓
connection timeout
   ↓
FAILED

Job B
   ↓
still executes
```

trừ khi queue policy quy định printer đang unavailable thì pause queue.

Default recommendation:

> **Fail current job, continue queue.**

Nếu business cần retry:

```text
retry current job
   ↓
final result
   ↓
next job
```

---

# 72. Native API tối thiểu

Tôi khuyên native RN API chỉ cần:

```text
discoverUsbPrinters()
discoverBluetoothPrinters()
discoverNetworkPrinters()

registerPrinter()
unregisterPrinter()

connect()
disconnect()

getPrinterInfo()
getPrinterCapabilities()

writeByBase64()

cancelPrintJob()
getQueueStatus()
```

Không cần expose:

```text
openUsbInterface()
bulkTransfer()
resolveEndpoint()
BluetoothSocket
Socket
```

---

# 73. Protocol Layer ở React Native

Sau native layer:

```text
React Native
│
├── PrinterService
├── PrintRoutingService
├── PrinterDriver
│    ├── EscPosDriver
│    └── TsplDriver
│
└── NativePrinter
       ↓
   PrinterModule
```

Flow:

```text
Receipt
  ↓
PrintRoutingService
  ↓
EscPosDriver
  ↓
encode()
  ↓
Base64
  ↓
writeByBase64()
  ↓
Native
```

TSPL tương tự:

```text
Label
  ↓
TsplDriver
  ↓
encode()
  ↓
Base64
  ↓
writeByBase64()
```

Native không biết hai flow này khác nhau.

---

# 74. SOLID

## Single Responsibility

```text
PrinterDevice
    → printer lifecycle

Connection
    → connection lifecycle

Writer
    → byte writing

Discovery
    → device discovery

Detector
    → capability detection

Queue
    → job ordering

Registry
    → device registration
```

---

## Open/Closed

Thêm transport:

```text
SerialPrinterDevice
```

không cần sửa:

```text
PrinterManager
PrinterQueue
PrintJob
```

chỉ cần implementation mới.

---

## Liskov Substitution

```text
UsbPrinterDevice
BluetoothPrinterDevice
NetPrinterDevice
```

đều phải dùng được như:

```text
PrinterDevice
```

---

## Interface Segregation

Không tạo:

```java
interface PrinterTransport {
    connect();
    disconnect();
    write();
    discover();
    detect();
    ...
}
```

Quá lớn.

Tách:

```text
PrinterConnection
PrinterWriter
PrinterDiscovery
CapabilityDetector
```

---

## Dependency Inversion

`PrinterManager` phụ thuộc abstraction:

```text
PrinterDevice
PrinterRegistry
PrinterQueueManager
```

không phụ thuộc:

```text
UsbDeviceConnection
BluetoothSocket
Socket
```

---

# 75. Những thứ KHÔNG được làm

### Không protocol trong native

```java
if (protocol == ESC_POS) {}
```

Sai.

### Không Base64 trong transport

```java
UsbWriter.write(base64Data)
```

Sai.

### Không Promise trong core

```java
PrinterDevice.write(..., Promise promise)
```

Sai.

### Không callback trong public RN API

```java
Callback success
Callback error
```

Không dùng architecture mới.

### Không global queue

```text
all printers → one queue
```

Sai.

### Không expose Android API

```java
UsbDeviceConnection getConnection()
```

Sai.

### Không đoán capability

```text
Xprinter → supportsPaperStatus=true
```

Sai nếu chưa xác minh.

---

# 76. Final Architecture

Architecture cuối cùng:

```text
                         React Native
                              │
                              ▼
                     ┌─────────────────┐
                     │  PrinterModule  │
                     │ Promise / Base64│
                     └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ PrinterManager  │
                     └───────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌────────────┐  ┌────────────┐
        │ Registry │  │QueueManager│  │  Detector  │
        └────┬─────┘  └─────┬──────┘  └────────────┘
             │              │
             ▼              ▼
       PrinterDevice    PrinterQueue
             │              │
      ┌──────┼──────┐       ▼
      ▼      ▼      ▼    PrintJob
     USB    BT     NET
      │      │      │
      ▼      ▼      ▼
 Connection Connection Connection
      │      │      │
      ▼      ▼      ▼
    Writer Writer  Writer
      │      │      │
      └──────┼──────┘
             ▼
      Android Platform
```

## 77. Responsibility Matrix

| Component             | Responsibility           | Không chịu trách nhiệm |
| --------------------- | ------------------------ | ---------------------- |
| `PrinterModule`       | RN Promise, Base64       | Printer logic          |
| `PrinterManager`      | Orchestration            | Android API            |
| `PrinterRegistry`     | Device registry          | I/O                    |
| `PrinterDevice`       | Device lifecycle         | Protocol               |
| `PrinterConnection`   | Open/close               | Data encoding          |
| `PrinterWriter`       | Raw bytes                | Connection discovery   |
| `UsbConnection`       | USB lifecycle            | ESC/POS                |
| `UsbWriter`           | USB write                | TSPL                   |
| `BluetoothConnection` | BT lifecycle             | Protocol               |
| `BluetoothWriter`     | BT write                 | Rendering              |
| `NetConnection`       | TCP lifecycle            | Protocol               |
| `NetWriter`           | TCP write                | Rendering              |
| `PrinterQueue`        | FIFO                     | Discovery              |
| `PrintJob`            | Job data                 | RN Promise             |
| `PrinterDiscovery`    | Find devices             | Connect                |
| `CapabilityDetector`  | Native capability        | Protocol detection     |
| `PrinterInfo`         | Device identity/metadata | Capability logic       |
| `PrinterCapabilities` | Capability state         | Device identity        |

---

# 78. Chốt về `Detector`

Điểm cuối cùng cần giữ trong design:

```text
Discovery
    ↓
"Thiết bị nào tồn tại?"
    ↓
PrinterInfo

CapabilityDetector
    ↓
"Native biết thiết bị này làm được gì?"
    ↓
PrinterCapabilities

PrinterDevice
    ↓
"Làm sao giao tiếp với thiết bị?"
    ↓
Connection + Writer

ProtocolDetector / PrinterResolver
    ↓
"Thiết bị dùng ESC/POS hay TSPL?"
    ↓
React Native / Driver layer
```

Đây là cách tách rõ nhất để native Android layer **không bị dính vào ESC/POS/TSPL**, nhưng vẫn đủ khả năng mở rộng USB/Bluetooth/LAN và xử lý concurrency ở mức production.
