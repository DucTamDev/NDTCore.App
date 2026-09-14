package com.ndtcorepos.thermalprinter.device;

import com.ndtcorepos.thermalprinter.model.ConnectionIdentity;

import java.util.HashMap;
import java.util.Map;

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
     * Reference counts for active device consumers.
     */
    private final Map<ConnectionIdentity, Integer> referenceCounts =
            new HashMap<>();


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
     * Acquires an existing runtime device.
     *
     * @param identity physical connection identity
     * @return device handle
     * @throws IllegalStateException when the device is not registered
     */
    public synchronized PrinterDeviceHandle acquire(
            ConnectionIdentity identity
    ) {
        IPrinterDevice device =
                registry.get(identity);

        if (device == null) {
            throw new IllegalStateException(
                    "Printer device is not registered: "
                            + identity
            );
        }

        int count =
                referenceCounts.getOrDefault(
                        identity,
                        0
                );

        referenceCounts.put(
                identity,
                count + 1
        );

        return new PrinterDeviceHandle(
                device,
                () -> release(identity)
        );
    }


    /**
     * Registers a runtime device without acquiring a consumer reference.
     *
     * @param device runtime printer device
     */
    public synchronized void register(
            IPrinterDevice device
    ) {
        registry.register(device);
        referenceCounts.putIfAbsent(
                device.getConnectionIdentity(),
                0
        );
    }


    /**
     * Releases one consumer reference.
     *
     * The runtime device is removed when no consumer remains.
     *
     * @param identity physical connection identity
     */
    public synchronized void release(
            ConnectionIdentity identity
    ) {
        Integer count =
                referenceCounts.get(identity);

        if (count == null) {
            return;
        }

        if (count <= 1) {

            referenceCounts.remove(identity);

            IPrinterDevice device =
                    registry.remove(identity);

            if (device != null) {
                device.close();
            }

            return;
        }

        referenceCounts.put(
                identity,
                count - 1
        );
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

    /** Removes a runtime device without applying consumer reference counting. */
    public synchronized IPrinterDevice remove(
            ConnectionIdentity identity
    ) {
        referenceCounts.remove(identity);
        return registry.remove(identity);
    }


    /**
     * Closes and removes all active runtime devices.
     */
    public synchronized void closeAll() {

        referenceCounts.clear();

        for (IPrinterDevice device : registry.snapshot()) {
            device.close();
        }

        registry.clear();
    }
}
