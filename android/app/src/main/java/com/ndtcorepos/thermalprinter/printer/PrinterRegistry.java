package com.ndtcorepos.thermalprinter.printer;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry thread-safe các printer đang được native quản lý, khoá theo printerId.
 */
public final class PrinterRegistry {

    private final Map<String, PrinterDevice> devices = new ConcurrentHashMap<>();

    /**
     * Tìm printer theo id.
     *
     * @param printerId id cần tìm
     * @return printer tương ứng, null nếu chưa có
     */
    public PrinterDevice get(String printerId) {
        return devices.get(printerId);
    }

    /**
     * Thêm/thay thế printer trong registry.
     *
     * @param printerId khoá đăng ký
     * @param device printer cần lưu
     */
    public void put(String printerId, PrinterDevice device) {
        devices.put(printerId, device);
    }

    /**
     * Xoá printer khỏi registry.
     *
     * @param printerId id cần xoá
     */
    public void remove(String printerId) {
        devices.remove(printerId);
    }

    /**
     * Tất cả printer đang quản lý.
     */
    public List<PrinterDevice> getAll() {
        return List.copyOf(devices.values());
    }
}
