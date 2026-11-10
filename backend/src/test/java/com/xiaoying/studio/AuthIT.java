package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import com.xiaoying.studio.auth.TokenHasher;

class AuthIT extends AbstractIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Test void loginMeAndLogout() throws Exception {
        var response=mvc.perform(post("/api/auth/login").contentType("application/json")
                .content("{\"username\":\"demo\",\"password\":\"demo123\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.username").value("demo"))
                .andReturn().getResponse();
        String raw=response.getHeader("Set-Cookie");
        assertTrue(raw.contains("HttpOnly")); assertTrue(raw.contains("SameSite=Lax"));
        assertTrue(raw.contains("Path=/")); assertTrue(raw.contains("Max-Age=604800"));
        var cookie=new Cookie("XY_SESSION",raw.split(";",2)[0].split("=",2)[1]);
        String userId=response.getHeader("X-User-Id");
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk()).andExpect(header().string("X-User-Id",userId));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM user_session WHERE token_hash=?",Integer.class,TokenHasher.hash(cookie.getValue())));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM user_session WHERE token_hash=?",Integer.class,cookie.getValue()));
        mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent()).andExpect(header().string("Set-Cookie",org.hamcrest.Matchers.containsString("Max-Age=0")));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/logout")).andExpect(status().isNoContent());
    }
    @Test void invalidCredentialsAndRegistration() throws Exception {
        for(String username:new String[]{"demo","unknown_user"}) {
            mvc.perform(post("/api/auth/login").contentType("application/json")
                    .content("{\"username\":\""+username+"\",\"password\":\"wrong123\"}"))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }
        mvc.perform(post("/api/auth/register").contentType("application/json")
                .content("{\"username\":\"demo\",\"password\":\"demo123\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
        mvc.perform(post("/api/auth/register").contentType("application/json")
                .content("{\"username\":\"!\",\"password\":\"x\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors").isNotEmpty());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void expiredSessionIsUnauthenticated() throws Exception {
        var cookie=TestUsers.register(mvc);
        jdbc.update("UPDATE user_session SET expires_at=? WHERE token_hash=?",java.sql.Timestamp.from(java.time.Instant.EPOCH),TokenHasher.hash(cookie.getValue()));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }
}
