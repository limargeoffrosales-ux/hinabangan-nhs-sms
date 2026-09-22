// Type-safe wrapper around the api function
import api from './api';

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  retryNetwork?: boolean;
  query?: Record<string, unknown> | undefined;
  responseType?: 'json' | 'blob' | 'text';
}

export interface ApiClient {
  get<T>(path: string, options?: Omit<ApiOptions, 'method'>): Promise<T>;
  post<T>(path: string, body: unknown, options?: Omit<ApiOptions, 'method' | 'body'>): Promise<T>;
  patch<T>(path: string, body: unknown, options?: Omit<ApiOptions, 'method' | 'body'>): Promise<T>;
  put<T>(path: string, body: unknown, options?: Omit<ApiOptions, 'method' | 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<ApiOptions, 'method'>): Promise<T>;
  (path: string, options?: ApiOptions): Promise<unknown>;
}

function createApiClient(): ApiClient {
  const baseApi = api as (path: string, options?: ApiOptions) => Promise<unknown>;

  function request<T>(method: Exclude<ApiOptions['method'], undefined>, path: string, body?: unknown, options?: Omit<ApiOptions, 'method'>): Promise<T> {
    return baseApi(path, { ...options, method, body } as ApiOptions) as Promise<T>;
  }

  const client = {
    get: <T>(path: string, options?: Omit<ApiOptions, 'method'>) => request<T>('GET', path, undefined, options),
    post: <T>(path: string, body: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) => request<T>('POST', path, body, options),
    patch: <T>(path: string, body: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) => request<T>('PATCH', path, body, options),
    put: <T>(path: string, body: unknown, options?: Omit<ApiOptions, 'method' | 'body'>) => request<T>('PUT', path, body, options),
    delete: <T>(path: string, options?: Omit<ApiOptions, 'method'>) => request<T>('DELETE', path, undefined, options),
  } as ApiClient;

  return client;
}

export const apiClient = createApiClient();
export default apiClient;