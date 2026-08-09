import { HttpClient } from '../../../services/http/HttpClient';
import type { ApiResponse } from '../../../types/ApiResponse';
import type { CreateOrderRequest, CreateOrderResponse } from '../types/cart.types';

export const orderApi = {
  createOrderAsync(request: CreateOrderRequest): Promise<ApiResponse<CreateOrderResponse>> {
    return HttpClient.post('/pos/orders', request);
  },
};
