package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import com.xiaoying.studio.task.*;
import com.xiaoying.studio.task.engine.TaskRecovery;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
class TaskRecoveryIT extends AbstractTaskIntegrationTest {
    @Autowired TaskRecovery recovery;
    @Test void interruptedStepsFailAndPendingWorkIsRedispatched() throws Exception {
        long material=upload(TestImages.jpeg(96,96));var now=Timestamp.from(Instant.parse("2026-11-10T08:00:00.123Z"));
        String plan=json.writeValueAsString(settings.snapshot());
        jdbc.update("INSERT INTO generation_task(user_id,template_id,status,stage,sim_plan,created_at,started_at,updated_at) VALUES(?,'pet-sticker','PROCESSING','GENERATING',?,?,?,?)",userId,plan,now,now,now);
        long interrupted=jdbc.queryForObject("SELECT MAX(id) FROM generation_task WHERE user_id=?",Long.class,userId);
        jdbc.update("INSERT INTO generation_task_step(task_id,stage,status,started_at) VALUES(?,'MATERIAL_CHECK','SUCCEEDED',?),(?,'GENERATING','RUNNING',?)",interrupted,now,interrupted,now);
        jdbc.update("INSERT INTO generation_task(user_id,template_id,status,sim_plan,created_at,updated_at) VALUES(?,'pet-sticker','PENDING',?,?,?)",userId,plan,now,now);
        long pending=jdbc.queryForObject("SELECT MAX(id) FROM generation_task WHERE user_id=?",Long.class,userId);
        jdbc.update("INSERT INTO generation_task_material(task_id,slot_index,material_id) VALUES(?,0,?)",pending,material);
        recovery.recover();var failed=query.require(interrupted,userId);
        assertEquals(TaskStatus.FAILED,failed.status());assertEquals("INTERRUPTED",failed.errorCode());assertEquals(TaskStage.GENERATING,failed.failedStage());
        assertEquals(StepStatus.FAILED,failed.steps().getLast().status());assertNotNull(failed.steps().getLast().finishedAt());
        assertEquals(TaskStatus.SUCCEEDED,finish(pending).status());
    }
    @Test void interruptionBeforeFirstStageAllowsNullStage() {
        var now=Timestamp.from(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
        jdbc.update("INSERT INTO generation_task(user_id,template_id,status,sim_plan,created_at,started_at,updated_at) VALUES(?,'pet-sticker','PROCESSING',?,?,?,?)",
                userId,json.writeValueAsString(settings.snapshot()),now,now,now);
        long id=jdbc.queryForObject("SELECT MAX(id) FROM generation_task WHERE user_id=?",Long.class,userId);recovery.recover();
        var task=query.require(id,userId);assertEquals(TaskStatus.FAILED,task.status());assertNull(task.stage());assertNull(task.failedStage());
    }
    @Test void restartBetweenStepsPreservesAlreadyCompletedStep() {
        var now=Timestamp.from(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS));
        jdbc.update("INSERT INTO generation_task(user_id,template_id,status,stage,sim_plan,created_at,started_at,updated_at) VALUES(?,'pet-sticker','PROCESSING','MATERIAL_CHECK',?,?,?,?)",
                userId,json.writeValueAsString(settings.snapshot()),now,now,now);
        long id=jdbc.queryForObject("SELECT MAX(id) FROM generation_task WHERE user_id=?",Long.class,userId);
        jdbc.update("INSERT INTO generation_task_step(task_id,stage,status,started_at,finished_at,message) VALUES(?,'MATERIAL_CHECK','SUCCEEDED',?,?,'已检查 1 张图片')",id,now,now);
        recovery.recover();var task=query.require(id,userId);
        assertEquals(TaskStatus.FAILED,task.status());assertEquals("INTERRUPTED",task.errorCode());
        assertEquals(TaskStage.MATERIAL_CHECK,task.failedStage());assertEquals(StepStatus.SUCCEEDED,task.steps().getFirst().status());
    }
}
