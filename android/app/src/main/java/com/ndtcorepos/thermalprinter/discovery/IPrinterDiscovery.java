package com.ndtcorepos.thermalprinter.discovery;

import com.ndtcorepos.thermalprinter.model.PrinterDescriptor;

import java.util.List;

/**
 * Discovers physical printer devices available through one transport.
 *
 * Discovery does not open devices, request permission, or transmit data.
 */
public interface IPrinterDiscovery {

    /**
     * Discovers currently available printer devices.
     *
     * @return discovered printer descriptors
     */
    List<PrinterDescriptor> discover();
}
