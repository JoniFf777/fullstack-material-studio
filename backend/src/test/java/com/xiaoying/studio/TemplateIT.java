package com.xiaoying.studio;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

class TemplateIT extends AbstractIntegrationTest {
    @Autowired MockMvc mvc;
    @Test void catalogAndEmptyCategories() throws Exception {
        mvc.perform(get("/api/categories")).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(5))
                .andExpect(jsonPath("$.items[4].code").value("wedding")).andExpect(jsonPath("$.items[4].templateCount").value(0));
        mvc.perform(get("/api/templates")).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(8));
        mvc.perform(get("/api/templates?category=pets")).andExpect(jsonPath("$.items.length()").value(2));
        mvc.perform(get("/api/templates?category=nope")).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/templates?category=wedding")).andExpect(jsonPath("$.items").isEmpty());
    }
    @Test void enabledDetailsOnly() throws Exception {
        mvc.perform(get("/api/templates/travel-postcard")).andExpect(status().isOk())
                .andExpect(jsonPath("$.requiredImageCount").value(2)).andExpect(jsonPath("$.acceptedMimeTypes.length()").value(2));
        for (var id : new String[]{"wedding-invite","nope"}) {
            mvc.perform(get("/api/templates/"+id)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TEMPLATE_NOT_FOUND"));
        }
    }
}
