"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { configureApiClient } from "@/lib/api/client";
import { getMe, login as loginRequest, logout as logoutRequest, register as registerRequest } from "@/lib/api/endpoints";
import { ApiError, isTransientError } from "@/lib/api/errors";
import type { UserDto } from "@/lib/api/types";
import { abortAllUploads } from "@/lib/api/upload";
import { queryKeys } from "@/lib/query-keys";

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  login: (username: string, password: string) => Promise<UserDto>;
  register: (input: { username: string; password: string; displayName?: string }) => Promise<UserDto>;
  /** 退出登录（"切换账号"也走这里）：删除服务端会话，清空本地缓存，回到登录页。 */
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const CHANNEL_NAME = "xy-auth";

/** next 参数只接受站内路径，防止被拼成跳转到外站的链接。 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return null;
  return next;
}

export function loginPath(next?: string | null): string {
  const target = safeNext(next);
  return target && target !== "/" ? `/login?next=${encodeURIComponent(target)}` : "/login";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [, setVersion] = useState(0);
  const userRef = useRef<UserDto | null>(null);
  const resettingRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      try {
        return await getMe(signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: Infinity,
    retry: (count, error) => isTransientError(error) && count < 1,
  });

  const user = me.data ?? null;
  const status: AuthStatus = me.isPending ? "loading" : user ? "authenticated" : me.isError ? "error" : "anonymous";

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /** spec/05 §5：中止进行中的请求 → 清掉旧用户的全部缓存 → 中止上传。 */
  const resetLocal = useCallback(
    async (nextUser: UserDto | null) => {
      await queryClient.cancelQueries();
      queryClient.clear();
      abortAllUploads();
      queryClient.setQueryData(queryKeys.me, nextUser);
      userRef.current = nextUser;
      // clear() 之后让 me 的观察者重新读取缓存
      setVersion((v) => v + 1);
    },
    [queryClient],
  );

  const broadcast = useCallback((type: "login" | "logout") => {
    channelRef.current?.postMessage({ type });
  }, []);

  /** 其他标签页登录/退出，或 X-User-Id 对不上：重置本地状态，再以服务端为准重新查询当前用户。 */
  const resyncWithServer = useCallback(async () => {
    await resetLocal(null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }, [queryClient, resetLocal]);

  useEffect(
    () =>
      configureApiClient({
        currentUserId: () => userRef.current?.id ?? null,
        onUnauthorized: () => {
          // 只处理"登录过、会话中途失效"；本来就未登录时（例如登录页查询 me）不做任何事
          if (!userRef.current || resettingRef.current) return;
          resettingRef.current = true;
          const next = `${window.location.pathname}${window.location.search}`;
          void resetLocal(null).finally(() => {
            resettingRef.current = false;
            router.replace(loginPath(next));
          });
        },
        onSessionChanged: () => {
          void resyncWithServer();
        },
      }),
    [resetLocal, resyncWithServer, router],
  );

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => {
      void resyncWithServer();
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [resyncWithServer]);

  const login = useCallback(
    async (username: string, password: string) => {
      const next = await loginRequest(username, password);
      await resetLocal(next);
      broadcast("login");
      return next;
    },
    [broadcast, resetLocal],
  );

  const register = useCallback(
    async (input: { username: string; password: string; displayName?: string }) => {
      const next = await registerRequest(input);
      await resetLocal(next);
      broadcast("login");
      return next;
    },
    [broadcast, resetLocal],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // 退出请求失败也要清理本地状态；服务端会话会按有效期自然过期
    }
    await resetLocal(null);
    broadcast("logout");
    router.replace("/login");
  }, [broadcast, resetLocal, router]);

  const retry = useCallback(() => {
    void me.refetch();
  }, [me]);

  const value = useMemo<AuthContextValue>(() => ({ status, user, login, register, logout, retry }), [status, user, login, register, logout, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}

/** 已登录页面里取当前用户 id（用于 ['u', userId, ...] 这类 query key）。 */
export function useUserId(): number {
  const { user } = useAuth();
  if (!user) throw new Error("useUserId 只能在已登录的页面里使用");
  return user.id;
}
