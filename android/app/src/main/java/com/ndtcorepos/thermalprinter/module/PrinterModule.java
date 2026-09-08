package com.ndtcorepos.thermalprinter.module;

import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.error.PrinterErrorCode;
import com.ndtcorepos.thermalprinter.error.PrinterErrorResult;
import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.permission.UsbPermission;
import com.ndtcorepos.thermalprinter.printer.PrinterCapabilities;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;
import com.ndtcorepos.thermalprinter.printer.PrinterManager;
import com.ndtcorepos.thermalprinter.printer.PrinterState;
import com.ndtcorepos.thermalprinter.queue.PrintJobResult;
import com.ndtcorepos.thermalprinter.queue.QueueStatus;

import java.util.List;

/**
 * RN bridge duy nhất cho printer — Promise boundary.
 */
public final class PrinterModule extends ReactContextBaseJavaModule {

    private final PrinterManager printerManager;
    private final UsbPermission usbPermission;
    private boolean usbPermissionRegistered = false;

    public PrinterModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.usbPermission = new UsbPermission(reactContext);
        this.printerManager = new PrinterManager(reactContext, usbPermission);
    }

    @Override
    public String getName() {
        return "ThermalPrinterModule";
    }

    /**
     * Liệt kê thiết bị khả dụng cho 1 loại kết nối.
     *
     * @param type loại kết nối ("usb"/"bluetooth"/"lan")
     * @param promise promise nhận danh sách PrinterInfo
     */
    @ReactMethod
    public void discoverPrinters(String type, Promise promise) {
        try {
            ConnectionType connectionType = ConnectionType.fromWireValue(type);

            if (connectionType == ConnectionType.USB) {
                ensureUsbPermissionRegistered();
            }

            List<PrinterInfo> devices = printerManager.discover(connectionType);
            WritableArray result = Arguments.createArray();

            for (PrinterInfo info : devices) {
                result.pushMap(toWritableMap(info));
            }

            promise.resolve(result);
        } catch (PrinterException exception) {
            PrinterErrorResult.from(exception).rejectTo(promise);
        } catch (IllegalArgumentException exception) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, exception.getMessage()).rejectTo(promise);
        }
    }

    private void ensureUsbPermissionRegistered() {
        if (!usbPermissionRegistered) {
            usbPermission.register();
            usbPermissionRegistered = true;
        }
    }

    /**
     * Kết nối tới printer theo thông tin truyền vào.
     *
     * <p>Idempotent theo printerId — gọi lại khi đã CONNECTED không mở
     * thêm kết nối mới.</p>
     *
     * @param printer thông tin kết nối (printerId bắt buộc, type + field theo loại)
     * @param promise promise nhận kết quả kết nối
     */
    @ReactMethod
    public void connect(ReadableMap printer, Promise promise) {
        try {
            String printerId = printer.getString("printerId");
            ConnectionType type = ConnectionType.fromWireValue(printer.getString("type"));

            if (type == ConnectionType.USB) {
                ensureUsbPermissionRegistered();
            }

            PrinterInfo info = toPrinterInfo(printerId, type, printer);
            printerManager.connect(printerId, info)
                    .whenComplete((result, error) -> resolveOrReject(promise, error, Arguments.createMap()));
        } catch (IllegalArgumentException exception) {
            new PrinterErrorResult(PrinterErrorCode.UNSUPPORTED_CONNECTION, exception.getMessage()).rejectTo(promise);
        }
    }

    private PrinterInfo toPrinterInfo(String printerId, ConnectionType type, ReadableMap map) {
        return switch (type) {
            case USB -> new PrinterInfo(
                    printerId,
                    type,
                    null,
                    null,
                    null,
                    map.getInt("vendorId"),
                    map.getInt("productId"),
                    null,
                    null,
                    null,
                    null);
            case BLUETOOTH -> new PrinterInfo(
                    printerId,
                    type,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    map.getString("address"),
                    null,
                    null);
            case LAN -> new PrinterInfo(
                    printerId,
                    type,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    map.getString("host"),
                    map.getInt("port"));
        };
    }

    /**
     * Resolve promise với successValue nếu error null, ngược lại reject theo
     * PrinterException gốc — dùng chung cho connect/reconnect/disconnect vì
     * cả 3 xử lý CompletableFuture<PrinterResult> giống hệt nhau.
     */
    private void resolveOrReject(Promise promise, Throwable error, Object successValue) {
        if (error != null) {
            rejectAsync(error, promise);
            return;
        }

        promise.resolve(successValue);
    }

    /**
     * Kết nối lại 1 printer đã có trong Registry.
     *
     * @param printerId id printer cần kết nối lại
     * @param promise promise nhận kết quả kết nối
     */
    @ReactMethod
    public void reconnect(String printerId, Promise promise) {
        printerManager.reconnect(printerId).whenComplete((result, error) -> resolveOrReject(promise, error, null));
    }

    /**
     * Đóng kết nối tới printer.
     *
     * @param printerId id printer cần ngắt kết nối
     * @param promise promise nhận kết quả ngắt kết nối
     */
    @ReactMethod
    public void disconnect(String printerId, Promise promise) {
        printerManager.disconnect(printerId).whenComplete((result, error) -> resolveOrReject(promise, error, null));
    }

    /**
     * Giải mã Base64 rồi ghi raw bytes tới printer — kết nối được giữ
     * nguyên, chỉ đóng khi gọi disconnect().
     *
     * @param printerId id printer đích
     * @param base64Data dữ liệu đã encode Base64
     * @param promise promise nhận kết quả ghi
     */
    @ReactMethod
    public void writeByBase64(String printerId, String base64Data, Promise promise) {
        byte[] bytes;

        try {
            bytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException exception) {
            String message = "Invalid base64 data: " + exception.getMessage();
            new PrinterErrorResult(PrinterErrorCode.INVALID_ARGUMENT, message).rejectTo(promise);
            return;
        }

        if (bytes.length == 0) {
            new PrinterErrorResult(PrinterErrorCode.INVALID_ARGUMENT, "Print data must not be empty").rejectTo(promise);
            return;
        }

        printerManager.write(printerId, bytes).thenAccept(result -> resolveOrRejectWrite(promise, result));
    }

    private void resolveOrRejectWrite(Promise promise, PrintJobResult result) {
        if (!result.success()) {
            new PrinterErrorResult(result.errorCode(), result.message()).rejectTo(promise);
            return;
        }

        promise.resolve("Print SuccessFully");
    }

    /**
     * Lấy metadata của 1 printer đã đăng ký.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận metadata
     */
    @ReactMethod
    public void getPrinterInfo(String printerId, Promise promise) {
        PrinterInfo info = printerManager.getInfo(printerId);

        if (info == null) {
            new PrinterErrorResult(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId).rejectTo(promise);
            return;
        }

        promise.resolve(toWritableMap(info));
    }

    /**
     * Lấy capability native đã detect cho 1 printer.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận capability
     */
    @ReactMethod
    public void getPrinterCapabilities(String printerId, Promise promise) {
        PrinterCapabilities capabilities = printerManager.getCapabilities(printerId);

        if (capabilities == null) {
            new PrinterErrorResult(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId).rejectTo(promise);
            return;
        }

        WritableMap map = Arguments.createMap();
        map.putString("rawWrite", capabilities.rawWrite().name());
        map.putString("paperStatus", capabilities.paperStatus().name());
        map.putString("coverStatus", capabilities.coverStatus().name());
        map.putString("printerStatus", capabilities.printerStatus().name());

        promise.resolve(map);
    }

    /**
     * Lấy trạng thái kết nối sống hiện tại của 1 printer.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận trạng thái hiện tại (tên PrinterState)
     */
    @ReactMethod
    public void getConnectionState(String printerId, Promise promise) {
        PrinterState state = printerManager.getConnectionState(printerId);

        if (state == null) {
            new PrinterErrorResult(PrinterErrorCode.PRINTER_NOT_FOUND, "Printer not found: " + printerId).rejectTo(promise);
            return;
        }

        promise.resolve(state.name());
    }

    /**
     * Huỷ 1 job còn đang chờ trong hàng đợi.
     *
     * @param jobId id job cần huỷ
     * @param promise promise nhận kết quả huỷ
     */
    @ReactMethod
    public void cancelPrintJob(String jobId, Promise promise) {
        promise.resolve(printerManager.cancelJob(jobId));
    }

    /**
     * Lấy trạng thái hàng đợi hiện tại của 1 printer.
     *
     * @param printerId id printer cần tra cứu
     * @param promise promise nhận trạng thái hàng đợi
     */
    @ReactMethod
    public void getQueueStatus(String printerId, Promise promise) {
        QueueStatus status = printerManager.getQueueStatus(printerId);
        WritableMap map = Arguments.createMap();

        map.putInt("pendingCount", status.pendingCount());
        putStringOrNull(map, "runningJobId", status.runningJobId());

        promise.resolve(map);
    }

    private WritableMap toWritableMap(PrinterInfo info) {
        WritableMap map = Arguments.createMap();
        map.putString("printerId", info.printerId());
        map.putString("type", info.connectionType().name().toLowerCase());
        putStringOrNull(map, "name", info.name());
        putStringOrNull(map, "manufacturerName", info.manufacturerName());
        putStringOrNull(map, "productName", info.productName());
        putIntOrNull(map, "vendorId", info.vendorId());
        putIntOrNull(map, "productId", info.productId());
        putStringOrNull(map, "serialNumber", info.serialNumber());
        putStringOrNull(map, "address", info.bluetoothAddress());
        putStringOrNull(map, "host", info.host());
        putIntOrNull(map, "port", info.port());
        return map;
    }

    private void putStringOrNull(WritableMap map, String key, String value) {
        if (value == null) {
            map.putNull(key);
        } else {
            map.putString(key, value);
        }
    }

    private void putIntOrNull(WritableMap map, String key, Integer value) {
        if (value == null) {
            map.putNull(key);
        } else {
            map.putInt(key, value);
        }
    }

    private void rejectAsync(Throwable error, Promise promise) {
        Throwable cause = error.getCause() != null ? error.getCause() : error;

        if (cause instanceof PrinterException printerException) {
            PrinterErrorResult.from(printerException).rejectTo(promise);
            return;
        }

        new PrinterErrorResult(PrinterErrorCode.UNKNOWN_ERROR, cause.getMessage()).rejectTo(promise);
    }

    @Override
    public void invalidate() {
        super.invalidate();
        printerManager.shutdown();
    }
}
