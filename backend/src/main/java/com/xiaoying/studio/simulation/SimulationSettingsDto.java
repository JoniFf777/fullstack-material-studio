package com.xiaoying.studio.simulation;
import java.util.Map;
import com.xiaoying.studio.task.TaskStage;
public record SimulationSettingsDto(String failStage,Map<TaskStage,Integer> delaysMs,boolean queryOutage) {
    public SimulationSettingsDto {delaysMs=Map.copyOf(delaysMs);}
    public SimulationPlan plan() {return new SimulationPlan(failStage,delaysMs);}
}
