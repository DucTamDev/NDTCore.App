export interface ApiResponseError {
  ErrorCode: string;
  Message: string;
  Meta?: unknown;
}

export interface ApiResponse<T> {
  IsSuccess: boolean;
  Data: T | null;
  Message: string | null;
  Error: ApiResponseError | null;
}

export interface PagedApiResponse<T> extends ApiResponse<T[]> {
  PageNumber: number;
  PageSize: number;
  TotalCount: number;
  TotalPages: number;
  HasPreviousPage: boolean;
  HasNextPage: boolean;
}
