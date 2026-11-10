package com.xiaoying.studio.task.engine;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Component;
@Component
public class TaskPipeline {
    private static final Logger log=LoggerFactory.getLogger(TaskPipeline.class);
    private final TaskStateStore store;private final StepSimulator simulator;private final List<TaskStep> steps;
    public TaskPipeline(TaskStateStore store,StepSimulator simulator,List<TaskStep> steps){
        this.store=store;this.simulator=simulator;this.steps=steps.stream().sorted(Comparator.comparing(TaskStep::stage)).toList();
    }
    public List<TaskStep> steps(){return steps;}
    public void execute(TaskContext ctx){
        for(var step:steps){
            var stage=step.stage();
            if(!store.enterStage(ctx.taskId(),stage)){log.warn("State guard rejected stage {}",stage);return;}
            long started=System.nanoTime();log.info("STEP_START stage={}",stage);
            String summary;
            try {
                simulator.beforeStep(ctx.plan(),stage);
                summary=step.execute(ctx);
            } catch(StepFailedException e){
                store.failStepAndTask(ctx.taskId(),stage,e.code(),e.getMessage());
                log.warn("STEP_FAILED stage={} code={} message={}",stage,e.code(),e.getMessage());return;
            } catch(InterruptedException e){Thread.currentThread().interrupt();return;
            } catch(RuntimeException e){
                log.error("STEP_FAILED stage={} code=INTERNAL_ERROR",stage,e);
                store.failStepAndTask(ctx.taskId(),stage,"INTERNAL_ERROR","系统内部错误，请稍后重试");return;
            }
            if(!store.completeStep(ctx.taskId(),stage,summary)){log.warn("State guard rejected completion {}",stage);return;}
            log.info("STEP_END stage={} durationMs={}",stage,(System.nanoTime()-started)/1_000_000);
        }
        if(!store.succeed(ctx.taskId(),ctx.resultKey()))log.warn("State guard rejected success");
    }
}
