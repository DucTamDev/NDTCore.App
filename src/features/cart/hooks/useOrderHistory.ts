// src/features/cart/hooks/useOrderHistory.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { selectCurrentStore, selectCurrentStoreId } from '../../store/store/storeSlice';
import { orderApi } from '../api/orderApi';
import { buildReprintDocument, printReceipt, type CaptureBillImage, type PrintReceiptOutcome } from '../services/OrderPrintTrigger';
import type { OrderHistoryItem } from '../types/cart.types';

export const getTodayRange = (now: Date): { fromDate: string; toDate: string } => {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { fromDate: startOfDay.toISOString(), toDate: now.toISOString() };
};

/**
 * Đánh dấu 1 đơn bắt đầu in lại — dùng Set thay vì 1 id đơn lẻ vì cashier có
 * thể bấm "In lại" ở nhiều đơn gần nhau trước khi đơn trước đó in xong; mỗi
 * đơn phải giữ trạng thái loading độc lập, không được đơn sau ghi đè đơn trước.
 */
export const startReprint = (ids: ReadonlySet<number>, orderId: number): Set<number> => new Set(ids).add(orderId);

export const finishReprint = (ids: ReadonlySet<number>, orderId: number): Set<number> => {
  const next = new Set(ids);
  next.delete(orderId);
  return next;
};

export const useOrderHistory = (captureBillImage: CaptureBillImage) => {
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));
  const currentStore = useSelector((state: RootState) => selectCurrentStore(state));
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprintingIds, setReprintingIds] = useState<Set<number>>(new Set());
  const [receiptPrintWarning, setReceiptPrintWarning] = useState<Exclude<PrintReceiptOutcome, 'ok'> | null>(null);
  // Ref (không phải state) để guard chặn fetch chồng lấp mà không đổi identity
  // của refresh() — pull-to-refresh và useEffect lúc mount có thể cùng gọi
  // refresh() gần nhau; nếu đưa isLoading vào deps của useCallback, mỗi lần
  // isLoading đổi sẽ đổi identity refresh(), kéo effect [refresh] chạy lại.
  const isLoadingRef = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (storeId === null || isLoadingRef.current) return;

    isLoadingRef.current = true;
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
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reprint = useCallback(async (orderId: number): Promise<void> => {
    setReprintingIds((prev) => startReprint(prev, orderId));
    setError(null);
    try {
      const response = await orderApi.getOrderByIdAsync(orderId);
      if (!response.IsSuccess || !response.Data) {
        throw new Error(response.Error?.Message ?? 'Không thể tải chi tiết đơn hàng');
      }
      const document = buildReprintDocument(response.Data, currentStore);
      const outcome = await printReceipt(document, captureBillImage);
      if (outcome !== 'ok') setReceiptPrintWarning(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'In lại thất bại');
    } finally {
      setReprintingIds((prev) => finishReprint(prev, orderId));
    }
  }, [currentStore, captureBillImage]);

  const dismissError = useCallback(() => setError(null), []);
  const dismissReceiptPrintWarning = useCallback(() => setReceiptPrintWarning(null), []);

  return {
    orders,
    isLoading,
    error,
    dismissError,
    reprint,
    reprintingIds,
    receiptPrintWarning,
    dismissReceiptPrintWarning,
    refresh,
  };
};
