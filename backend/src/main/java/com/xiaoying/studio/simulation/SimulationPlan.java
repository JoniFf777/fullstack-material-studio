package com.xiaoying.studio.simulation;
import java.util.Map;
import com.xiaoying.studio.task.TaskStage;
public record SimulationPlan(String failStage,Map<TaskStage,Integer> delaysMs) {
    public SimulationPlan {delaysMs=Map.copyOf(delaysMs);}
}
