/** Connection settings for a Bluetooth LE printer transport. */
export interface BLEConfig {
  serviceUuid: string;
  characteristicUuid: string;
}

/** Well-known BLE service/characteristic UUIDs for common thermal printers. */
export const BLE_UUIDS: Record<string, string> = {
  service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  write: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  notify: '49535343-1e4d-4bd9-ba61-23c647249616',
  nordicService: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  nordicWrite: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  nordicNotify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
};
