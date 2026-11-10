import { NextResponse, type NextRequest } from "next/server";

// 没有 XY_SESSION Cookie 时，把页面请求重定向到登录页。Cookie 是否有效以后端为准：
// 前端任何请求收到 401 都会走"会话失效"流程（spec/05 §5）。
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = request.nextUrl.clone();
  target.pathname = "/login";
  target.search = pathname === "/" && !search ? "" : `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(target);
}

export const config = {
  matcher: [
    {
      // 只匹配页面路径：排除 /api、/demo（不能让上传请求经过 proxy，否则大于 10MB 的请求体会被截断）、
      // /_next、/login、/dev 和带扩展名的静态文件
      source: "/((?!api|demo|_next|login|dev|.*\\..*).*)",
      missing: [{ type: "cookie", key: "XY_SESSION" }],
    },
  ],
};
