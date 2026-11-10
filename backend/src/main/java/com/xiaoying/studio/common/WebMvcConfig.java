package com.xiaoying.studio.common;
import java.util.List;
import com.xiaoying.studio.auth.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.*;
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    private final AuthInterceptor auth;
    public WebMvcConfig(AuthInterceptor auth) { this.auth=auth; }
    @Override public void addInterceptors(InterceptorRegistry registry) { registry.addInterceptor(auth).addPathPatterns("/api/**").order(0); }
    @Override public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) { resolvers.add(new LoginUserResolver()); }
}
