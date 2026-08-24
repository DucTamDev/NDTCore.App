// src/features/cart/hooks/useCheckout.ts
import { useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { selectCurrentStore, selectCurrentStoreId } from '../../store/store/storeSlice';
import { CartService } from '../services/CartService';
import { buildReceiptDocument, printReceipt, type CaptureBillImage, type PrintReceiptOutcome } from '../services/OrderPrintTrigger';
import { orderApi } from '../api/orderApi';
import { cartCleared, selectCartItems, selectCartNote, selectServiceType } from '../store/cartSlice';
import type { CreateOrderResponse } from '../types/cart.types';

export const useCheckout = (captureBillImage: CaptureBillImage) => {
  const dispatch = useDispatch<AppDispatch>();
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));
  const currentStore = useSelector((state: RootState) => selectCurrentStore(state));
  const items = useSelector((state: RootState) => selectCartItems(state));
  const serviceType = useSelector((state: RootState) => selectServiceType(state));
  const note = useSelector((state: RootState) => selectCartNote(state));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptPrintWarning, setReceiptPrintWarning] = useState<Exclude<PrintReceiptOutcome, 'ok'> | null>(null);
  // Ref, không chỉ state isSubmitting — 2 lần bấm "Thanh toán" lọt vào cùng 1
  // tick đồng bộ đều có thể qua được guard nếu chỉ dựa vào state (cập nhật
  // bất đồng bộ), gây tạo đơn trùng.
  const isSubmittingRef = useRef(false);

  const submit = useCallback(async (): Promise<CreateOrderResponse | null> => {
    if (items.length === 0 || isSubmittingRef.current) return null;
    if (storeId === null) {
      setError('Chưa chọn cửa hàng, không thể tạo đơn hàng');
      return null;
    }

    isSubmittingRef.current = true;
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
      const document = buildReceiptDocument(response.Data, items, serviceType, currentStore);
      printReceipt(document, captureBillImage).then((outcome) => {
        if (outcome !== 'ok') setReceiptPrintWarning(outcome);
      });
      return response.Data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo đơn hàng');
      return null;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [dispatch, storeId, items, serviceType, note, currentStore, captureBillImage]);

  const dismissError = useCallback(() => setError(null), []);
  const dismissReceiptPrintWarning = useCallback(() => setReceiptPrintWarning(null), []);

  return { submit, isSubmitting, error, dismissError, receiptPrintWarning, dismissReceiptPrintWarning };
};
