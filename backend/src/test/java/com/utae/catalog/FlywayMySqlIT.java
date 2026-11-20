package com.utae.catalog;
import static org.junit.jupiter.api.Assertions.*;
import java.sql.DriverManager;
import java.util.Set;
import java.util.HashSet;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
/** Opt-in real MySQL test. URL must name the isolated utae_stage3_test database. */
class FlywayMySqlIT {
    private static final Set<String> EXPECTED_TABLES = Set.of(
        "app_user", "song", "song_ownership", "song_package_version", "stored_asset",
        "package_version_asset", "version_lyric_line", "lyric_token", "flyway_schema_history");

    @Test void migratesIsolatedMySqlSchemaAndConfirmsCoreConstraints() throws Exception {
        String url = System.getenv("UTAE_TEST_DB_URL");
        String user = System.getenv("UTAE_TEST_DB_USER");
        String password = System.getenv("UTAE_TEST_DB_PASSWORD");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "No dedicated MySQL integration schema configured; test skipped.");
        assertTrue(url.matches("jdbc:mysql://[^/]+/utae_stage3_test(?:\\?.*)?"), "Refusing a non-test schema URL.");
        assertNotNull(user); assertFalse(user.isBlank()); assertNotNull(password); assertFalse(password.isBlank());
        Set<String> existing;
        try (var connection = DriverManager.getConnection(url, user, password);
             var version = connection.createStatement().executeQuery("SELECT VERSION()")) {
            assertTrue(version.next());
            assertFalse(version.getString(1).toLowerCase().contains("mariadb"), "Refusing MariaDB; this test requires MySQL.");
            var match = java.util.regex.Pattern.compile("^(\\d+)\\.(\\d+)\\.(\\d+)").matcher(version.getString(1));
            assertTrue(match.find(), "Unable to determine MySQL server version: " + version.getString(1));
            int major = Integer.parseInt(match.group(1));
            int minor = Integer.parseInt(match.group(2));
            int patch = Integer.parseInt(match.group(3));
            assertTrue(major > 8 || major == 8 && (minor > 0 || minor == 0 && patch >= 16),
                "MySQL 8.0.16+ is required for enforced CHECK constraints.");
        }
        try (var connection = DriverManager.getConnection(url, user, password);
             var statement = connection.createStatement();
             var result = statement.executeQuery("SELECT table_name FROM information_schema.tables WHERE table_schema='utae_stage3_test'")) {
            existing = new HashSet<>();
            while (result.next()) existing.add(result.getString(1));
            assertTrue(existing.isEmpty(),
                "Refusing to migrate a pre-existing test schema; use a fresh dedicated schema: " + existing);
        }
        var flyway = Flyway.configure().dataSource(url, user, password).locations("classpath:db/migration").cleanDisabled(true).load();
        assertTrue(flyway.migrate().migrationsExecuted <= 1);
        try (var connection = DriverManager.getConnection(url, user, password); var statement = connection.createStatement();
             var result = statement.executeQuery("SELECT table_name FROM information_schema.tables WHERE table_schema='utae_stage3_test'")) {
            Set<String> migrated = new HashSet<>();
            while (result.next()) migrated.add(result.getString(1));
            assertEquals(EXPECTED_TABLES, migrated);
        }
    }
}
