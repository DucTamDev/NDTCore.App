package com.ndtcorepos.device.connection;

import com.ndtcorepos.device.error.DeviceErrorCode;
import com.ndtcorepos.device.error.DeviceException;
import com.ndtcorepos.device.model.DeviceAddress;
import com.ndtcorepos.device.transport.ITransport;
import com.ndtcorepos.device.transport.ITransportFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Factory giả: mỗi lần tạo một `FakeTransport`, địa chỉ phần cứng tra theo `lookupKey` của địa chỉ. */
final class FakeTransportFactory implements ITransportFactory {

    private static final long GATE_TIMEOUT_SECONDS = 5;

    /** `lookupKey` → địa chỉ phần cứng; không có thì dùng `lookupKey` bỏ tiền tố loại (vd `10.0.0.1:9100`). */
    final Map<String, String> hardwareByLookupKey = new ConcurrentHashMap<>();

    final List<FakeTransport> created = new CopyOnWriteArrayList<>();

    /** Nhật ký mở/đóng dùng chung của mọi transport đã tạo. */
    final List<String> events = Collections.synchronizedList(new ArrayList<>());

    final CountDownLatch createEntered = new CountDownLatch(1);

    /** Khác `null` thì `create` chờ latch này (giả lập chờ hộp thoại quyền USB; bị ngắt thì báo từ chối quyền). */
    volatile CountDownLatch createGate;

    /** Gắn vào mọi transport tạo ra: `open` chờ latch này. */
    volatile CountDownLatch openGate;

    /** Khác `null` thì transport trả địa chỉ này sau khi mở (vd USB đọc thêm serial); không thì trả địa chỉ yêu cầu. */
    volatile DeviceAddress openedAddress;

    /** Tên transport trả sau khi mở. */
    volatile String name;

    @Override
    public ITransport create(DeviceAddress address) throws DeviceException {
        createEntered.countDown();
        awaitGate(createGate);
        String lookupKey = address.lookupKey();
        String defaultHardwareAddress = lookupKey.substring(lookupKey.indexOf(':') + 1);
        String hardwareAddress = hardwareByLookupKey.getOrDefault(lookupKey, defaultHardwareAddress);
        DeviceAddress opened = openedAddress != null ? openedAddress : address;
        FakeTransport transport = new FakeTransport(hardwareAddress, opened, name, events);
        transport.openGate = openGate;
        created.add(transport);
        return transport;
    }

    FakeTransport transport(int index) {
        return created.get(index);
    }

    private static void awaitGate(CountDownLatch gate) throws DeviceException {
        if (gate == null) {
            return;
        }

        try {
            gate.await(GATE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new DeviceException(DeviceErrorCode.PERMISSION_DENIED, "bị ngắt khi chờ quyền");
        }
    }
}
