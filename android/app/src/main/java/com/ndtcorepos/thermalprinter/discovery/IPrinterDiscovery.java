package com.ndtcorepos.thermalprinter.discovery;

import com.ndtcorepos.thermalprinter.error.PrinterException;
import com.ndtcorepos.thermalprinter.printer.PrinterInfo;

import java.util.List;

/**
 * Tìm các printer khả dụng cho 1 loại kết nối.
 */
public interface IPrinterDiscovery {

    /**
     * Quét thiết bị khả dụng.
     *
     * @throws PrinterException DISCOVERY_FAILED nếu hệ thống USB/Bluetooth không sẵn sàng
     */
    List<PrinterInfo> discover() throws PrinterException;
}
