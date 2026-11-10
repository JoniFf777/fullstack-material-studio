package com.xiaoying.studio.template;

import java.util.List;
import com.xiaoying.studio.common.*;
import org.springframework.stereotype.Service;

@Service
public class TemplateService {
    private final TemplateMapper mapper;
    public TemplateService(TemplateMapper mapper) { this.mapper = mapper; }
    public List<CategoryDto> categories() { return mapper.categories(); }
    public List<TemplateSummaryDto> list(String category) {
        return mapper.list(category).stream().map(t -> new TemplateSummaryDto(t.getId(), t.getTitle(),
                t.getCategoryCode(), t.getCategoryName(), t.getCoverUrl(), t.getRequiredImageCount())).toList();
    }
    public TemplateDetailDto require(String id) {
        var t = mapper.findEnabled(id);
        if (t == null) throw new ApiException(404, ErrorCode.TEMPLATE_NOT_FOUND, "模板不存在或已下线");
        return new TemplateDetailDto(t.getId(), t.getTitle(), t.getCategoryCode(), t.getCategoryName(),
                t.getCoverUrl(), t.getRequiredImageCount(), t.getDescription(),
                List.of(t.getAcceptedMimeTypes().split(",")), t.getMaxFileSizeBytes());
    }
}
