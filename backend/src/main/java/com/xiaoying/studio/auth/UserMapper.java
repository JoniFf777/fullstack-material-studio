package com.xiaoying.studio.auth;
import org.apache.ibatis.annotations.*;
@Mapper
public interface UserMapper {
    UserRow byUsername(@Param("username") String username);
    UserRow byId(@Param("id") long id);
    int insert(UserRow user);
}
