import { HttpClient } from '../../../services/http/HttpClient';
import type { ApiResponse } from '../../../types/ApiResponse';
import type { CreateOrderRequest, CreateOrderResponse, OrderDetail, OrderHistoryItem } from '../types/cart.types';

export const orderApi = {
  createOrderAsync(request: CreateOrderRequest): Promise<ApiResponse<CreateOrderResponse>> {
    return HttpClient.post('/pos/orders', request);
  },
  getOrderHistoryAsync(storeId: number, fromDate: string, toDate: string): Promise<ApiResponse<OrderHistoryItem[]>> {
    return HttpClient.get(`/pos/store/${storeId}/orders`, { params: { fromDate, toDate } });
  },
  getOrderByIdAsync(id: number): Promise<ApiResponse<OrderDetail>> {
    return HttpClient.get(`/pos/orders/${id}`);
  },
};
