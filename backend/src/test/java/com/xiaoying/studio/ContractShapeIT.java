package com.xiaoying.studio;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import com.xiaoying.studio.task.*;
import com.xiaoying.studio.task.engine.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;

class ContractShapeIT extends AbstractTaskIntegrationTest {
    @MockitoBean TaskDispatcher dispatcher;
    @Autowired TaskRunner runner;
    private final Path fixtures=Path.of("../verify/fixtures");
    private void shape(String fixture,Object actual) throws Exception {
        var expected=json.readTree(Files.readString(fixtures.resolve(fixture+".json")));
        compare(expected,actual instanceof JsonNode node?node:json.valueToTree(actual),"$");
    }
    private void compare(JsonNode expected,JsonNode actual,String at){
        if(expected.isNull() || actual.isNull())return;
        if(expected.isObject()){
            assertTrue(actual.isObject(),at);assertEquals(new TreeSet<>(expected.propertyNames()),new TreeSet<>(actual.propertyNames()),at);
            for(String name:expected.propertyNames())compare(expected.get(name),actual.get(name),at+"."+name);
        } else if(expected.isArray()){
            assertTrue(actual.isArray(),at);if(!expected.isEmpty() && !actual.isEmpty())compare(expected.get(0),actual.get(0),at+"[0]");
        } else if(expected.isNumber())assertTrue(actual.isNumber(),at);
        else assertEquals(expected.getNodeType(),actual.getNodeType(),at);
    }
    private JsonNode getJson(String path) throws Exception {
        return json.readTree(mvc.perform(get(path).cookie(user)).andReturn().getResponse().getContentAsString());
    }
    @Test void allRealResponsesHaveExactlyFixtureFields() throws Exception {
        assumeTrue(Files.isDirectory(fixtures));
        shape("user",getJson("/api/auth/me"));shape("categories",getJson("/api/categories"));
        shape("templates",getJson("/api/templates"));shape("template-detail",getJson("/api/templates/travel-postcard"));
        shape("simulation",getJson("/api/dev/simulation"));
        shape("error-not-found",getJson("/api/tasks/9223372036854775807"));
        var error=mvc.perform(post("/api/auth/register").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();shape("error-validation",json.readTree(error));
        var upload=mvc.perform(multipart("/api/materials").cookie(user).file(new org.springframework.mock.web.MockMultipartFile("file","test.png","image/png",TestImages.png(96,96))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var material=json.readTree(upload);shape("material",material);long id=material.path("id").asLong();
        patch("NONE",100,1000,0,false);var pending=submit("pet-sticker",List.of(id));assertEquals(TaskStatus.PENDING,pending.status());shape("task-pending",pending);
        try(var executor=Executors.newSingleThreadExecutor()){
            var work=executor.submit(()->runner.run(pending.id()));
            await().atMost(Duration.ofSeconds(5)).until(()->query.require(pending.id(),userId).stage()==TaskStage.GENERATING);
            shape("task-processing",query.require(pending.id(),userId));work.get(10,TimeUnit.SECONDS);
        }
        shape("task-succeeded",finish(pending.id()));
        patch("GENERATING",0,0,0,false);var failing=submit("pet-sticker",List.of(id));runner.run(failing.id());
        var failed=finish(failing.id());assertEquals(TaskStage.GENERATING,failed.failedStage());shape("task-failed",failed);
        shape("task-list",getJson("/api/tasks"));
    }
}
