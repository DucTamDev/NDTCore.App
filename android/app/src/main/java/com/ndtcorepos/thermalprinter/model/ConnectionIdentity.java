package com.ndtcorepos.thermalprinter.model;

import com.ndtcorepos.thermalprinter.enums.ConnectionType;
import com.ndtcorepos.thermalprinter.enums.IdentityStability;

import java.util.Objects;

/**
 * Identifies one physical printer connection at runtime.
 *
 * The identity is used as the key for device reuse, queue serialization,
 * and runtime resource management.
 *
 * The identity does not represent a printer business configuration.
 */
public final class ConnectionIdentity {

    /**
     * Unique value used to identify the physical connection.
     *
     * Examples:
     *
     * USB:11575:33751:ABC123
     * BLUETOOTH:AA:BB:CC:DD:EE:FF
     * NETWORK:192.168.1.100:9100
     */
    private final String value;

    /**
     * Transport used by this connection.
     */
    private final ConnectionType type;

    /**
     * Indicates whether the identity remains stable across reconnects.
     */
    private final IdentityStability stability;


    /**
     * Creates a connection identity.
     *
     * @param value unique connection identity value
     * @param type transport type
     * @param stability identity stability
     */
    public ConnectionIdentity(
            String value,
            ConnectionType type,
            IdentityStability stability
    ) {
        this.value = Objects.requireNonNull(value);
        this.type = Objects.requireNonNull(type);
        this.stability = Objects.requireNonNull(stability);
    }


    /**
     * Returns the unique connection identity value.
     *
     * @return connection identity value
     */
    public String getValue() {
        return value;
    }


    /**
     * Returns the transport type.
     *
     * @return connection type
     */
    public ConnectionType getType() {
        return type;
    }


    /**
     * Returns the stability classification of this identity.
     *
     * @return identity stability
     */
    public IdentityStability getStability() {
        return stability;
    }


    /**
     * Compares identities by their runtime identity value.
     *
     * @param object object to compare
     * @return true when both objects represent the same connection identity
     */
    @Override
    public boolean equals(Object object) {

        if (this == object) {
            return true;
        }

        if (!(object instanceof ConnectionIdentity)) {
            return false;
        }

        ConnectionIdentity other =
                (ConnectionIdentity) object;

        return value.equals(other.value);
    }


    /**
     * Returns the hash code derived from the identity value.
     *
     * @return identity hash code
     */
    @Override
    public int hashCode() {
        return value.hashCode();
    }


    /**
     * Returns the identity value.
     *
     * @return connection identity
     */
    @Override
    public String toString() {
        return value;
    }
}
