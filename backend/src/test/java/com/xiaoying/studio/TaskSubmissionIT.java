package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.*;
import java.util.concurrent.*;
import com.xiaoying.studio.task.*;
import org.junit.jupiter.api.Test;

class TaskSubmissionIT extends AbstractTaskIntegrationTest {
    @Test void invalidSubmissionsNeverCreateTasksAndFollowValidationOrder() throws Exception {
        long jpeg=upload(TestImages.jpeg(96,96)),png=upload(TestImages.png(96,96));
        var other=TestUsers.register(mvc);
        var response=mvc.perform(multipart("/api/materials").cookie(other).file(new org.springframework.mock.web.MockMultipartFile("file","x.jpg","image/jpeg",TestImages.jpeg(96,96))))
                .andExpect(status().isCreated()).andReturn().getResponse();
        long foreign=json.readTree(response.getContentAsString()).path("id").asLong();
        long large=upload(Arrays.copyOf(TestImages.png(96,96),204801));
        invalid("missing",List.of(jpeg),404,"TEMPLATE_NOT_FOUND");
        invalid("wedding-invite",List.of(jpeg),404,"TEMPLATE_NOT_FOUND");
        invalid("travel-postcard",List.of(jpeg),400,"MATERIAL_COUNT_MISMATCH");
        invalid("travel-postcard",List.of(jpeg,jpeg),400,"DUPLICATE_MATERIAL");
        invalid("pet-sticker",List.of(foreign),400,"MATERIAL_NOT_FOUND");
        invalid("pet-sticker",List.of(Long.MAX_VALUE),400,"MATERIAL_NOT_FOUND");
        invalid("hot-film",List.of(png),400,"MATERIAL_TYPE_NOT_ACCEPTED");
        invalid("hot-avatar",List.of(large),400,"MATERIAL_TOO_LARGE");
        mvc.perform(post("/api/tasks").cookie(user).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(post("/api/tasks").cookie(user).header("Idempotency-Key","x".repeat(65)).contentType("application/json").content(body("pet-sticker",List.of(jpeg))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        assertEquals(0,count());
    }
    private int count(){return jdbc.queryForObject("SELECT COUNT(*) FROM generation_task WHERE user_id=?",Integer.class,userId);}
    private void invalid(String template,List<Long> ids,int expectedStatus,String code) throws Exception {
        mvc.perform(post("/api/tasks").cookie(user).contentType("application/json").content(body(template,ids)))
                .andExpect(status().is(expectedStatus)).andExpect(jsonPath("$.code").value(code));assertEquals(0,count());
    }
    private long submitWithKey(long material,String key) throws Exception {
        var response=mvc.perform(post("/api/tasks").cookie(user).header("Idempotency-Key",key).contentType("application/json")
                .content(body("pet-sticker",List.of(material)))).andExpect(status().isAccepted()).andReturn().getResponse();
        long id=json.readTree(response.getContentAsString()).path("id").asLong();assertEquals("/api/tasks/"+id,response.getHeader("Location"));return id;
    }
    @Test void sequentialRetriesReturnTheSameTask() throws Exception {
        long material=upload(TestImages.jpeg(96,96));long first=submitWithKey(material,"retry");
        assertEquals(first,submitWithKey(material,"retry"));assertEquals(1,count());finish(first);
        long second=submitWithKey(material,"new-intent");assertNotEquals(first,second);finish(second);assertEquals(2,count());
    }
    @Test void concurrentRetriesCommitExactlyOneTask() throws Exception {
        long material=upload(TestImages.jpeg(96,96));var ready=new CountDownLatch(2);var go=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)){
            Callable<Long> submit=()->{ready.countDown();assertTrue(go.await(5,TimeUnit.SECONDS));return submitWithKey(material,"concurrent");};
            var a=executor.submit(submit);var b=executor.submit(submit);assertTrue(ready.await(5,TimeUnit.SECONDS));go.countDown();
            long id=a.get(10,TimeUnit.SECONDS);assertEquals(id,b.get(10,TimeUnit.SECONDS));assertEquals(1,count());finish(id);
        }
    }
    @Test void idempotencyKeyIsScopedToUser() throws Exception {
        long material=upload(TestImages.jpeg(96,96));long a=submitWithKey(material,"shared-key");finish(a);
        user=TestUsers.register(mvc);userId=auth.authenticate(user.getValue()).getId();
        long b=submitWithKey(upload(TestImages.jpeg(96,96)),"shared-key");finish(b);assertNotEquals(a,b);
    }
}
