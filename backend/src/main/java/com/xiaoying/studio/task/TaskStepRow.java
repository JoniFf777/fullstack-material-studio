package com.xiaoying.studio.task;

public class TaskStepRow {
    private long id;
    private long taskId;
    private TaskStage stage;
    private StepStatus status;
    private java.time.Instant startedAt;
    private java.time.Instant finishedAt;
    private String message;
    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public long getTaskId() { return taskId; }
    public void setTaskId(long taskId) { this.taskId = taskId; }
    public TaskStage getStage() { return stage; }
    public void setStage(TaskStage stage) { this.stage = stage; }
    public StepStatus getStatus() { return status; }
    public void setStatus(StepStatus status) { this.status = status; }
    public java.time.Instant getStartedAt() { return startedAt; }
    public void setStartedAt(java.time.Instant startedAt) { this.startedAt = startedAt; }
    public java.time.Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(java.time.Instant finishedAt) { this.finishedAt = finishedAt; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
