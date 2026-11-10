package com.xiaoying.studio;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import com.xiaoying.studio.task.*;
import com.xiaoying.studio.task.engine.*;
import com.xiaoying.studio.simulation.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class TaskPipelineTest {
    static class MemoryStore implements TaskStateStore {
        final List<String> events=new ArrayList<>();
        final Map<TaskStage,String> steps=new LinkedHashMap<>();
        String status="PROCESSING",code,result;
        TaskStage stage,failed,guardAt;
        @Override public boolean claim(long id) { if(!status.equals("PENDING")) return false;status="PROCESSING";events.add("claim");return true; }
        @Override public boolean enterStage(long id,TaskStage value) {
            if(!status.equals("PROCESSING") || value==guardAt) return false;
            stage=value;steps.put(value,"RUNNING");events.add("enter:"+value);return true;
        }
        @Override public boolean completeStep(long id,TaskStage value,String message) { steps.put(value,"SUCCEEDED");events.add("complete:"+value);return true; }
        @Override public boolean failStepAndTask(long id,TaskStage value,String error,String message) {
            status="FAILED";failed=value;code=error;
            if(value!=null && "RUNNING".equals(steps.get(value)))steps.put(value,"FAILED");
            events.add("fail:"+value);return true;
        }
        @Override public boolean succeed(long id,String key) { status="SUCCEEDED";result=key;events.add("succeed");return true; }
    }
    private TaskContext context(String fail) {
        return new TaskContext(1,1,"pet-sticker",List.of(),new SimulationPlan(fail,Map.of(
                TaskStage.MATERIAL_CHECK,0,TaskStage.GENERATING,0,TaskStage.RESULT_ASSEMBLY,0)));
    }
    private TaskPipeline pipeline(MemoryStore store,List<TaskStage> called,TaskStage throwing,boolean unexpected) {
        List<TaskStep> steps=Arrays.stream(TaskStage.values()).map(stage->new TaskStep() {
            @Override public TaskStage stage() { return stage; }
            @Override public String execute(TaskContext ctx) {
                called.add(stage);
                if(stage==throwing) {
                    if(unexpected) throw new IllegalStateException("test failure");
                    throw new StepFailedException("MATERIAL_RESOLUTION_TOO_LOW","图片分辨率过低");
                }
                if(stage==TaskStage.RESULT_ASSEMBLY)ctx.resultKey("results/1/1.jpg");
                return "完成";
            }
        }).map(s->(TaskStep)s).toList();
        return new TaskPipeline(store,new StepSimulator(ms->{}),steps);
    }
    @Test void successfulStepsAndStateOrder() {
        var store=new MemoryStore();var called=new ArrayList<TaskStage>();
        pipeline(store,called,null,false).execute(context("NONE"));
        assertEquals(List.of(TaskStage.values()),called);assertEquals("SUCCEEDED",store.status);
        assertEquals("results/1/1.jpg",store.result);
        assertEquals(List.of("enter:MATERIAL_CHECK","complete:MATERIAL_CHECK","enter:GENERATING","complete:GENERATING",
                "enter:RESULT_ASSEMBLY","complete:RESULT_ASSEMBLY","succeed"),store.events);
    }
    @ParameterizedTest @EnumSource(TaskStage.class)
    void simulatedFailureStopsAllLaterSteps(TaskStage fail) {
        var store=new MemoryStore();var called=new ArrayList<TaskStage>();
        pipeline(store,called,null,false).execute(context(fail.name()));
        assertEquals(fail.ordinal(),called.size());assertEquals("FAILED",store.status);
        assertEquals(fail,store.failed);assertEquals("SIMULATED_FAILURE",store.code);
        assertEquals(fail.ordinal()+1,store.steps.size());assertEquals("FAILED",store.steps.get(fail));
        store.steps.forEach((stage,status)->assertEquals(stage==fail?"FAILED":"SUCCEEDED",status));
    }
    @Test void businessFailureStopsPipeline() {
        var store=new MemoryStore();var called=new ArrayList<TaskStage>();
        pipeline(store,called,TaskStage.MATERIAL_CHECK,false).execute(context("NONE"));
        assertEquals(List.of(TaskStage.MATERIAL_CHECK),called);assertEquals("MATERIAL_RESOLUTION_TOO_LOW",store.code);
    }
    @Test void unexpectedFailureIsRecordedAndStopsPipeline() {
        var store=new MemoryStore();var called=new ArrayList<TaskStage>();
        pipeline(store,called,TaskStage.GENERATING,true).execute(context("NONE"));
        assertEquals(List.of(TaskStage.MATERIAL_CHECK,TaskStage.GENERATING),called);assertEquals("INTERNAL_ERROR",store.code);
    }
    @Test void failedClaimDoesNoWorkAndWritesNothing() {
        var store=new MemoryStore();store.status="SUCCEEDED";
        var loader=mock(TaskContextLoader.class);var pipeline=mock(TaskPipeline.class);
        new TaskRunner(store,loader,pipeline).run(1);
        assertTrue(store.events.isEmpty());verifyNoInteractions(loader,pipeline);
    }
    @Test void guardRejectionImmediatelyStopsWrites() {
        var store=new MemoryStore();store.guardAt=TaskStage.GENERATING;
        var called=new ArrayList<TaskStage>();pipeline(store,called,null,false).execute(context("NONE"));
        assertEquals(List.of(TaskStage.MATERIAL_CHECK),called);
        assertEquals(List.of("enter:MATERIAL_CHECK","complete:MATERIAL_CHECK"),store.events);
    }
    @Test void completionGuardRejectionStopsLaterStages() {
        var store=new MemoryStore(){ @Override public boolean completeStep(long id,TaskStage stage,String message){return false;} };
        var called=new ArrayList<TaskStage>();pipeline(store,called,null,false).execute(context("NONE"));
        assertEquals(List.of(TaskStage.MATERIAL_CHECK),called);assertEquals(List.of("enter:MATERIAL_CHECK"),store.events);
    }
    @Test void interruptionPreservesProcessingAndThreadFlag() {
        var store=new MemoryStore();var called=new ArrayList<TaskStage>();
        var base=pipeline(store,called,null,false);
        var pipeline=new TaskPipeline(store,new StepSimulator(ms->{throw new InterruptedException();}),base.steps());
        try {
            pipeline.execute(context("NONE"));assertTrue(Thread.currentThread().isInterrupted());
            assertEquals("PROCESSING",store.status);assertEquals("RUNNING",store.steps.get(TaskStage.MATERIAL_CHECK));
            assertTrue(called.isEmpty());
        } finally { Thread.interrupted(); }
    }
    @Test void failedFinalStateCommitLeavesCompletedStepsForRestartRecovery() {
        var store=new MemoryStore(){
            @Override public boolean succeed(long id,String key){throw new IllegalStateException("state store unavailable");}
        };
        store.status="PENDING";
        var called=new ArrayList<TaskStage>();var loader=mock(TaskContextLoader.class);
        when(loader.load(1)).thenReturn(context("NONE"));
        var runner=new TaskRunner(store,loader,pipeline(store,called,null,false));
        try {runner.run(1);} catch(IllegalStateException expected) { }
        assertEquals("PROCESSING",store.status);
        assertTrue(store.steps.values().stream().allMatch("SUCCEEDED"::equals));
        assertNull(store.failed);assertNull(store.code);
    }
    @Test void contextLoadFailureIsRecordedBeforeAnyStage() {
        var store=new MemoryStore();store.status="PENDING";
        var loader=mock(TaskContextLoader.class);var pipeline=mock(TaskPipeline.class);
        when(loader.load(1)).thenThrow(new IllegalStateException("invalid context"));
        new TaskRunner(store,loader,pipeline).run(1);
        assertEquals("FAILED",store.status);assertEquals("INTERNAL_ERROR",store.code);assertNull(store.failed);
        assertTrue(store.steps.isEmpty());verifyNoInteractions(pipeline);
    }
    @Test void lostStepCommitAcknowledgementDoesNotTurnCompletedStepIntoBusinessFailure() {
        var store=new MemoryStore(){
            @Override public boolean completeStep(long id,TaskStage stage,String message){
                super.completeStep(id,stage,message);
                throw new IllegalStateException("connection lost after commit");
            }
        };
        var called=new ArrayList<TaskStage>();
        try {pipeline(store,called,null,false).execute(context("NONE"));} catch(IllegalStateException expected) { }
        assertEquals("PROCESSING",store.status);assertEquals("SUCCEEDED",store.steps.get(TaskStage.MATERIAL_CHECK));
        assertEquals(List.of(TaskStage.MATERIAL_CHECK),called);assertNull(store.code);
    }
}
