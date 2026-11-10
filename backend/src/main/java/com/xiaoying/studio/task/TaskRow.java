package com.xiaoying.studio.task;

public class TaskRow {
    private long id;
    private long userId;
    private String templateId;
    private String templateTitle;
    private String coverUrl;
    private TaskStatus status;
    private TaskStage stage;
    private TaskStage failedStage;
    private String errorCode;
    private String errorMessage;
    private String resultKey;
    private String simPlan;
    private String clientRequestId;
    private java.time.Instant createdAt;
    private java.time.Instant startedAt;
    private java.time.Instant finishedAt;
    private java.time.Instant updatedAt;
    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public long getUserId() { return userId; }
    public void setUserId(long userId) { this.userId = userId; }
    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }
    public String getTemplateTitle() { return templateTitle; }
    public void setTemplateTitle(String templateTitle) { this.templateTitle = templateTitle; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public TaskStage getStage() { return stage; }
    public void setStage(TaskStage stage) { this.stage = stage; }
    public TaskStage getFailedStage() { return failedStage; }
    public void setFailedStage(TaskStage failedStage) { this.failedStage = failedStage; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getResultKey() { return resultKey; }
    public void setResultKey(String resultKey) { this.resultKey = resultKey; }
    public String getSimPlan() { return simPlan; }
    public void setSimPlan(String simPlan) { this.simPlan = simPlan; }
    public String getClientRequestId() { return clientRequestId; }
    public void setClientRequestId(String clientRequestId) { this.clientRequestId = clientRequestId; }
    public java.time.Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(java.time.Instant createdAt) { this.createdAt = createdAt; }
    public java.time.Instant getStartedAt() { return startedAt; }
    public void setStartedAt(java.time.Instant startedAt) { this.startedAt = startedAt; }
    public java.time.Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(java.time.Instant finishedAt) { this.finishedAt = finishedAt; }
    public java.time.Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.Instant updatedAt) { this.updatedAt = updatedAt; }
}
