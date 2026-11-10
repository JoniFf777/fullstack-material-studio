package com.xiaoying.studio.auth;

import java.security.SecureRandom;
import java.time.*;
import java.util.Base64;
import com.xiaoying.studio.common.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserMapper users;
    private final SessionMapper sessions;
    private final Clock clock;
    private final long ttlHours;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(10);
    private final SecureRandom random = new SecureRandom();
    public record AuthResult(UserDto user, String token) {}
    public AuthService(UserMapper users, SessionMapper sessions, Clock clock,
                       @Value("${studio.session-ttl-hours}") long ttlHours) {
        this.users=users; this.sessions=sessions; this.clock=clock; this.ttlHours=ttlHours;
    }
    @Transactional
    public AuthResult register(String username, String password, String displayName) {
        var user = new UserRow();
        user.setUsername(username);
        user.setDisplayName(displayName == null || displayName.isBlank() ? username : displayName);
        user.setPasswordHash(passwords.encode(password));
        user.setCreatedAt(Times.now(clock));
        try { users.insert(user); }
        catch (DuplicateKeyException e) { throw new ApiException(409, ErrorCode.USERNAME_TAKEN, "用户名已被注册"); }
        return session(user);
    }
    @Transactional
    public AuthResult login(String username, String password) {
        var user=users.byUsername(username);
        if (user == null || !passwords.matches(password, user.getPasswordHash()))
            throw new ApiException(401, ErrorCode.INVALID_CREDENTIALS, "用户名或密码错误");
        return session(user);
    }
    private AuthResult session(UserRow user) {
        byte[] bytes=new byte[32]; random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now=Times.now(clock);
        sessions.insert(TokenHasher.hash(token),user.getId(),now,now.plus(Duration.ofHours(ttlHours)));
        return new AuthResult(UserDto.from(user),token);
    }
    public UserRow authenticate(String token) {
        return token == null || token.length() > 128 ? null : sessions.findUser(TokenHasher.hash(token),Times.now(clock));
    }
    @Transactional public void logout(String token) { if(token != null) sessions.delete(TokenHasher.hash(token)); }
    public UserDto me(long id) { return UserDto.from(users.byId(id)); }
}
