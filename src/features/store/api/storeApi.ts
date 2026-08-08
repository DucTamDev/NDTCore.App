import { HttpClient } from '../../../services/http/HttpClient';
import type { PagedApiResponse } from '../../../types/ApiResponse';
import type { StoreDto } from '../types/store.types';

export const storeApi = {
  getPagedAsync(): Promise<PagedApiResponse<StoreDto>> {
    return HttpClient.getPaged('/admin/store', { params: { PageNumber: 1, PageSize: 100 } });
  },
};
