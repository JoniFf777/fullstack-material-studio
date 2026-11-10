import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import type { UserDto } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { fixture } from "./fixtures";

/** spec/06 §5.1：每个测试一个新的 QueryClient，不重试，缓存不过期。 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export const demoUser = (): UserDto => fixture<{ user: UserDto }>("user").user;

/** 以已登录的 demo 用户渲染：预先写入 ['me']，AuthProvider 不会再发请求。 */
export function renderWithProviders(ui: ReactElement, options: { user?: UserDto; queryClient?: QueryClient } = {}) {
  const user = options.user ?? demoUser();
  const queryClient = options.queryClient ?? createTestQueryClient();
  queryClient.setQueryData(queryKeys.me, user);
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient, user };
}
