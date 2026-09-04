package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;

/**
 * Đích kết nối bất biến — Native chỉ thấy vendorId/productId (USB), mac
 * address (Bluetooth) hoặc host/port (LAN); không biết ESC/POS/TSPL.
 * `sealed` + `instanceof` pattern-matching ở nơi dùng (switch pattern-matching
 * cần Java 21, project pin Java 17 qua RN gradle plugin nên không dùng được).
 * `type()` chỉ trả hằng số của chính record đó — không phải field dữ liệu
 * dùng chung, nên không vi phạm ISP như thiết kế cũ.
 */
public sealed interface PrinterConnection {

    ConnectionType type();

    record Usb(int vendorId, int productId) implements PrinterConnection {
        @Override
        public ConnectionType type() {
            return ConnectionType.USB;
        }
    }

    record Bluetooth(String address) implements PrinterConnection {
        @Override
        public ConnectionType type() {
            return ConnectionType.BLUETOOTH;
        }
    }

    record Lan(String host, int port) implements PrinterConnection {
        @Override
        public ConnectionType type() {
            return ConnectionType.LAN;
        }
    }
}
