package com.xiaoying.studio.auth;

import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class PasswordHasher {
    private static final String PREFIX="{bcrypt-sha256}";
    private final BCryptPasswordEncoder bcrypt=new BCryptPasswordEncoder(10);

    public String encode(String password) {
        // SHA-256's 64 ASCII hex characters fit BCrypt's 72-byte input limit.
        return PREFIX+bcrypt.encode(TokenHasher.hash(password));
    }

    public boolean matches(String password,String encoded) {
        if(encoded.startsWith(PREFIX)) {
            return bcrypt.matches(TokenHasher.hash(password),encoded.substring(PREFIX.length()));
        }
        // Seed accounts use the specification's plain BCrypt format.
        return password.getBytes(StandardCharsets.UTF_8).length<=72 && bcrypt.matches(password,encoded);
    }
}
