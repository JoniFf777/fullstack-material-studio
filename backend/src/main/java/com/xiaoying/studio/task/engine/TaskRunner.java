package com.xiaoying.studio.task.engine;
import org.slf4j.*;
import org.springframework.stereotype.Component;
@Component
public class TaskRunner {
    private static final Logger log=LoggerFactory.getLogger(TaskRunner.class);
    private final TaskStateStore store;private final TaskContextLoader loader;private final TaskPipeline pipeline;
    public TaskRunner(TaskStateStore store,TaskContextLoader loader,TaskPipeline pipeline){this.store=store;this.loader=loader;this.pipeline=pipeline;}
    public void run(long id){
        try(var ignored=MDC.putCloseable("taskId",Long.toString(id))){
            if(!store.claim(id))return;
            TaskContext context;
            try {context=loader.load(id);}
            catch(RuntimeException e){
                log.error("Task context could not be loaded",e);
                store.failStepAndTask(id,null,"INTERNAL_ERROR","系统内部错误，请稍后重试");
                return;
            }
            try {pipeline.execute(context);}
            catch(RuntimeException e){
                // Step execution errors are handled inside the pipeline. An error here
                // belongs to a state boundary; completed steps must stay immutable.
                log.error("State persistence failed; leaving task for startup recovery",e);
                throw e;
            }
        }
    }
}
