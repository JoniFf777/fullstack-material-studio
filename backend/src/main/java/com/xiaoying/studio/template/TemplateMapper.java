package com.xiaoying.studio.template;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TemplateMapper {
    List<CategoryDto> categories();
    List<TemplateRow> list(@Param("category") String category);
    TemplateRow findEnabled(@Param("id") String id);
}
