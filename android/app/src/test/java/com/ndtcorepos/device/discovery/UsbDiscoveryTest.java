package com.ndtcorepos.device.discovery;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class UsbDiscoveryTest {

    /** Ứng viên giả thay cho `UsbDevice`: đường dẫn thiết bị và serial đọc được sau khi có quyền. */
    private static final class Candidate {

        private final String devicePath;

        private final String serialNumber;

        private Candidate(String devicePath, String serialNumber) {
            this.devicePath = devicePath;
            this.serialNumber = serialNumber;
        }
    }

    private final Candidate first = new Candidate("/dev/bus/usb/001/004", "SN-A");

    private final Candidate second = new Candidate("/dev/bus/usb/001/005", "SN-B");

    @Test
    public void noCandidateIsDeviceNotFound() {
        assertFailure(DeviceErrorCode.DEVICE_NOT_FOUND, Collections.emptyList(), null, null);
    }

    @Test
    public void serialPicksMatchingCandidate() throws Exception {
        assertSame(second, choose(Arrays.asList(first, second), "SN-B", null));
    }

    @Test
    public void unmatchedSerialIsDeviceNotFoundEvenWhenPathMatches() {
        assertFailure(DeviceErrorCode.DEVICE_NOT_FOUND, Arrays.asList(first, second), "SN-X", first.devicePath);
    }

    @Test
    public void withoutSerialDevicePathPicksCandidate() throws Exception {
        assertSame(second, choose(Arrays.asList(first, second), null, second.devicePath));
    }

    @Test
    public void withoutSerialSingleCandidateIsChosen() throws Exception {
        assertSame(first, choose(Collections.singletonList(first), null, "/dev/bus/usb/009/009"));
    }

    @Test
    public void withoutSerialManyCandidatesIsAmbiguous() {
        assertFailure(DeviceErrorCode.AMBIGUOUS_DEVICE, Arrays.asList(first, second), null, null);
        assertFailure(DeviceErrorCode.AMBIGUOUS_DEVICE, Arrays.asList(first, second), null, "/dev/bus/usb/009/009");
    }

    @Test
    public void serialReaderFailurePropagates() {
        try {
            UsbDiscovery.chooseCandidate(
                    Collections.singletonList(first),
                    "SN-A",
                    null,
                    candidate -> {
                        throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "từ chối");
                    },
                    candidate -> candidate.devicePath);
            fail("Mong đợi lỗi");
        } catch (DeviceException exception) {
            assertEquals(DeviceErrorCode.PERMISSION_DENIED, exception.errorCode());
        }
    }

    private static Candidate choose(
            List<Candidate> candidates,
            String serial,
            String devicePath) throws Exception {
        return UsbDiscovery.chooseCandidate(
                candidates,
                serial,
                devicePath,
                candidate -> candidate.serialNumber,
                candidate -> candidate.devicePath);
    }

    private static void assertFailure(
            DeviceErrorCode expected,
            List<Candidate> candidates,
            String serial,
            String devicePath) {
        try {
            choose(candidates, serial, devicePath);
            fail("Mong đợi lỗi " + expected);
        } catch (DeviceException exception) {
            assertEquals(expected, exception.errorCode());
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}
