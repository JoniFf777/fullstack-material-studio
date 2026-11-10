package com.xiaoying.studio;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest(properties = {"studio.dev-api-enabled=true", "studio.simulation.material-check-ms=0",
        "studio.simulation.generating-ms=0", "studio.simulation.result-assembly-ms=0"})
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
public abstract class AbstractIntegrationTest {
    // JUnit's per-class stop must not invalidate Spring's shared application context.
    // Ryuk removes this suite-scoped container when the test JVM exits.
    @Container @ServiceConnection
    protected static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4") {
        @Override public void stop() { }
        @Override public void close() { super.stop(); }
    };
    static { Runtime.getRuntime().addShutdownHook(new Thread(MYSQL::close, "studio-test-cleanup")); }
    private static final String STORAGE = temporaryStorage();
    private static String temporaryStorage() {
        try { return java.nio.file.Files.createTempDirectory("studio-it-").toString(); }
        catch (java.io.IOException e) { throw new java.io.UncheckedIOException(e); }
    }
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("studio.storage-root", () -> STORAGE);
    }
}
