package com.ndtcorepos.thermalprinter.model;

/**
 * Đích kết nối bất biến — Native chỉ thấy vendorId/productId (USB), mac
 * address (Bluetooth) hoặc host/port (LAN); không biết ESC/POS/TSPL.
 * `sealed` + pattern-matching switch ở nơi dùng để compiler bắt lỗi nếu
 * thiếu case khi có thêm loại kết nối mới.
 */
public sealed interface PrinterConnection {

    record Usb(int vendorId, int productId) implements PrinterConnection {
    }

    record Bluetooth(String address) implements PrinterConnection {
    }

    record Lan(String host, int port) implements PrinterConnection {
    }
}
