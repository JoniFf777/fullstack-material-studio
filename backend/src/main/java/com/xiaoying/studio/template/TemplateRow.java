package com.xiaoying.studio.template;

public class TemplateRow {
    private String id;
    private String title;
    private String categoryCode;
    private String categoryName;
    private String coverUrl;
    private int requiredImageCount;
    private String description;
    private String acceptedMimeTypes;
    private long maxFileSizeBytes;
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCategoryCode() { return categoryCode; }
    public void setCategoryCode(String categoryCode) { this.categoryCode = categoryCode; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }
    public int getRequiredImageCount() { return requiredImageCount; }
    public void setRequiredImageCount(int requiredImageCount) { this.requiredImageCount = requiredImageCount; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getAcceptedMimeTypes() { return acceptedMimeTypes; }
    public void setAcceptedMimeTypes(String acceptedMimeTypes) { this.acceptedMimeTypes = acceptedMimeTypes; }
    public long getMaxFileSizeBytes() { return maxFileSizeBytes; }
    public void setMaxFileSizeBytes(long maxFileSizeBytes) { this.maxFileSizeBytes = maxFileSizeBytes; }
}
