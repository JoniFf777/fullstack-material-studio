package com.xiaoying.studio.task;
import java.time.Clock;
import java.util.*;
import com.xiaoying.studio.common.*;
import com.xiaoying.studio.material.MaterialMapper;
import com.xiaoying.studio.simulation.SimulationSettings;
import com.xiaoying.studio.template.TemplateService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;
@Service
public class TaskSubmissionService {
    private final TaskMapper tasks;private final MaterialMapper materials;private final TemplateService templates;
    private final SimulationSettings settings;private final TaskCreationTransaction creation;private final TaskQueryService query;
    private final Clock clock;private final JsonMapper json;
    public TaskSubmissionService(TaskMapper tasks,MaterialMapper materials,TemplateService templates,SimulationSettings settings,
            TaskCreationTransaction creation,TaskQueryService query,Clock clock,JsonMapper json){
        this.tasks=tasks;this.materials=materials;this.templates=templates;this.settings=settings;this.creation=creation;this.query=query;this.clock=clock;this.json=json;
    }
    public TaskDto submit(long userId,String templateId,List<Long> ids,String key){
        if(key!=null && key.length()>64)throw ApiException.validation("Idempotency-Key","幂等键最长 64 位");
        if(key!=null){var previous=tasks.byRequest(userId,key);if(previous!=null)return query.require(previous.getId(),userId);}
        var template=templates.require(templateId);
        if(ids.size()!=template.requiredImageCount())throw new ApiException(400,ErrorCode.MATERIAL_COUNT_MISMATCH,"需要上传 "+template.requiredImageCount()+" 张图片");
        if(new HashSet<>(ids).size()!=ids.size())throw new ApiException(400,ErrorCode.DUPLICATE_MATERIAL,"不能重复使用同一张素材");
        var found=ids.stream().map(id->materials.owned(id,userId)).toList();
        if(found.stream().anyMatch(Objects::isNull))throw new ApiException(400,ErrorCode.MATERIAL_NOT_FOUND,"素材不存在，请重新上传");
        if(found.stream().anyMatch(m->!template.acceptedMimeTypes().contains(m.getMimeType())))throw new ApiException(400,ErrorCode.MATERIAL_TYPE_NOT_ACCEPTED,"素材类型不被该模板接受");
        if(found.stream().anyMatch(m->m.getSizeBytes()>template.maxFileSizeBytes()))throw new ApiException(400,ErrorCode.MATERIAL_TOO_LARGE,"素材超过该模板的大小限制");
        var task=new TaskRow();task.setUserId(userId);task.setTemplateId(templateId);task.setStatus(TaskStatus.PENDING);
        task.setClientRequestId(key);task.setSimPlan(json.writeValueAsString(settings.snapshot()));
        var now=Times.now(clock);task.setCreatedAt(now);task.setUpdatedAt(now);
        long id;
        try {id=creation.create(task,ids);}
        catch(DuplicateKeyException e){
            var existing=key==null?null:tasks.byRequest(userId,key);
            if(existing==null)throw e;
            id=existing.getId();
        }
        return query.require(id,userId);
    }
}
