package com.xiaoying.studio.task.engine;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;
@Component
public class TaskEnqueueListener {
    private final TaskDispatcher dispatcher;
    public TaskEnqueueListener(TaskDispatcher dispatcher){this.dispatcher=dispatcher;}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT)
    public void created(TaskCreatedEvent event){dispatcher.dispatch(event.taskId());}
}
