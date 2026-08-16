import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { selectCurrentStoreId } from '../../store/store/storeSlice';
import { orderApi } from '../api/orderApi';
import { buildReprintDocument, printReceipt } from '../services/OrderPrintTrigger';
import type { OrderHistoryItem } from '../types/cart.types';

export const getTodayRange = (now: Date): { fromDate: string; toDate: string } => {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { fromDate: startOfDay.toISOString(), toDate: now.toISOString() };
};

export const useOrderHistory = () => {
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprintingId, setReprintingId] = useState<number | null>(null);
  const [noReceiptPrinterConfigured, setNoReceiptPrinterConfigured] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (storeId === null) return;

    setIsLoading(true);
    setError(null);
    try {
      const { fromDate, toDate } = getTodayRange(new Date());
      const response = await orderApi.getOrderHistoryAsync(storeId, fromDate, toDate);
      if (!response.IsSuccess || !response.Data) {
        throw new Error(response.Error?.Message ?? 'Không thể tải danh sách đơn hàng');
      }
      setOrders(response.Data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách đơn hàng');
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reprint = useCallback(async (orderId: number): Promise<void> => {
    setReprintingId(orderId);
    try {
      const response = await orderApi.getOrderByIdAsync(orderId);
      if (!response.IsSuccess || !response.Data) {
        throw new Error(response.Error?.Message ?? 'Không thể tải chi tiết đơn hàng');
      }
      const document = buildReprintDocument(response.Data);
      setNoReceiptPrinterConfigured(await printReceipt(document));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'In lại thất bại');
    } finally {
      setReprintingId(null);
    }
  }, []);

  const dismissError = useCallback(() => setError(null), []);
  const dismissReceiptPrinterWarning = useCallback(() => setNoReceiptPrinterConfigured(false), []);

  return {
    orders,
    isLoading,
    error,
    dismissError,
    reprint,
    reprintingId,
    noReceiptPrinterConfigured,
    dismissReceiptPrinterWarning,
    refresh,
  };
};
