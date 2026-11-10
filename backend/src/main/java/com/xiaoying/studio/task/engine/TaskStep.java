package com.xiaoying.studio.task.engine;
import com.xiaoying.studio.task.TaskStage;
public interface TaskStep { TaskStage stage(); String execute(TaskContext context); }
