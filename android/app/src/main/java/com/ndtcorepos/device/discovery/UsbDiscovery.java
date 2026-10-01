package com.ndtcorepos.device.discovery;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.model.DeviceInfo;
import com.ndtcorepos.device.permission.UsbPermission;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/** Liệt kê thiết bị USB có thể nhận dữ liệu in và tìm đúng thiết bị cho một địa chỉ USB. */
public final class UsbDiscovery implements IDeviceDiscovery {

    /** Đọc serial của một ứng viên, xin quyền nếu cần. */
    public interface ISerialReader<T> {
        String readSerial(T candidate) throws DeviceException;
    }

    private final UsbManager usbManager;

    private final UsbPermission usbPermission;

    public UsbDiscovery(UsbManager usbManager, UsbPermission usbPermission) {
        this.usbManager = usbManager;
        this.usbPermission = usbPermission;
    }

    /** Không mở hộp thoại xin quyền; thiết bị chưa có quyền trả serial `null`. */
    @Override
    public List<DeviceInfo> discover() throws DeviceException {
        List<DeviceInfo> devices = new ArrayList<>();

        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (findPrinterInterface(device) != null) {
                devices.add(toDeviceInfo(device));
            }
        }

        return devices;
    }

    /** Có thể hiện hộp thoại xin quyền và chặn luồng gọi nên chỉ gọi từ luồng mở kết nối. */
    public UsbDevice find(DeviceAddress address) throws DeviceException {
        UsbDevice device = chooseCandidate(
                candidatesFor(address),
                address.serialNumber(),
                address.devicePath(),
                this::readSerialWithPermission,
                UsbDevice::getDeviceName);
        usbPermission.request(device);
        return device;
    }

    /**
     * Luật chọn: có serial thì phải khớp serial; không có serial thì khớp `devicePath`; còn lại chỉ chọn khi có đúng
     * một ứng viên. Không bao giờ âm thầm chọn máy đầu tiên.
     */
    public static <T> T chooseCandidate(
            List<T> candidates,
            String targetSerial,
            String targetDevicePath,
            ISerialReader<T> serialReader,
            Function<T, String> devicePathOf) throws DeviceException {
        if (candidates.isEmpty()) {
            throw new DeviceException(DeviceErrorCode.DEVICE_NOT_FOUND, "Không thấy thiết bị USB");
        }

        if (targetSerial != null) {
            return chooseBySerial(candidates, targetSerial, serialReader);
        }

        T byDevicePath = findByDevicePath(candidates, targetDevicePath, devicePathOf);

        if (byDevicePath != null) {
            return byDevicePath;
        }

        if (candidates.size() == 1) {
            return candidates.get(0);
        }

        throw new DeviceException(DeviceErrorCode.AMBIGUOUS_DEVICE, "Nhiều máy USB cùng loại, cần serial để phân biệt");
    }

    /** Interface đầu tiên có endpoint bulk OUT; thiết bị gộp nhiều chức năng có thể có interface HID đứng trước. */
    public static UsbInterface findPrinterInterface(UsbDevice device) {
        for (int index = 0; index < device.getInterfaceCount(); index++) {
            UsbInterface usbInterface = device.getInterface(index);

            if (findBulkEndpoint(usbInterface, UsbConstants.USB_DIR_OUT) != null) {
                return usbInterface;
            }
        }

        return null;
    }

    public static UsbEndpoint findBulkEndpoint(UsbInterface usbInterface, int direction) {
        for (int index = 0; index < usbInterface.getEndpointCount(); index++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(index);

            if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.getDirection() == direction) {
                return endpoint;
            }
        }

        return null;
    }

    private static <T> T chooseBySerial(
            List<T> candidates,
            String targetSerial,
            ISerialReader<T> serialReader) throws DeviceException {
        for (T candidate : candidates) {
            if (targetSerial.equals(serialReader.readSerial(candidate))) {
                return candidate;
            }
        }

        throw new DeviceException(DeviceErrorCode.DEVICE_NOT_FOUND, "Không thấy máy USB có serial " + targetSerial);
    }

    private static <T> T findByDevicePath(
            List<T> candidates,
            String targetDevicePath,
            Function<T, String> devicePathOf) {
        if (targetDevicePath == null) {
            return null;
        }

        for (T candidate : candidates) {
            if (targetDevicePath.equals(devicePathOf.apply(candidate))) {
                return candidate;
            }
        }

        return null;
    }

    /** Ứng viên cùng vendorId/productId có bulk OUT; thiết bị đã có quyền xếp trước để hạn chế hộp thoại. */
    private List<UsbDevice> candidatesFor(DeviceAddress address) {
        List<UsbDevice> permitted = new ArrayList<>();
        List<UsbDevice> notPermitted = new ArrayList<>();

        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (!matchesIds(device, address) || findPrinterInterface(device) == null) {
                continue;
            }

            List<UsbDevice> group = usbPermission.hasPermission(device) ? permitted : notPermitted;
            group.add(device);
        }

        permitted.addAll(notPermitted);
        return permitted;
    }

    private static boolean matchesIds(UsbDevice device, DeviceAddress address) {
        return device.getVendorId() == address.vendorId() && device.getProductId() == address.productId();
    }

    private String readSerialWithPermission(UsbDevice device) throws DeviceException {
        usbPermission.request(device);
        return readSerial(device);
    }

    private DeviceInfo toDeviceInfo(UsbDevice device) throws DeviceException {
        boolean hasPermission = usbPermission.hasPermission(device);
        String serialNumber = hasPermission ? readSerial(device) : null;
        DeviceAddress address = DeviceAddress.usb(
                device.getVendorId(),
                device.getProductId(),
                serialNumber,
                device.getDeviceName());
        String name = device.getProductName() != null ? device.getProductName() : device.getDeviceName();
        return DeviceInfo.usb(
                "usb:" + device.getDeviceName(),
                name,
                address,
                device.getManufacturerName(),
                device.getProductName(),
                hasPermission);
    }

    /** Từ Android 10, đọc serial khi chưa có quyền USB ném SecurityException. */
    private static String readSerial(UsbDevice device) {
        try {
            return device.getSerialNumber();
        } catch (SecurityException exception) {
            return null;
        }
    }
}
