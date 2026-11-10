package com.xiaoying.studio.common;
import java.util.List;
import com.xiaoying.studio.auth.*;
import com.xiaoying.studio.simulation.QueryOutageInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.*;
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    private final AuthInterceptor auth;
    private final QueryOutageInterceptor outage;
    public WebMvcConfig(AuthInterceptor auth,QueryOutageInterceptor outage) { this.auth=auth;this.outage=outage; }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(auth).addPathPatterns("/api/**").order(0);
        registry.addInterceptor(outage).addPathPatterns("/api/tasks","/api/tasks/**").order(1);
    }
    @Override public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) { resolvers.add(new LoginUserResolver()); }
}
