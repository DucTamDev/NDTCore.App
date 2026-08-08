import { HttpClient } from '../../../services/http/HttpClient';
import type { ApiResponse } from '../../../types/ApiResponse';
import type { PosCatalogDto } from '../types/catalog.types';

export const catalogApi = {
  getCatalogAsync(storeId: number): Promise<ApiResponse<PosCatalogDto>> {
    return HttpClient.get(`/pos/store/${storeId}/catalog`);
  },
};
