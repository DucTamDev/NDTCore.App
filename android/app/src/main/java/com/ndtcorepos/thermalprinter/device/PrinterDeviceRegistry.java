package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;

import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;

/**
 * Stores active printer device runtimes indexed by connection identity.
 *
 * The registry does not own printer configuration or queue execution.
 */
public final class PrinterDeviceRegistry {

    /**
     * Active runtime devices indexed by their physical connection identity.
     */
    private final Map<ConnectionIdentity, IPrinterDevice> devices =
            new HashMap<>();


    /**
     * Registers a runtime printer device.
     *
     * @param device printer runtime device
     */
    public synchronized void register(
            IPrinterDevice device
    ) {
        devices.put(
                device.getConnectionIdentity(),
                device
        );
    }


    /**
     * Returns the runtime device for an identity.
     *
     * @param identity physical connection identity
     * @return runtime device or null
     */
    public synchronized IPrinterDevice get(
            ConnectionIdentity identity
    ) {
        return devices.get(identity);
    }


    /**
     * Checks whether a runtime device is registered.
     *
     * @param identity physical connection identity
     * @return true when registered
     */
    public synchronized boolean contains(
            ConnectionIdentity identity
    ) {
        return devices.containsKey(identity);
    }


    /**
     * Removes and returns a runtime device.
     *
     * @param identity physical connection identity
     * @return removed device or null
     */
    public synchronized IPrinterDevice remove(
            ConnectionIdentity identity
    ) {
        return devices.remove(identity);
    }


    /**
     * Removes all registered runtime devices.
     */
    public synchronized void clear() {
        devices.clear();
    }

    /** Returns a stable snapshot of the active runtime devices. */
    public synchronized List<IPrinterDevice> snapshot() {
        return new ArrayList<>(devices.values());
    }
}
