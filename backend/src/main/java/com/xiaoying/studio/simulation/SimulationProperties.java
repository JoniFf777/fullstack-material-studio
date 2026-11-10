package com.xiaoying.studio.simulation;
import java.util.Map;
import com.xiaoying.studio.task.TaskStage;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties("studio.simulation")
public record SimulationProperties(String failStage,int materialCheckMs,int generatingMs,int resultAssemblyMs) {
    public SimulationSettingsDto defaults() {
        return new SimulationSettingsDto(failStage,Map.of(TaskStage.MATERIAL_CHECK,materialCheckMs,
                TaskStage.GENERATING,generatingMs,TaskStage.RESULT_ASSEMBLY,resultAssemblyMs),false);
    }
}
