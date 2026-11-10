import { QueryClient } from "@tanstack/react-query";
import { isTransientError } from "./api/errors";

/** 模板和分类很少变化，5 分钟内不重复请求。任务数据 staleTime 为 0。 */
export const CATALOG_STALE_TIME = 5 * 60 * 1000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        // 4xx 不重试；网络错误和 5xx 重试 1 次
        retry: (failureCount, error) => isTransientError(error) && failureCount < 1,
        retryDelay: 800,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}
