package com.xiaoying.studio.template;
import java.util.List;
public record TemplateDetailDto(String id, String title, String categoryCode, String categoryName,
                                String coverUrl, int requiredImageCount, String description,
                                List<String> acceptedMimeTypes, long maxFileSizeBytes) {}
