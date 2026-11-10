package com.xiaoying.studio;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
public final class TestUsers {
    private TestUsers() {}
    public static Cookie register(MockMvc mvc) throws Exception {
        String username="u"+UUID.randomUUID().toString().replace("-", "").substring(0,17);
        var response=mvc.perform(post("/api/auth/register").contentType("application/json")
                .content("{\"username\":\""+username+"\",\"password\":\"test123\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        String token=response.getHeader("Set-Cookie").split(";",2)[0].split("=",2)[1];
        return new Cookie("XY_SESSION",token);
    }
}
