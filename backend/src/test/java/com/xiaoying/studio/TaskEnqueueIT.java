package com.xiaoying.studio;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;
import java.sql.*;
import java.time.Instant;
import java.util.List;
import com.xiaoying.studio.task.*;
import com.xiaoying.studio.task.engine.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class TaskEnqueueIT extends AbstractTaskIntegrationTest {
    @MockitoBean TaskDispatcher dispatcher;
    @Autowired TaskCreationTransaction creation;
    @Autowired PlatformTransactionManager transactions;
    @Autowired DataSource dataSource;
    @Autowired TaskRunner runner;
    private TaskRow pending(){
        var task=new TaskRow();task.setUserId(userId);task.setTemplateId("pet-sticker");
        task.setSimPlan(json.writeValueAsString(settings.snapshot()));
        var now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);task.setCreatedAt(now);task.setUpdatedAt(now);return task;
    }
    @Test void dispatchHappensOnlyAfterCommitAndSeesCommittedRows() throws Exception {
        long material=upload(TestImages.jpeg(96,96));clearInvocations(dispatcher);
        doAnswer(invocation->{
            long id=invocation.getArgument(0);
            // Independent JDBC connection cannot see an uncommitted submission.
            try(var connection=dataSource.getConnection();var statement=connection.prepareStatement("SELECT COUNT(*) FROM generation_task_material WHERE task_id=?")){
                statement.setLong(1,id);try(var result=statement.executeQuery()){assertTrue(result.next());assertEquals(1,result.getInt(1));}
            }
            return null;
        }).when(dispatcher).dispatch(anyLong());
        long id=new TransactionTemplate(transactions).execute(transaction->{
            long value=creation.create(pending(),List.of(material));verifyNoInteractions(dispatcher);return value;
        });
        verify(dispatcher,times(1)).dispatch(id);runner.run(id);assertEquals(TaskStatus.SUCCEEDED,finish(id).status());
    }
    @Test void rollbackNeverDispatchesAndLeavesNoTask() throws Exception {
        long material=upload(TestImages.jpeg(96,96));clearInvocations(dispatcher);
        long id=new TransactionTemplate(transactions).execute(transaction->{
            long value=creation.create(pending(),List.of(material));transaction.setRollbackOnly();return value;
        });
        verifyNoInteractions(dispatcher);
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM generation_task WHERE id=?",Integer.class,id));
    }
    @Test void duplicateDeliveryExecutesOnlyOnePipeline() throws Exception {
        long material=upload(TestImages.jpeg(96,96));long id=creation.create(pending(),List.of(material));
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(2)){
            var a=executor.submit(()->runner.run(id));var b=executor.submit(()->runner.run(id));
            a.get(10,java.util.concurrent.TimeUnit.SECONDS);b.get(10,java.util.concurrent.TimeUnit.SECONDS);
        }
        var done=finish(id);assertEquals(TaskStatus.SUCCEEDED,done.status());assertEquals(3,done.steps().size());
        var before=done;runner.run(id);assertEquals(before,query.require(id,userId));
    }
}
