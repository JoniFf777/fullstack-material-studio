package com.xiaoying.studio.task;
import java.util.List;
import com.xiaoying.studio.task.engine.TaskCreatedEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class TaskCreationTransaction {
    private final TaskMapper tasks;private final TaskMaterialMapper materials;private final ApplicationEventPublisher events;
    public TaskCreationTransaction(TaskMapper tasks,TaskMaterialMapper materials,ApplicationEventPublisher events){this.tasks=tasks;this.materials=materials;this.events=events;}
    @Transactional
    public long create(TaskRow task,List<Long> materialIds){
        tasks.insert(task);
        for(int i=0;i<materialIds.size();i++)materials.insert(task.getId(),i,materialIds.get(i));
        events.publishEvent(new TaskCreatedEvent(task.getId()));
        return task.getId();
    }
}
