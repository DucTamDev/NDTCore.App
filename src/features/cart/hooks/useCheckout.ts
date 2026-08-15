// src/features/cart/hooks/useCheckout.ts
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { selectCurrentStoreId } from '../../store/store/storeSlice';
import { CartService } from '../services/CartService';
import { buildReceiptDocument, printReceipt } from '../services/OrderPrintTrigger';
import { orderApi } from '../api/orderApi';
import { cartCleared, selectCartItems, selectCartNote, selectServiceType } from '../store/cartSlice';
import type { CreateOrderResponse } from '../types/cart.types';

export const useCheckout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));
  const items = useSelector((state: RootState) => selectCartItems(state));
  const serviceType = useSelector((state: RootState) => selectServiceType(state));
  const note = useSelector((state: RootState) => selectCartNote(state));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noReceiptPrinterConfigured, setNoReceiptPrinterConfigured] = useState(false);

  const submit = useCallback(async (): Promise<CreateOrderResponse | null> => {
    if (storeId === null || items.length === 0) return null;

    setIsSubmitting(true);
    setError(null);
    try {
      const request = CartService.toCreateOrderRequest(storeId, items, serviceType, note);
      const response = await orderApi.createOrderAsync(request);
      if (!response.IsSuccess || !response.Data) {
        throw new Error(response.Error?.Message ?? 'Không thể tạo đơn hàng');
      }
      dispatch(cartCleared());
      // Không await: submit() phải trả về ngay khi đơn hàng được tạo thành
      // công, không chờ việc in ấn (fire-and-forget theo spec §5).
      const document = buildReceiptDocument(response.Data, items, serviceType);
      printReceipt(document).then(setNoReceiptPrinterConfigured);
      return response.Data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo đơn hàng');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, storeId, items, serviceType, note]);

  const dismissError = useCallback(() => setError(null), []);
  const dismissReceiptPrinterWarning = useCallback(() => setNoReceiptPrinterConfigured(false), []);

  return { submit, isSubmitting, error, dismissError, noReceiptPrinterConfigured, dismissReceiptPrinterWarning };
};
