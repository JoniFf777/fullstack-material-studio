package com.xiaoying.studio.task;
import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.*;
@Mapper
public interface TaskStepMapper {
    int insertRunning(@Param("id") long id,@Param("stage") TaskStage stage,@Param("now") Instant now);
    int complete(@Param("id") long id,@Param("stage") TaskStage stage,@Param("message") String message,@Param("now") Instant now);
    int fail(@Param("id") long id,@Param("stage") TaskStage stage,@Param("message") String message,@Param("now") Instant now);
    int interruptRunning(@Param("now") Instant now);
    List<TaskStepRow> forTasks(@Param("ids") List<Long> ids,@Param("userId") long userId);
}
