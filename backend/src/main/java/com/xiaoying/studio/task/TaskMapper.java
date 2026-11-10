package com.xiaoying.studio.task;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.*;
@Mapper
public interface TaskMapper {
    int insert(TaskRow task);
    TaskRow owned(@Param("id") long id,@Param("userId") long userId);
    TaskRow forWorker(@Param("id") long id);
    TaskRow byRequest(@Param("userId") long userId,@Param("key") String key);
    List<TaskRow> list(@Param("userId") long userId,@Param("templateId") String templateId,@Param("limit") int limit);
    List<Long> pending();
    int claim(@Param("id") long id,@Param("now") Instant now);
    int enterStage(@Param("id") long id,@Param("stage") TaskStage stage,@Param("now") Instant now);
    int succeed(@Param("id") long id,@Param("resultKey") String resultKey,@Param("now") Instant now);
    int fail(@Param("id") long id,@Param("stage") TaskStage stage,@Param("code") String code,@Param("message") String message,@Param("now") Instant now);
    int interruptProcessing(@Param("now") Instant now);
}
