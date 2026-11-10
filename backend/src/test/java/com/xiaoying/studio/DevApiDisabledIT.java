package com.xiaoying.studio;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
@TestPropertySource(properties="studio.dev-api-enabled=false")
class DevApiDisabledIT extends AbstractIntegrationTest {
    @Autowired MockMvc mvc;
    @Test void disabledDevelopmentRoutesReturn404() throws Exception {
        mvc.perform(get("/api/dev/simulation")).andExpect(status().isNotFound());
        mvc.perform(patch("/api/dev/simulation").contentType("application/json").content("{}" )).andExpect(status().isNotFound());
        mvc.perform(post("/api/dev/simulation/reset")).andExpect(status().isNotFound());
    }
}
