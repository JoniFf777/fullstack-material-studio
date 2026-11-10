package com.xiaoying.studio.task.engine;
import com.xiaoying.studio.task.TaskStage;
public interface TaskStateStore {
    boolean claim(long id);
    boolean enterStage(long id,TaskStage stage);
    boolean completeStep(long id,TaskStage stage,String message);
    boolean failStepAndTask(long id,TaskStage stage,String code,String message);
    boolean succeed(long id,String resultKey);
}
