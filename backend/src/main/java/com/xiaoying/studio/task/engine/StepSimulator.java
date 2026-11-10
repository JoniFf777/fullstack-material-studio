package com.xiaoying.studio.task.engine;
import com.xiaoying.studio.task.TaskStage;
import com.xiaoying.studio.simulation.SimulationPlan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
@Component
public class StepSimulator {
    @FunctionalInterface public interface Sleeper {void sleep(long ms) throws InterruptedException;}
    private final Sleeper sleeper;
    @Autowired public StepSimulator(){this(Thread::sleep);}
    public StepSimulator(Sleeper sleeper){this.sleeper=sleeper;}
    public void beforeStep(SimulationPlan plan,TaskStage stage) throws InterruptedException {
        sleeper.sleep(plan.delaysMs().get(stage));
        if(plan.failStage().equals(stage.name()))throw new StepFailedException("SIMULATED_FAILURE",switch(stage){
            case MATERIAL_CHECK->"素材检查失败：模拟注入的故障";
            case GENERATING->"模拟生成失败：生成服务返回错误（模拟注入）";
            case RESULT_ASSEMBLY->"结果整理失败：结果文件写入失败（模拟注入）";
        });
    }
}
