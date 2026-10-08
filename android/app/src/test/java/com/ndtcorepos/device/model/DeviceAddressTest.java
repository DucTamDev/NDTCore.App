package com.ndtcorepos.device.model;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.Test;

public class DeviceAddressTest {

    private interface IAddressFactory {
        DeviceAddress create() throws DeviceException;
    }

    @Test
    public void usbLookupKeyPrefersSerialThenDevicePath() throws Exception {
        assertEquals("usb:8137:8214:SN1", DeviceAddress.usb(8137, 8214, "SN1", "/dev/bus/usb/001/004").lookupKey());
        assertEquals("usb:8137:8214:@/dev/bus/usb/001/004", DeviceAddress.usb(8137, 8214, null, "/dev/bus/usb/001/004")
                .lookupKey());
        assertEquals("usb:8137:8214", DeviceAddress.usb(8137, 8214, null, null).lookupKey());
    }

    @Test
    public void deviceIdIgnoresUsbPathButKeepsSerial() throws Exception {
        assertEquals("usb:8137:8214:SN1", DeviceAddress.usb(8137, 8214, "SN1", "/dev/bus/usb/001/004").deviceId());
        assertEquals("usb:8137:8214", DeviceAddress.usb(8137, 8214, null, "/dev/bus/usb/001/004").deviceId());
        assertEquals("bluetooth:AA:BB", DeviceAddress.bluetooth("aa:bb").deviceId());
        assertEquals("lan:10.0.0.1:9100", DeviceAddress.lan("10.0.0.1", 9100).deviceId());
    }

    @Test
    public void usbEmptySerialAndPathBecomeNull() throws Exception {
        DeviceAddress address = DeviceAddress.usb(1, 2, "", "");

        assertNull(address.serialNumber());
        assertNull(address.devicePath());
    }

    @Test
    public void usbIdsOutsideRangeAreInvalid() {
        assertInvalid(() -> DeviceAddress.usb(-1, 2, null, null));
        assertInvalid(() -> DeviceAddress.usb(1, 70_000, null, null));
    }

    @Test
    public void bluetoothMacIsUppercased() throws Exception {
        DeviceAddress address = DeviceAddress.bluetooth("66:22:a1:b2:c3:d4");

        assertEquals("66:22:A1:B2:C3:D4", address.mac());
        assertEquals("bluetooth:66:22:A1:B2:C3:D4", address.lookupKey());
    }

    @Test
    public void blankBluetoothMacIsInvalid() {
        assertInvalid(() -> DeviceAddress.bluetooth(" "));
    }

    @Test
    public void lanValidatesHostAndPort() throws Exception {
        assertEquals("lan:192.168.1.50:9100", DeviceAddress.lan("192.168.1.50", 9100).lookupKey());
        assertInvalid(() -> DeviceAddress.lan("192.168.1.50", 0));
        assertInvalid(() -> DeviceAddress.lan("", 9100));
    }

    private static void assertInvalid(IAddressFactory factory) {
        try {
            factory.create();
            fail("Mong đợi INVALID_ARGUMENT");
        } catch (DeviceException exception) {
            assertEquals(DeviceErrorCode.INVALID_ARGUMENT, exception.errorCode());
        }
    }
}
