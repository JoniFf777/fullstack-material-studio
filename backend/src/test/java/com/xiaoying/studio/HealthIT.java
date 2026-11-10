package com.xiaoying.studio;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

class HealthIT extends AbstractIntegrationTest {
    @Autowired MockMvc mvc;
    @Test void healthHasExactlyTheContractFields() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"UP\"}", org.springframework.test.json.JsonCompareMode.STRICT));
    }
}
