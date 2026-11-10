package com.xiaoying.studio.task.engine;
import java.time.Clock;
import com.xiaoying.studio.common.Times;
import com.xiaoying.studio.task.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
@Service @Transactional(propagation=Propagation.REQUIRES_NEW)
public class MyBatisTaskStateStore implements TaskStateStore {
    private final TaskMapper tasks;private final TaskStepMapper steps;private final Clock clock;
    public MyBatisTaskStateStore(TaskMapper tasks,TaskStepMapper steps,Clock clock){this.tasks=tasks;this.steps=steps;this.clock=clock;}
    @Override public boolean claim(long id){return tasks.claim(id,Times.now(clock))==1;}
    @Override public boolean enterStage(long id,TaskStage stage){
        var now=Times.now(clock);if(tasks.enterStage(id,stage,now)!=1)return false;
        steps.insertRunning(id,stage,now);return true;
    }
    @Override public boolean completeStep(long id,TaskStage stage,String message){return steps.complete(id,stage,message,Times.now(clock))==1;}
    @Override public boolean failStepAndTask(long id,TaskStage stage,String code,String message){
        var now=Times.now(clock);if(tasks.fail(id,stage,code,message,now)!=1)return false;
        if(stage!=null)steps.fail(id,stage,message,now);return true;
    }
    @Override public boolean succeed(long id,String resultKey){return tasks.succeed(id,resultKey,Times.now(clock))==1;}
    public void interruptProcessing(){var now=Times.now(clock);tasks.interruptProcessing(now);steps.interruptRunning(now);}
}
