package com.xiaoying.studio.task.engine;
import com.xiaoying.studio.task.TaskMapper;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
@Component
public class TaskRecovery {
    private final MyBatisTaskStateStore store;private final TaskMapper tasks;private final TaskDispatcher dispatcher;
    public TaskRecovery(MyBatisTaskStateStore store,TaskMapper tasks,TaskDispatcher dispatcher){this.store=store;this.tasks=tasks;this.dispatcher=dispatcher;}
    @EventListener(ApplicationReadyEvent.class)
    public void recover(){
        store.interruptProcessing();
        for(long id:tasks.pending())dispatcher.dispatch(id);
    }
}
