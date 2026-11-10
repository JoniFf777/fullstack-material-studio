package com.xiaoying.studio.material;
import org.apache.ibatis.annotations.*;
@Mapper
public interface MaterialMapper {
    int insert(MaterialRow material);
    MaterialRow owned(@Param("id") long id,@Param("userId") long userId);
}
