package com.xiaoying.studio.simulation;
import com.xiaoying.studio.common.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
@Component
public class QueryOutageInterceptor implements HandlerInterceptor {
    private final SimulationSettings settings;
    public QueryOutageInterceptor(SimulationSettings settings){this.settings=settings;}
    @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler){
        String path=request.getRequestURI().substring(request.getContextPath().length());
        if(request.getMethod().equals("GET") && (path.equals("/api/tasks") || path.matches("/api/tasks/[0-9]+"))
                && settings.get().queryOutage())throw new ApiException(503,ErrorCode.SERVICE_UNAVAILABLE,"状态查询暂时不可用，任务仍在后台处理");
        return true;
    }
}
