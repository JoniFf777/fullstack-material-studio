package com.xiaoying.studio.task.engine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
@Configuration
public class TaskExecutorConfig {
    @Bean("taskExecutor")
    public ThreadPoolTaskExecutor executor(@Value("${studio.task-workers}") int workers){
        if(workers<1)throw new IllegalArgumentException("TASK_WORKERS must be positive");
        var executor=new ThreadPoolTaskExecutor(){
            @Override public void shutdown(){
                super.shutdown();
                if(!getThreadPoolExecutor().isTerminated())getThreadPoolExecutor().shutdownNow();
            }
        };
        executor.setCorePoolSize(workers);executor.setMaxPoolSize(workers);executor.setQueueCapacity(Integer.MAX_VALUE);
        executor.setThreadNamePrefix("task-worker-");executor.setWaitForTasksToCompleteOnShutdown(true);executor.setAwaitTerminationSeconds(15);
        return executor;
    }
}
