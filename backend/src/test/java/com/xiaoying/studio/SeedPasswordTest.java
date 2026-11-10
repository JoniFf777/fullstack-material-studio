package com.xiaoying.studio;
import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
class SeedPasswordTest {
    @Test void hashesMatchDemonstrationPasswords() throws Exception {
        String sql;
        try(var input=getClass().getResourceAsStream("/db/migration/V2__seed.sql")) { sql=new String(input.readAllBytes(),StandardCharsets.UTF_8); }
        var encoder=new BCryptPasswordEncoder(10);
        for(String username:new String[]{"demo","alice"}) {
            var matcher=Pattern.compile("\\('"+username+"','([^']+)'").matcher(sql);
            assertTrue(matcher.find()); assertTrue(encoder.matches(username+"123",matcher.group(1)));
            assertTrue(matcher.group(1).startsWith("$2a$10$"));
        }
    }
}
