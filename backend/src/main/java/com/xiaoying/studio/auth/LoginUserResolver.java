package com.xiaoying.studio.auth;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.*;
public class LoginUserResolver implements HandlerMethodArgumentResolver {
    @Override public boolean supportsParameter(MethodParameter p) {
        return p.hasParameterAnnotation(LoginUser.class) && p.getParameterType()==CurrentUser.class;
    }
    @Override public Object resolveArgument(MethodParameter p, ModelAndViewContainer mav,
            NativeWebRequest request, WebDataBinderFactory binder) {
        return request.getAttribute(AuthInterceptor.USER_ATTRIBUTE,0);
    }
}
