export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

export interface PaginatedResponse<T> {
  readonly success: boolean;
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}
