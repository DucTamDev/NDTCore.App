package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;

/**
 * Manages active physical printer runtimes.
 *
 * The manager reuses one runtime device for the same connection identity.
 *
 * It does not manage printer business configuration, printer types,
 * drivers, paper settings, or print jobs.
 */
public final class PrinterDeviceManager {

    /**
     * Registry containing active runtime printer devices.
     */
    private final PrinterDeviceRegistry registry;


    /**
     * Creates a printer device manager.
     *
     * @param registry runtime device registry
     */
    public PrinterDeviceManager(
            PrinterDeviceRegistry registry
    ) {
        this.registry = registry;
    }


    /**
     * Registers a runtime device.
     *
     * @param device runtime printer device
     */
    public synchronized void register(
            IPrinterDevice device
    ) {
        registry.register(device);
    }


    /**
     * Returns an active runtime device.
     *
     * @param identity physical connection identity
     * @return runtime device or null
     */
    public synchronized IPrinterDevice get(
            ConnectionIdentity identity
    ) {
        return registry.get(identity);
    }

    /** Removes a runtime device from the registry without closing it. */
    public synchronized IPrinterDevice remove(
            ConnectionIdentity identity
    ) {
        return registry.remove(identity);
    }


    /**
     * Closes and removes all active runtime devices.
     */
    public synchronized void closeAll() {

        for (IPrinterDevice device : registry.snapshot()) {
            device.close();
        }

        registry.clear();
    }
}
