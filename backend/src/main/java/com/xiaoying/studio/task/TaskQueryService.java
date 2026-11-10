package com.xiaoying.studio.task;
import java.util.*;
import java.util.stream.Collectors;
import com.xiaoying.studio.common.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @Transactional(readOnly=true)
public class TaskQueryService {
    private final TaskMapper tasks;private final TaskStepMapper steps;private final TaskMaterialMapper materials;
    public TaskQueryService(TaskMapper tasks,TaskStepMapper steps,TaskMaterialMapper materials){this.tasks=tasks;this.steps=steps;this.materials=materials;}
    public TaskDto require(long id,long userId){
        var task=tasks.owned(id,userId);
        if(task==null)throw new ApiException(404,ErrorCode.TASK_NOT_FOUND,"任务不存在");
        return assemble(List.of(task),userId).getFirst();
    }
    public List<TaskDto> list(long userId,String templateId,int limit){return assemble(tasks.list(userId,templateId,limit),userId);}
    public TaskRow result(long id,long userId){
        var task=tasks.owned(id,userId);
        if(task==null || task.getStatus()!=TaskStatus.SUCCEEDED || task.getResultKey()==null)
            throw new ApiException(404,ErrorCode.TASK_RESULT_NOT_FOUND,"结果不存在");
        return task;
    }
    private List<TaskDto> assemble(List<TaskRow> rows,long userId){
        if(rows.isEmpty())return List.of();
        var ids=rows.stream().map(TaskRow::getId).toList();
        var stepMap=steps.forTasks(ids,userId).stream().collect(Collectors.groupingBy(TaskStepRow::getTaskId));
        var materialMap=materials.forTasks(ids,userId).stream().collect(Collectors.groupingBy(TaskMaterialRow::getTaskId));
        return rows.stream().map(t->new TaskDto(t.getId(),t.getTemplateId(),t.getTemplateTitle(),t.getCoverUrl(),t.getStatus(),t.getStage(),
                t.getFailedStage(),t.getErrorCode(),t.getErrorMessage(),t.getStatus()==TaskStatus.SUCCEEDED?"/api/tasks/"+t.getId()+"/result":null,
                materialMap.getOrDefault(t.getId(),List.of()).stream().map(m->new TaskDto.MaterialDto(m.getSlotIndex(),m.getMaterialId(),"/api/materials/"+m.getMaterialId()+"/content")).toList(),
                stepMap.getOrDefault(t.getId(),List.of()).stream().map(s->new TaskDto.StepDto(s.getStage(),s.getStatus(),s.getStartedAt(),s.getFinishedAt(),s.getMessage())).toList(),
                t.getCreatedAt(),t.getStartedAt(),t.getFinishedAt(),t.getUpdatedAt())).toList();
    }
}
