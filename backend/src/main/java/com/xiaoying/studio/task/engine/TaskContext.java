package com.xiaoying.studio.task.engine;
import java.util.List;
import com.xiaoying.studio.material.MaterialRow;
import com.xiaoying.studio.simulation.SimulationPlan;
public class TaskContext {
    private final long taskId,userId;private final String templateId;
    private final List<MaterialRow> materials;private final SimulationPlan plan;
    private String resultKey;
    public TaskContext(long taskId,long userId,String templateId,List<MaterialRow> materials,SimulationPlan plan){
        this.taskId=taskId;this.userId=userId;this.templateId=templateId;this.materials=List.copyOf(materials);this.plan=plan;
    }
    public long taskId(){return taskId;} public long userId(){return userId;} public String templateId(){return templateId;}
    public List<MaterialRow> materials(){return materials;} public SimulationPlan plan(){return plan;}
    public String resultKey(){return resultKey;} public void resultKey(String value){resultKey=value;}
    public String workKey(){return "work/"+taskId+"/generated.png";}
}
