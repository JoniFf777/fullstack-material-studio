package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.Arrays;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;
class MaterialUploadIT extends AbstractIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Test void validUploadUsesHeaderAndPrivateContent() throws Exception {
        var user=TestUsers.register(mvc);
        byte[] bytes=TestImages.png(96,96);
        var result=mvc.perform(multipart("/api/materials").file(new MockMultipartFile("file","photo.jpg","text/plain",bytes))
                .param("templateId","pet-sticker").cookie(user)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.mimeType").value("image/png")).andReturn();
        long id=json.readTree(result.getResponse().getContentAsString()).path("id").asLong();
        mvc.perform(get("/api/materials/"+id+"/content").cookie(user)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control","private, max-age=86400")).andExpect(content().bytes(bytes));
        mvc.perform(get("/api/materials/"+id+"/content").cookie(TestUsers.register(mvc))).andExpect(status().isNotFound());
    }
    @Test void validatesBeforePersisting() throws Exception {
        var user=TestUsers.register(mvc);
        expect(user,TestImages.fakeJpeg(),null,400,"FILE_TYPE_NOT_ALLOWED");
        expect(user,new byte[0],null,400,"FILE_EMPTY");
        expect(user,TestImages.jpeg(96,96),"missing",404,"TEMPLATE_NOT_FOUND");
        expect(user,TestImages.png(96,96),"hot-film",400,"FILE_TYPE_NOT_ALLOWED");
        byte[] largePng=Arrays.copyOf(TestImages.png(96,96),204801);
        expect(user,largePng,"hot-avatar",400,"FILE_TOO_LARGE");
        expect(user,new byte[10*1024*1024+1],null,413,"FILE_TOO_LARGE");
        mvc.perform(multipart("/api/materials").file(new MockMultipartFile("file",TestImages.jpeg(96,96))))
                .andExpect(status().isUnauthorized());
    }
    private void expect(Cookie user,byte[] bytes,String template,int status,String code) throws Exception {
        var request=multipart("/api/materials").file(new MockMultipartFile("file","test.jpg","image/jpeg",bytes)).cookie(user);
        if(template!=null) request.param("templateId",template);
        mvc.perform(request).andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code));
    }
}
