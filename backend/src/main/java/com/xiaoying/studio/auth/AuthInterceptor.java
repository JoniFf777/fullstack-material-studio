package com.xiaoying.studio.auth;
import com.xiaoying.studio.common.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {
    public static final String USER_ATTRIBUTE="studio.currentUser";
    private final AuthService auth;
    public AuthInterceptor(AuthService auth) { this.auth=auth; }
    public static String token(HttpServletRequest request) {
        if(request.getCookies()!=null) for(var c:request.getCookies()) if(c.getName().equals("XY_SESSION")) return c.getValue();
        return null;
    }
    @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        var user=auth.authenticate(token(request));
        if(user!=null) {
            request.setAttribute(USER_ATTRIBUTE,new CurrentUser(user.getId(),user.getUsername(),user.getDisplayName()));
            response.setHeader("X-User-Id",Long.toString(user.getId()));
        }
        String path=request.getRequestURI().substring(request.getContextPath().length());
        boolean open=path.equals("/api/auth/login") || path.equals("/api/auth/register") || path.equals("/api/auth/logout")
                || path.equals("/api/categories") || path.equals("/api/templates") || path.startsWith("/api/templates/")
                || path.startsWith("/api/dev/");
        if(!open && user==null) throw new ApiException(401,ErrorCode.UNAUTHENTICATED,"请先登录");
        return true;
    }
}
