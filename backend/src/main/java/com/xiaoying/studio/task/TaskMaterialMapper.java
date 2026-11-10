package com.xiaoying.studio.task;
import java.util.List;
import com.xiaoying.studio.material.MaterialRow;
import org.apache.ibatis.annotations.*;
@Mapper
public interface TaskMaterialMapper {
    int insert(@Param("taskId") long taskId,@Param("slot") int slot,@Param("materialId") long materialId);
    List<TaskMaterialRow> forTasks(@Param("ids") List<Long> ids,@Param("userId") long userId);
    List<MaterialRow> forWorker(@Param("taskId") long taskId,@Param("userId") long userId);
}
