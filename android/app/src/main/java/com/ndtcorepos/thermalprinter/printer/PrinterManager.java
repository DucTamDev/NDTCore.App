package com.ndtcorepos.thermalprinter.printer;

import com.facebook.react.bridge.ReactApplicationContext;
import com.ndtcorepos.thermalprinter.detector.BluetoothCapabilityDetector;
import com.ndtcorepos.thermalprinter.detector.CapabilityDetector;
import com.ndtcorepos.thermalprinter.detector.NetCapabilityDetector;
import com.ndtcorepos.thermalprinter.detector.UsbCapabilityDetector;
import com.ndtcorepos.thermalprinter.device.BluetoothPrinterDevice;
import com.ndtcorepos.thermalprinter.device.NetPrinterDevice;
import com.ndtcorepos.thermalprinter.device.UsbPrinterDevice;
import com.ndtcorepos.thermalprinter.discovery.IPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.bluetooth.BluetoothPrinterDiscovery;
import com.ndtcorepos.thermalprinter.discovery.usb.UsbPrinterDiscovery;
import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.queue.PrintJob;
import com.ndtcorepos.thermalprinter.queue.PrintJobResult;
import com.ndtcorepos.thermalprinter.queue.PrinterQueue;
import com.ndtcorepos.thermalprinter.queue.PrinterQueueManager;
import com.ndtcorepos.thermalprinter.queue.QueueStatus;
import com.ndtcorepos.thermalprinter.transport.bluetooth.BluetoothConnection;
import com.ndtcorepos.thermalprinter.transport.bluetooth.BluetoothWriter;
import com.ndtcorepos.thermalprinter.transport.net.NetConnection;
import com.ndtcorepos.thermalprinter.transport.net.NetWriter;
import com.ndtcorepos.thermalprinter.transport.usb.UsbConnection;
import com.ndtcorepos.thermalprinter.transport.usb.UsbEndpointResolver;
import com.ndtcorepos.thermalprinter.transport.usb.UsbWriter;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Facade RN gọi qua PrinterModule — orchestration cho registry, queue, discovery, detector.
 */
public final class PrinterManager {

    private final ReactApplicationContext context;
    private final UsbPermission usbPermission;
    private final PrinterRegistry registry = new PrinterRegistry();
    private final PrinterQueueManager queueManager = new PrinterQueueManager(registry);
    private final Map<ConnectionType, IPrinterDiscovery> discoveries = new EnumMap<>(ConnectionType.class);
    private final Map<ConnectionType, CapabilityDetector> detectors = new EnumMap<>(ConnectionType.class);

    public PrinterManager(ReactApplicationContext context, UsbPermission usbPermission) {
        this.context = context;
        this.usbPermission = usbPermission;
        discoveries.put(ConnectionType.USB, new UsbPrinterDiscovery(context));
        discoveries.put(ConnectionType.BLUETOOTH, new BluetoothPrinterDiscovery());
        detectors.put(ConnectionType.USB, new UsbCapabilityDetector());
        detectors.put(ConnectionType.BLUETOOTH, new BluetoothCapabilityDetector());
        detectors.put(ConnectionType.LAN, new NetCapabilityDetector());
    }

    /**
     * Quét thiết bị khả dụng cho 1 loại kết nối.
     *
     * @param type loại kết nối cần quét
     * @return danh sách printer tìm thấy — rỗng nếu không có discovery cho loại này (LAN)
     * @throws PrinterException DISCOVERY_FAILED nếu hệ thống USB/Bluetooth không sẵn sàng
     */
    public List<PrinterInfo> discover(ConnectionType type) throws PrinterException {
        IPrinterDiscovery discovery = discoveries.get(type);
        return discovery == null ? List.of() : discovery.discover();
    }

    /**
     * Kết nối tới printer theo printerId (JS truyền vào) + info.
     *
     * @param printerId khoá đăng ký trong Registry
     * @param info thông tin kết nối
     */
    public CompletableFuture<PrinterResult> connect(String printerId, PrinterInfo info) {
        PrinterDevice device = registry.get(printerId);
        if (device == null) {
            device = createDevice(info);
            registry.put(printerId, device);
        }
        return device.connect();
    }

    private PrinterDevice createDevice(PrinterInfo info) {
        return switch (info.connectionType()) {
            case USB -> {
                UsbEndpointResolver resolver = new UsbEndpointResolver();
                UsbConnection connection = new UsbConnection(context, usbPermission, resolver, info.vendorId(), info.productId());
                yield new UsbPrinterDevice(info, connection, new UsbWriter(connection, resolver));
            }
            case BLUETOOTH -> {
                BluetoothConnection connection = new BluetoothConnection(info.bluetoothAddress());
                yield new BluetoothPrinterDevice(info, connection, new BluetoothWriter(connection));
            }
            case LAN -> {
                NetConnection connection = new NetConnection(info.host(), info.port());
                yield new NetPrinterDevice(info, connection, new NetWriter(connection));
            }
        };
    }

    /**
     * Kết nối lại 1 printer đã có trong Registry.
     *
     * @param printerId id cần kết nối lại
     */
    public CompletableFuture<PrinterResult> reconnect(String printerId) {
        PrinterDevice device = registry.get(printerId);
        if (device == null) {
            return CompletableFuture.failedFuture(new PrinterException(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId));
        }
        return device.connect();
    }

    /**
     * Đóng kết nối tới 1 printer.
     *
     * @param printerId id cần ngắt kết nối
     */
    public CompletableFuture<PrinterResult> disconnect(String printerId) {
        PrinterDevice device = registry.get(printerId);
        if (device == null) {
            return CompletableFuture.failedFuture(new PrinterException(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId));
        }
        return device.disconnect();
    }

    /**
     * Metadata của 1 printer đã đăng ký.
     *
     * @param printerId id cần tra cứu
     * @return metadata tương ứng, null nếu không tìm thấy
     */
    public PrinterInfo getInfo(String printerId) {
        PrinterDevice device = registry.get(printerId);
        return device == null ? null : device.getInfo();
    }

    /**
     * Capability đã detect cho 1 printer.
     *
     * @param printerId id cần tra cứu
     * @return capability tương ứng, null nếu không tìm thấy
     */
    public PrinterCapabilities getCapabilities(String printerId) {
        PrinterDevice device = registry.get(printerId);
        if (device == null) {
            return null;
        }
        CapabilityDetector detector = detectors.get(device.getInfo().connectionType());
        return detector == null ? null : detector.detect(device.getInfo());
    }

    /**
     * Trạng thái kết nối sống hiện tại của printer.
     *
     * @param printerId id cần tra cứu
     * @return trạng thái hiện tại, null nếu printerId không có trong Registry
     */
    public PrinterState getConnectionState(String printerId) {
        PrinterDevice device = registry.get(printerId);
        return device == null ? null : device.getState();
    }

    /**
     * Đưa 1 lệnh ghi vào hàng đợi FIFO của printer này.
     *
     * @param printerId printer đích
     * @param data dữ liệu cần ghi
     */
    public CompletableFuture<PrintJobResult> write(String printerId, byte[] data) {
        PrintJob job = new PrintJob(UUID.randomUUID().toString(), printerId, data, System.currentTimeMillis());
        return queueManager.getOrCreate(printerId).enqueue(job);
    }

    /**
     * Huỷ 1 job còn PENDING trong hàng đợi.
     *
     * @param jobId id job cần huỷ
     * @return true nếu huỷ thành công, false nếu job không tồn tại/đã chạy
     */
    public boolean cancelJob(String jobId) {
        return queueManager.cancel(jobId);
    }

    /**
     * Trạng thái hàng đợi hiện tại của 1 printer.
     *
     * @param printerId id cần tra cứu
     */
    public QueueStatus getQueueStatus(String printerId) {
        PrinterQueue queue = queueManager.getIfExists(printerId);
        return queue == null ? new QueueStatus(0, null) : queue.status();
    }

    /**
     * Đóng tất cả kết nối và tắt mọi executor — gọi khi RN module bị huỷ.
     */
    public void shutdown() {
        for (PrinterDevice device : registry.getAll()) {
            device.disconnect();
        }
        queueManager.shutdownAll();
    }
}
