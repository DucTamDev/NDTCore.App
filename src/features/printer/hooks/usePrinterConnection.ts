import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { PrinterConnectionService } from '../services/PrinterConnectionService';
import { printerStatusChanged, selectPrinterStatus } from '../store/printerSlice';
import type { PrinterStatus } from '../models/printer/PrinterStatus';

export const usePrinterConnection = (printerId: string): PrinterStatus => {
  const dispatch = useDispatch<AppDispatch>();
  const status = useSelector((state: RootState) => selectPrinterStatus(state, printerId));

  useEffect(() => {
    dispatch(printerStatusChanged({ printerId, status: PrinterConnectionService.getStatus(printerId) }));
    const unsubscribe = PrinterConnectionService.onStatusChange(printerId, (nextStatus) => {
      dispatch(printerStatusChanged({ printerId, status: nextStatus }));
    });
    return unsubscribe;
  }, [dispatch, printerId]);

  return status;
};
