package com.xiaoying.studio;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class SeedDataIT extends AbstractIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Test void migrationsSeedAllCatalogData() {
        assertEquals(5, jdbc.queryForObject("SELECT COUNT(*) FROM template_category", Integer.class));
        assertEquals(9, jdbc.queryForObject("SELECT COUNT(*) FROM template", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM app_user WHERE username IN ('demo','alice')", Integer.class));
    }
}
