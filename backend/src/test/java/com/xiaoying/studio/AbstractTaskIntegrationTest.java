package com.xiaoying.studio;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Duration;
import java.util.List;
import com.xiaoying.studio.auth.AuthService;
import com.xiaoying.studio.simulation.*;
import com.xiaoying.studio.task.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

public abstract class AbstractTaskIntegrationTest extends AbstractIntegrationTest {
    @Autowired protected MockMvc mvc;
    @Autowired protected JsonMapper json;
    @Autowired protected SimulationSettings settings;
    @Autowired protected TaskQueryService query;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired AuthService auth;
    protected Cookie user;protected long userId;
    @BeforeEach void newUser() throws Exception {settings.reset();user=TestUsers.register(mvc);userId=auth.authenticate(user.getValue()).getId();}
    @AfterEach void resetSimulation(){settings.reset();}
    protected long upload(byte[] bytes) throws Exception {
        var response=mvc.perform(multipart("/api/materials").file(new MockMultipartFile("file","test.jpg","image/jpeg",bytes)).cookie(user))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return json.readTree(response.getContentAsString()).path("id").asLong();
    }
    protected String body(String template,List<Long> ids){return json.writeValueAsString(new TaskController.SubmitRequest(template,ids));}
    protected TaskDto submit(String template,List<Long> ids) throws Exception {
        var response=mvc.perform(post("/api/tasks").cookie(user).contentType("application/json").content(body(template,ids)))
                .andExpect(status().isAccepted()).andReturn().getResponse();
        return json.readValue(response.getContentAsString(),TaskDto.class);
    }
    protected TaskDto finish(long id){
        await().atMost(Duration.ofSeconds(10)).pollInterval(Duration.ofMillis(100)).until(()->{
            var status=query.require(id,userId).status();return status==TaskStatus.SUCCEEDED || status==TaskStatus.FAILED;
        });
        return query.require(id,userId);
    }
    protected void patch(String fail,int check,int generation,int assembly,boolean outage){
        settings.patch(new SimulationSettings.Patch(fail,java.util.Map.of("MATERIAL_CHECK",check,"GENERATING",generation,"RESULT_ASSEMBLY",assembly),outage));
    }
}
