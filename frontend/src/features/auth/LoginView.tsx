"use client";

import { Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { safeNext, useAuth } from "./AuthProvider";

// 演示账号是种子数据里的测试凭据（spec/04 §3.3），不是真实账号
const DEMO_ACCOUNTS = [
  { username: "demo", password: "demo123" },
  { username: "alice", password: "alice123" },
];

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const map: Record<string, string> = Object.fromEntries(error.fieldErrors.map((f) => [f.field, f.message]));
  if (error.code === "USERNAME_TAKEN") map.username = error.message;
  return map;
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-bad">
      {message}
    </p>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const local: Record<string, string> = {};
    if (!username.trim()) local.username = "请输入用户名";
    if (!password) local.password = "请输入密码";
    setFieldErrors(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;
    setPending(true);
    try {
      await login(username.trim(), password);
    } catch (error) {
      setFieldErrors(fieldErrorsOf(error));
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField label="用户名" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} error={fieldErrors.username} />
      <TextField label="密码" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} />
      <FormError message={formError} />
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        登录
      </Button>
      <div className="rounded-xl bg-card px-4 py-3 text-sm">
        <p className="text-muted">演示账号（测试数据，点击填入）</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.username}>
              <button
                type="button"
                onClick={() => {
                  setUsername(account.username);
                  setPassword(account.password);
                }}
                className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs hover:border-brand hover:text-brand"
              >
                {account.username} / {account.password}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const local: Record<string, string> = {};
    if (!USERNAME_PATTERN.test(username)) local.username = "用户名为 3–20 位字母、数字或下划线";
    if (password.length < 6 || password.length > 64) local.password = "密码长度为 6–64 位";
    if (displayName.trim().length > 20) local.displayName = "显示名最多 20 个字";
    setFieldErrors(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;
    setPending(true);
    try {
      await register({ username, password, displayName: displayName.trim() || undefined });
    } catch (error) {
      setFieldErrors(fieldErrorsOf(error));
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField
        label="用户名"
        name="username"
        autoComplete="username"
        hint="3–20 位字母、数字或下划线"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={fieldErrors.username}
      />
      <TextField
        label="密码"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="6–64 位"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
      />
      <TextField
        label="显示名（可选）"
        name="displayName"
        autoComplete="nickname"
        hint="不填则使用用户名，最多 20 个字"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        error={fieldErrors.displayName}
      />
      <FormError message={formError} />
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        注册并登录
      </Button>
    </form>
  );
}

export function LoginView() {
  const params = useSearchParams();
  const next = safeNext(params.get("next")) ?? "/";
  const { status } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");

  // 登录成功（或本来就已登录）后回到来源页面
  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-panel text-ink shadow" : "text-muted hover:text-ink"}`;

  return (
    <div className="mx-auto flex min-h-[85vh] max-w-md flex-col justify-center py-10">
      <div className="mb-8 text-center">
        <Sparkles aria-hidden="true" className="mx-auto size-8 text-brand" />
        <h1 className="mt-3 text-2xl font-semibold">素材工坊</h1>
        <p className="mt-2 text-sm text-muted">选择模板、上传图片，后台自动生成作品</p>
      </div>
      <div className="rounded-2xl border border-line bg-panel p-6">
        <div role="group" aria-label="选择登录或注册" className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-card p-1">
          <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")} className={tabClass(mode === "login")}>
            登录
          </button>
          <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")} className={tabClass(mode === "register")}>
            注册
          </button>
        </div>
        {mode === "login" ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
}
