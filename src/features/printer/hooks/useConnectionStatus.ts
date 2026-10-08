import { useCallback, useSyncExternalStore } from 'react';
import { printerConnectionService } from '../connection/PrinterConnectionService';
import type { ConnectionStatus } from '../models/connections/ConnectionStatus';

/** Trạng thái kết nối của một máy in, đọc thẳng từ `PrinterConnectionService` (nguồn sự thật, chỉ trong bộ nhớ). */
export const useConnectionStatus = (printerId: string): ConnectionStatus => {
  const subscribe = useCallback(
    (onChange: () => void) => printerConnectionService.onStatusChange(printerId, onChange),
    [printerId],
  );
  const getSnapshot = useCallback(() => printerConnectionService.getStatus(printerId), [printerId]);

  return useSyncExternalStore(subscribe, getSnapshot);
};
