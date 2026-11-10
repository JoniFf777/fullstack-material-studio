package com.xiaoying.studio.simulation;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import com.xiaoying.studio.common.ApiException;
import com.xiaoying.studio.task.TaskStage;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;
@Component @EnableConfigurationProperties(SimulationProperties.class)
public class SimulationSettings {
    public record Patch(String failStage,Map<String,Integer> delaysMs,Boolean queryOutage) {}
    private final SimulationSettingsDto defaults;
    private final AtomicReference<SimulationSettingsDto> current;
    public SimulationSettings(SimulationProperties properties) {
        defaults=properties.defaults();current=new AtomicReference<>(defaults);
        validate(new Patch(defaults.failStage(),Map.of("MATERIAL_CHECK",properties.materialCheckMs(),
                "GENERATING",properties.generatingMs(),"RESULT_ASSEMBLY",properties.resultAssemblyMs()),false));
    }
    public SimulationSettingsDto get() {return current.get();}
    public SimulationPlan snapshot() {return get().plan();}
    public SimulationSettingsDto reset() {current.set(defaults);return defaults;}
    public SimulationSettingsDto patch(Patch patch) {
        validate(patch);
        return current.updateAndGet(previous->{
            var delays=new EnumMap<TaskStage,Integer>(TaskStage.class);delays.putAll(previous.delaysMs());
            if(patch.delaysMs()!=null)patch.delaysMs().forEach((k,v)->delays.put(TaskStage.valueOf(k),v));
            return new SimulationSettingsDto(patch.failStage()==null?previous.failStage():patch.failStage(),delays,
                    patch.queryOutage()==null?previous.queryOutage():patch.queryOutage());
        });
    }
    private void validate(Patch patch) {
        if(patch.failStage()!=null && !patch.failStage().equals("NONE")) {
            try {TaskStage.valueOf(patch.failStage());}
            catch(IllegalArgumentException e){throw ApiException.validation("failStage","失败阶段不合法");}
        }
        if(patch.delaysMs()!=null)patch.delaysMs().forEach((k,v)->{
            try {TaskStage.valueOf(k);}catch(IllegalArgumentException e){throw ApiException.validation("delaysMs","阶段不合法");}
            if(v==null || v<0 || v>60000)throw ApiException.validation("delaysMs."+k,"耗时必须为 0–60000 毫秒");
        });
    }
}
