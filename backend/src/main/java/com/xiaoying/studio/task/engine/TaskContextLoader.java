package com.xiaoying.studio.task.engine;
import com.xiaoying.studio.task.*;
import com.xiaoying.studio.simulation.SimulationPlan;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
@Component
public class TaskContextLoader {
    private final TaskMapper tasks;private final TaskMaterialMapper materials;private final JsonMapper json;
    public TaskContextLoader(TaskMapper tasks,TaskMaterialMapper materials,JsonMapper json){this.tasks=tasks;this.materials=materials;this.json=json;}
    @Transactional(readOnly=true)
    public TaskContext load(long id){
        var t=tasks.forWorker(id);
        return new TaskContext(id,t.getUserId(),t.getTemplateId(),materials.forWorker(id,t.getUserId()),json.readValue(t.getSimPlan(),SimulationPlan.class));
    }
    public TaskStage currentStage(long id){var task=tasks.forWorker(id);return task==null?null:task.getStage();}
}
