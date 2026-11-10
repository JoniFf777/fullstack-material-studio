package com.xiaoying.studio.auth;
import java.time.Instant;
import org.apache.ibatis.annotations.*;
@Mapper
public interface SessionMapper {
    int insert(@Param("hash") String hash, @Param("userId") long userId, @Param("now") Instant now, @Param("expiresAt") Instant expiresAt);
    UserRow findUser(@Param("hash") String hash, @Param("now") Instant now);
    int delete(@Param("hash") String hash);
}
