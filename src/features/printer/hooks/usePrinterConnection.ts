import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { printerConnectionService } from '../connection/PrinterConnectionService';
import { printerStatusChanged, selectPrinterStatus } from '../store/printerSlice';
import type { PrinterConnectionStatus } from '../models/printer/PrinterConnectionStatus';

export const usePrinterConnection = (printerId: string): PrinterConnectionStatus => {
  const dispatch = useDispatch<AppDispatch>();
  const status = useSelector((state: RootState) => selectPrinterStatus(state, printerId));

  useEffect(() => {
    dispatch(printerStatusChanged({ printerId, status: printerConnectionService.getStatus(printerId) }));
    const unsubscribe = printerConnectionService.onStatusChange(printerId, (nextStatus) => {
      dispatch(printerStatusChanged({ printerId, status: nextStatus }));
    });
    return unsubscribe;
  }, [dispatch, printerId]);

  return status;
};
