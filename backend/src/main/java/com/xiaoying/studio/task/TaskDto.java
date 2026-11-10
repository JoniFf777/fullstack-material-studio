package com.xiaoying.studio.task;
import java.time.Instant;
import java.util.List;
public record TaskDto(long id,String templateId,String templateTitle,String coverUrl,TaskStatus status,
        TaskStage stage,TaskStage failedStage,String errorCode,String errorMessage,String resultUrl,
        List<MaterialDto> materials,List<StepDto> steps,Instant createdAt,Instant startedAt,Instant finishedAt,Instant updatedAt) {
    public record MaterialDto(int slotIndex,long materialId,String url) {}
    public record StepDto(TaskStage stage,StepStatus status,Instant startedAt,Instant finishedAt,String message) {}
}
