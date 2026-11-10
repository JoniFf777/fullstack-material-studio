package com.xiaoying.studio;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import com.xiaoying.studio.task.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
class TaskStateGuardIT extends AbstractIntegrationTest {
    @Autowired TaskMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @ParameterizedTest @ValueSource(strings={"SUCCEEDED","FAILED"})
    void terminalTasksCannotBeChanged(String status) {
        var now=Instant.parse("2026-11-10T08:00:00.123Z");
        jdbc.update("INSERT INTO generation_task(user_id,template_id,status,stage,sim_plan,created_at,updated_at) VALUES(1,'pet-sticker',?,'RESULT_ASSEMBLY','{}',?,?)",
                status,java.sql.Timestamp.from(now),java.sql.Timestamp.from(now));
        long id=jdbc.queryForObject("SELECT MAX(id) FROM generation_task",Long.class);
        var before=jdbc.queryForMap("SELECT * FROM generation_task WHERE id=?",id);
        assertEquals(0,mapper.claim(id,now));
        assertEquals(0,mapper.enterStage(id,TaskStage.MATERIAL_CHECK,now));
        assertEquals(0,mapper.succeed(id,"results/1/1.jpg",now));
        assertEquals(0,mapper.fail(id,TaskStage.GENERATING,"INTERNAL_ERROR","系统内部错误",now));
        assertEquals(before,jdbc.queryForMap("SELECT * FROM generation_task WHERE id=?",id));
    }
}
