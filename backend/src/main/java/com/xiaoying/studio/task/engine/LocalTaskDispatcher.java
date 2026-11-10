package com.xiaoying.studio.task.engine;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
@Component
public class LocalTaskDispatcher implements TaskDispatcher {
    private static final Logger log=LoggerFactory.getLogger(LocalTaskDispatcher.class);
    private final ThreadPoolTaskExecutor executor;private final TaskRunner runner;
    public LocalTaskDispatcher(@Qualifier("taskExecutor") ThreadPoolTaskExecutor executor,TaskRunner runner){this.executor=executor;this.runner=runner;}
    @Override public void dispatch(long id){
        try {executor.execute(()->runner.run(id));}
        catch(TaskRejectedException e){log.warn("Task {} left PENDING for startup recovery because executor is shutting down",id);}
    }
}
