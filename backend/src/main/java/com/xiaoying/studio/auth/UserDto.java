package com.xiaoying.studio.auth;
import java.time.Instant;
public record UserDto(long id, String username, String displayName, Instant createdAt) {
    public static UserDto from(UserRow u) { return new UserDto(u.getId(), u.getUsername(), u.getDisplayName(), u.getCreatedAt()); }
}
