package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import com.xiaoying.studio.task.TaskStage;
import com.xiaoying.studio.task.engine.*;
import com.xiaoying.studio.simulation.*;
import org.junit.jupiter.api.Test;
class StepSimulatorTest {
    @Test void usesSnapshotDelayAndFailsOnlyMatchingStage() throws Exception {
        var delays=Map.of(TaskStage.MATERIAL_CHECK,12,TaskStage.GENERATING,34,TaskStage.RESULT_ASSEMBLY,56);
        var slept=new ArrayList<Long>();var simulator=new StepSimulator(slept::add);
        var plan=new SimulationPlan("GENERATING",delays);
        simulator.beforeStep(plan,TaskStage.MATERIAL_CHECK);
        var failure=assertThrows(StepFailedException.class,()->simulator.beforeStep(plan,TaskStage.GENERATING));
        assertEquals("SIMULATED_FAILURE",failure.code());assertEquals(List.of(12L,34L),slept);
    }
}
