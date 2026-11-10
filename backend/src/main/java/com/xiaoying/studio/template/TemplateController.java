package com.xiaoying.studio.template;

import com.xiaoying.studio.common.Items;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class TemplateController {
    private final TemplateService service;
    public TemplateController(TemplateService service) { this.service = service; }
    @GetMapping("/categories") public Items<CategoryDto> categories() { return new Items<>(service.categories()); }
    @GetMapping("/templates") public Items<TemplateSummaryDto> list(@RequestParam(required=false) String category) {
        return new Items<>(service.list(category));
    }
    @GetMapping("/templates/{id}") public TemplateDetailDto detail(@PathVariable String id) { return service.require(id); }
}
