package com.xiaoying.studio.task;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.xiaoying.studio.auth.*;
import com.xiaoying.studio.common.*;
import com.xiaoying.studio.material.FileStorage;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/tasks")
public class TaskController {
    private final TaskSubmissionService submission;private final TaskQueryService query;private final FileStorage storage;
    public TaskController(TaskSubmissionService submission,TaskQueryService query,FileStorage storage){this.submission=submission;this.query=query;this.storage=storage;}
    public record SubmitRequest(@NotBlank(message="请选择模板") @Size(max=64,message="模板 ID 最长 64 位") String templateId,
                                @NotNull(message="请提供素材列表") List<@NotNull(message="素材 ID 不能为空") @Positive(message="素材 ID 必须为正整数") Long> materialIds) {}
    @PostMapping(consumes="application/json") public ResponseEntity<TaskDto> submit(@LoginUser CurrentUser user,@Valid @RequestBody SubmitRequest body,
            @RequestHeader(value="Idempotency-Key",required=false) String key){
        var task=submission.submit(user.id(),body.templateId(),body.materialIds(),key);
        return ResponseEntity.accepted().header(HttpHeaders.LOCATION,"/api/tasks/"+task.id()).body(task);
    }
    @GetMapping public Items<TaskDto> list(@LoginUser CurrentUser user,@RequestParam(required=false) String templateId,
            @RequestParam(defaultValue="50") @Min(value=1,message="limit 至少为 1") int limit){
        return new Items<>(query.list(user.id(),templateId,Math.min(limit,100)));
    }
    @GetMapping("/{id}") public TaskDto detail(@LoginUser CurrentUser user,@PathVariable long id){return query.require(id,user.id());}
    @GetMapping("/{id}/result") public ResponseEntity<Resource> result(@LoginUser CurrentUser user,@PathVariable long id){
        var task=query.result(id,user.id());
        if(!storage.exists(task.getResultKey()))throw new ApiException(404,ErrorCode.TASK_RESULT_NOT_FOUND,"结果不存在");
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).header(HttpHeaders.CACHE_CONTROL,"private, max-age=86400")
                .body(new FileSystemResource(storage.resolve(task.getResultKey())));
    }
}
