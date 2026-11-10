package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import com.xiaoying.studio.auth.TokenHasher;
import com.xiaoying.studio.task.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class TaskFlowIT extends AbstractTaskIntegrationTest {
    @Test void acceptanceDoesNotWaitAndReturnsJpeg() throws Exception {
        patch("NONE",800,800,800,false);long material=upload(TestImages.jpeg(96,96));
        long start=System.nanoTime();
        var response=mvc.perform(post("/api/tasks").cookie(user).contentType("application/json").content(body("pet-sticker",List.of(material))))
                .andExpect(status().isAccepted()).andReturn().getResponse();
        assertTrue(Duration.ofNanos(System.nanoTime()-start).toMillis()<1000);
        var accepted=json.readValue(response.getContentAsString(),TaskDto.class);
        assertTrue(Set.of(TaskStatus.PENDING,TaskStatus.PROCESSING).contains(accepted.status()));
        assertEquals("/api/tasks/"+accepted.id(),response.getHeader("Location"));
        var done=finish(accepted.id());assertEquals(TaskStatus.SUCCEEDED,done.status());assertEquals(3,done.steps().size());
        for(int i=0;i<3;i++){
            var step=done.steps().get(i);assertEquals(TaskStage.values()[i],step.stage());assertEquals(StepStatus.SUCCEEDED,step.status());
            assertFalse(step.finishedAt().isBefore(step.startedAt()));
            if(i>0)assertFalse(step.startedAt().isBefore(done.steps().get(i-1).finishedAt()));
        }
        mvc.perform(get(done.resultUrl()).cookie(user)).andExpect(status().isOk()).andExpect(content().contentType("image/jpeg"));
    }
    @ParameterizedTest @EnumSource(TaskStage.class)
    void failureStopsLaterStagesAndQueriesNeverChangeTerminalState(TaskStage failure) throws Exception {
        patch(failure.name(),0,0,0,false);long material=upload(TestImages.jpeg(96,96));
        var task=finish(submit("pet-sticker",List.of(material)).id());
        assertEquals(TaskStatus.FAILED,task.status());assertEquals(failure,task.failedStage());assertEquals(failure.ordinal()+1,task.steps().size());
        assertNull(task.resultUrl());assertEquals("SIMULATED_FAILURE",task.errorCode());
        for(int i=0;i<3;i++){
            var response=mvc.perform(get("/api/tasks/"+task.id()).cookie(user)).andExpect(status().isOk()).andReturn().getResponse();
            assertEquals(task,json.readValue(response.getContentAsString(),TaskDto.class));
        }
    }
    @Test void repeatedQueriesDoNotAdvanceStageOrUpdatedAt() throws Exception {
        patch("NONE",0,3000,0,false);var task=submit("pet-sticker",List.of(upload(TestImages.jpeg(96,96))));
        await().atMost(Duration.ofSeconds(5)).until(()->query.require(task.id(),userId).stage()==TaskStage.GENERATING);
        var before=query.require(task.id(),userId);var count=new AtomicInteger();
        await().pollDelay(Duration.ZERO).pollInterval(Duration.ofMillis(50)).atMost(Duration.ofSeconds(2)).until(()->{
            var response=mvc.perform(get("/api/tasks/"+task.id()).cookie(user)).andExpect(status().isOk()).andReturn().getResponse();
            var current=json.readValue(response.getContentAsString(),TaskDto.class);
            assertEquals(before.stage(),current.stage());assertEquals(before.updatedAt(),current.updatedAt());return count.incrementAndGet()==10;
        });
        assertEquals(TaskStatus.SUCCEEDED,finish(task.id()).status());
    }
    @Test void snapshotsSeparateFailuresFromLaterSubmissions() throws Exception {
        long material=upload(TestImages.jpeg(96,96));patch("GENERATING",100,0,0,false);
        var a=submit("pet-sticker",List.of(material));settings.reset();var b=submit("pet-sticker",List.of(material));
        assertEquals(TaskStatus.FAILED,finish(a.id()).status());assertEquals(TaskStatus.SUCCEEDED,finish(b.id()).status());
    }
    @Test void queryOutageDoesNotStopWorkersOrProtectResultRoute() throws Exception {
        patch("NONE",0,600,0,false);var task=submit("pet-sticker",List.of(upload(TestImages.jpeg(96,96))));
        settings.patch(new com.xiaoying.studio.simulation.SimulationSettings.Patch(null,null,true));
        for(var path:List.of("/api/tasks","/api/tasks/"+task.id()))mvc.perform(get(path).cookie(user)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
        assertEquals(TaskStatus.SUCCEEDED,finish(task.id()).status());
        mvc.perform(get("/api/tasks/"+task.id()+"/result").cookie(user)).andExpect(status().isOk());
        settings.reset();mvc.perform(get("/api/tasks/"+task.id()).cookie(user)).andExpect(jsonPath("$.status").value("SUCCEEDED"));
    }
    @Test void allOwnedResourcesAreHiddenFromAnotherUser() throws Exception {
        long material=upload(TestImages.jpeg(96,96));var task=finish(submit("pet-sticker",List.of(material)).id());
        var other=TestUsers.register(mvc);
        mvc.perform(get("/api/tasks/"+task.id()).cookie(other)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
        mvc.perform(get(task.resultUrl()).cookie(other)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TASK_RESULT_NOT_FOUND"));
        mvc.perform(get("/api/materials/"+material+"/content").cookie(other)).andExpect(status().isNotFound());
        mvc.perform(get("/api/tasks").cookie(other)).andExpect(jsonPath("$.items").isEmpty());
    }
    @Test void threeDifferentMaterialsProduceIndependentResults() throws Exception {
        var tasks=new ArrayList<TaskDto>();var ids=new ArrayList<Long>();
        for(var color:List.of(java.awt.Color.RED,java.awt.Color.GREEN,java.awt.Color.BLUE)){
            long id=upload(TestImages.image(96,96,"jpg",color));ids.add(id);tasks.add(submit("pet-sticker",List.of(id)));
        }
        var hashes=new HashSet<String>();
        for(int i=0;i<3;i++){
            var task=finish(tasks.get(i).id());assertEquals(TaskStatus.SUCCEEDED,task.status());
            assertEquals(ids.get(i),task.materials().getFirst().materialId());
            var bytes=mvc.perform(get(task.resultUrl()).cookie(user)).andReturn().getResponse().getContentAsByteArray();hashes.add(TokenHasher.sha256(bytes));
        }
        assertEquals(3,hashes.size());
    }
    @Test void tinyImageFailsRealMaterialCheck() throws Exception {
        var task=finish(submit("pet-sticker",List.of(upload(TestImages.png(32,32)))).id());
        assertEquals("MATERIAL_RESOLUTION_TOO_LOW",task.errorCode());assertEquals(TaskStage.MATERIAL_CHECK,task.failedStage());assertEquals(1,task.steps().size());
    }
}
