import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "@/features/auth/LoginView";

export const metadata: Metadata = { title: "登录" };

export default function LoginPage() {
  // LoginView 用到 useSearchParams，必须包在 Suspense 里
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}
