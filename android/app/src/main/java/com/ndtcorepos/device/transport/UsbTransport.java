package com.ndtcorepos.device.transport;

import static com.ndtcorepos.device.constants.TransportConstants.USB_CHUNK_SIZE_BYTES;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.device.discovery.UsbDiscovery;
import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;

import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/** Truyền byte qua USB bằng bulk transfer. */
public final class UsbTransport implements ITransport {

    /** Ghi một khúc; trả số byte đã chuyển, âm khi lỗi hoặc hết thời gian. */
    public interface IChunkWriter {
        int write(
                byte[] buffer,
                int offset,
                int length,
                int timeoutMillis);
    }

    private final UsbManager usbManager;

    private final UsbDevice device;

    private volatile UsbDeviceConnection deviceConnection;

    private volatile UsbInterface claimedInterface;

    private volatile UsbEndpoint outEndpoint;

    /** `null` khi máy in không có endpoint đọc. */
    private volatile UsbEndpoint inEndpoint;

    /** Có sau khi `open` thành công, kèm serial đọc được. */
    private volatile DeviceAddress address;

    public UsbTransport(UsbManager usbManager, UsbDevice device) {
        this.usbManager = usbManager;
        this.device = device;
    }

    /** Mở thiết bị và chiếm interface in qua UsbManager; force để giành lại interface từ driver kernel nếu có. */
    @Override
    public synchronized void open() throws DeviceException {
        UsbInterface printerInterface = UsbDiscovery.findPrinterInterface(device);
        UsbDeviceConnection connection = printerInterface == null ? null : usbManager.openDevice(device);

        if (connection == null) {
            throw new DeviceException(DeviceErrorCode.CONNECTION_FAILED, "Không mở được thiết bị USB");
        }

        if (!connection.claimInterface(printerInterface, true)) {
            connection.close();
            throw new DeviceException(DeviceErrorCode.CONNECTION_FAILED, "Không chiếm được interface USB");
        }

        claimedInterface = printerInterface;
        outEndpoint = UsbDiscovery.findBulkEndpoint(printerInterface, UsbConstants.USB_DIR_OUT);
        inEndpoint = UsbDiscovery.findBulkEndpoint(printerInterface, UsbConstants.USB_DIR_IN);
        address = DeviceAddress.usb(device.getVendorId(), device.getProductId(), readSerial(), device.getDeviceName());
        deviceConnection = connection;
    }

    @Override
    public void write(byte[] data, long deadlineNanos) throws DeviceException {
        UsbDeviceConnection connection = requireConnection();
        UsbEndpoint endpoint = outEndpoint;
        writeInChunks(data, deadlineNanos, (buffer, offset, length, timeoutMillis) ->
                connection.bulkTransfer(endpoint, buffer, offset, length, timeoutMillis));
    }

    /** `bulkTransfer` coi timeout 0 là chờ vô hạn, nên hết hạn thì trả mảng rỗng mà không gọi xuống. */
    @Override
    public byte[] read(int maxBytes, long deadlineNanos) throws DeviceException {
        UsbDeviceConnection connection = requireConnection();
        UsbEndpoint endpoint = inEndpoint;

        if (endpoint == null) {
            throw new DeviceException(DeviceErrorCode.READ_NOT_SUPPORTED, "Máy in USB không có endpoint đọc");
        }

        int timeoutMillis = remainingMillis(deadlineNanos);

        if (timeoutMillis <= 0) {
            return new byte[0];
        }

        byte[] buffer = new byte[maxBytes];
        int received = connection.bulkTransfer(endpoint, buffer, maxBytes, timeoutMillis);

        if (received >= 0) {
            return Arrays.copyOf(buffer, received);
        }

        if (!isOpen()) {
            throw new DeviceException(DeviceErrorCode.READ_FAILED, "Mất kết nối USB khi đọc");
        }

        return new byte[0];
    }

    /** USB không có dữ liệu chờ gửi sau khi bulkTransfer trả về, nên đóng bình thường cũng là đóng ngay. */
    @Override
    public void close() {
        abort();
    }

    /** Nhả interface và đóng kết nối USB; gọi được trong lúc luồng khác đang bulkTransfer để cắt ngang. */
    @Override
    public synchronized void abort() {
        UsbDeviceConnection connection = deviceConnection;
        deviceConnection = null;

        if (connection == null) {
            return;
        }

        connection.releaseInterface(claimedInterface);
        connection.close();
    }

    /** Rút dây không làm UsbDeviceConnection tự báo lỗi, nên kiểm thêm thiết bị còn trong danh sách của hệ thống. */
    @Override
    public boolean isOpen() {
        return deviceConnection != null && usbManager.getDeviceList().containsKey(device.getDeviceName());
    }

    @Override
    public String hardwareAddress() {
        return device.getDeviceName();
    }

    @Override
    public DeviceAddress address() {
        return address;
    }

    /** Thiếu tên sản phẩm thì dùng đường dẫn thiết bị, giống lúc quét. */
    @Override
    public String name() {
        String productName = productName();
        return productName != null ? productName : device.getDeviceName();
    }

    @Override
    public String manufacturerName() {
        return readString(device::getManufacturerName);
    }

    @Override
    public String productName() {
        return readString(device::getProductName);
    }

    /** Ghi tới khi đủ, mỗi khúc tối đa 16 KB với thời gian chờ là phần còn lại của hạn. */
    public static void writeInChunks(
            byte[] data,
            long deadlineNanos,
            IChunkWriter chunkWriter) throws DeviceException {
        int written = 0;

        while (written < data.length) {
            int timeoutMillis = remainingMillis(deadlineNanos);

            if (timeoutMillis <= 0) {
                throw writeTimeout(written);
            }

            int length = Math.min(USB_CHUNK_SIZE_BYTES, data.length - written);
            int transferred = chunkWriter.write(data, written, length, timeoutMillis);

            if (transferred < 0) {
                throw failureAfter(written, deadlineNanos);
            }

            written += transferred;
        }
    }

    private UsbDeviceConnection requireConnection() throws DeviceException {
        UsbDeviceConnection connection = deviceConnection;

        if (connection == null) {
            throw new DeviceException(DeviceErrorCode.NOT_CONNECTED, "USB chưa mở");
        }

        return connection;
    }

    /** Từ Android 10, đọc serial khi chưa có quyền USB ném SecurityException. */
    private String readSerial() {
        return readString(device::getSerialNumber);
    }

    private static String readString(Supplier<String> reader) {
        try {
            return reader.get();
        } catch (SecurityException exception) {
            return null;
        }
    }

    private static int remainingMillis(long deadlineNanos) {
        long remaining = TimeUnit.NANOSECONDS.toMillis(deadlineNanos - System.nanoTime());
        return (int) Math.max(0, Math.min(Integer.MAX_VALUE, remaining));
    }

    private static DeviceException failureAfter(int written, long deadlineNanos) {
        if (remainingMillis(deadlineNanos) <= 0) {
            return writeTimeout(written);
        }

        return new DeviceException(DeviceErrorCode.WRITE_FAILED, "Ghi USB thất bại").withBytesWritten(written);
    }

    private static DeviceException writeTimeout(int written) {
        return new DeviceException(DeviceErrorCode.WRITE_TIMEOUT, "Hết hạn khi ghi USB").withBytesWritten(written);
    }
}
