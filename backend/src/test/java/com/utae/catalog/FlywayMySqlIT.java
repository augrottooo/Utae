package com.utae.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

class FlywayMySqlIT {
    private static final String SCHEMA = "utae_stage3_test";
    private static final String URL = "jdbc:mysql://127.0.0.1:13306/" + SCHEMA;
    private static final Set<String> EXPECTED_TABLES = Set.of(
        "app_user", "song", "song_ownership", "song_package_version", "stored_asset",
        "package_version_asset", "version_lyric_line", "lyric_token", "flyway_schema_history");

    @Test
    void migratesIsolatedMySqlSchemaAndConfirmsCoreConstraints() throws SQLException {
        String configuredUrl = System.getenv("UTAE_TEST_DB_URL");
        String user = System.getenv("UTAE_TEST_DB_USER");
        String password = System.getenv("UTAE_TEST_DB_PASSWORD");
        if (!Boolean.getBoolean("utae.stage3.migration.required")) {
            Assumptions.assumeTrue(configuredUrl != null, "No isolated MySQL configured.");
        }
        assertEquals(URL, configuredUrl, "Use the isolated loopback instance and dedicated test schema.");
        assertEquals(SCHEMA, user, "Use the dedicated test account.");
        assertTrue(password != null && !password.isBlank(), "Missing dedicated test password.");
        String url = URL + "?connectTimeout=3000&socketTimeout=30000";
        try (var connection = DriverManager.getConnection(url, user, password);
             var statement = connection.createStatement();
             var target = statement.executeQuery("SELECT DATABASE(), @@port, CURRENT_USER(), VERSION(), @@version_comment")) {
            assertTrue(target.next());
            assertEquals(SCHEMA, target.getString(1));
            assertEquals(13306, target.getInt(2), "Refusing a forwarded server on a different MySQL port.");
            assertTrue(target.getString(3).startsWith(SCHEMA + "@"), "Unexpected authenticated account.");
            assertEquals("MySQL", connection.getMetaData().getDatabaseProductName());
            assertTrue(target.getString(5).contains("MySQL"), "Expected an Oracle MySQL server.");
            var match = java.util.regex.Pattern.compile("^(\\d+)\\.(\\d+)\\.(\\d+)").matcher(target.getString(4));
            assertTrue(match.find(), "Cannot determine MySQL version.");
            int major = Integer.parseInt(match.group(1));
            int minor = Integer.parseInt(match.group(2));
            int patch = Integer.parseInt(match.group(3));
            assertTrue(major > 8 || major == 8 && (minor > 0 || patch >= 16),
                "MySQL 8.0.16+ is required for enforced CHECK constraints.");
            assertEquals(Set.of(), query(connection, """
                SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()
                UNION ALL SELECT routine_name FROM information_schema.routines WHERE routine_schema = DATABASE()
                UNION ALL SELECT event_name FROM information_schema.events WHERE event_schema = DATABASE()
                """), "Refusing to migrate a test schema containing existing objects.");
        }

        var flyway = Flyway.configure()
            .dataSource(url, user, password).defaultSchema(SCHEMA).createSchemas(false)
            .locations("classpath:db/migration").cleanDisabled(true).load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        flyway.validate();

        try (var connection = DriverManager.getConnection(url, user, password)) {
            assertEquals(EXPECTED_TABLES, query(connection,
                "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"));
            assertEquals(Set.of(
                "song(id,current_published_version_id)->song_package_version(song_id,id)",
                "song_ownership(song_id)->song(id)", "song_ownership(user_id)->app_user(id)",
                "song_package_version(song_id)->song(id)", "version_lyric_line(version_id)->song_package_version(id)",
                "lyric_token(version_line_id)->version_lyric_line(id)",
                "package_version_asset(version_id)->song_package_version(id)",
                "package_version_asset(asset_id)->stored_asset(id)"), query(connection, """
                SELECT CONCAT(k.table_name, '(', GROUP_CONCAT(k.column_name ORDER BY k.ordinal_position),
                    ')->', k.referenced_table_name, '(',
                    GROUP_CONCAT(k.referenced_column_name ORDER BY k.ordinal_position), ')')
                FROM information_schema.key_column_usage k
                JOIN information_schema.referential_constraints r
                  ON r.constraint_schema = k.constraint_schema AND r.constraint_name = k.constraint_name
                  AND r.table_name = k.table_name
                WHERE k.table_schema = DATABASE() AND k.referenced_table_schema = DATABASE()
                  AND r.delete_rule IN ('RESTRICT', 'NO ACTION') AND r.update_rule IN ('RESTRICT', 'NO ACTION')
                GROUP BY k.table_name, k.constraint_name, k.referenced_table_name
                """), "Missing or incorrect restrictive foreign key.");
            var indexes = query(connection, """
                SELECT CONCAT(table_name, '/', index_name, '/', non_unique, '(', GROUP_CONCAT(
                    CONCAT(column_name, IF(sub_part IS NULL, '', CONCAT(':', sub_part))) ORDER BY seq_in_index), ')')
                FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND is_visible = 'YES'
                GROUP BY table_name, index_name, non_unique
                """);
            for (String expected : Set.of(
                "app_user/PRIMARY/0(id)", "app_user/username/0(username)",
                "song/PRIMARY/0(id)", "song/ix_song_catalog/1(visibility,lifecycle_status,id)",
                "song_ownership/PRIMARY/0(song_id,user_id)", "song_ownership/ix_ownership_user/1(user_id,song_id)",
                "song_package_version/PRIMARY/0(id)", "song_package_version/song_id/0(song_id,package_version)",
                "song_package_version/song_id_2/0(song_id,id)",
                "stored_asset/PRIMARY/0(id)", "stored_asset/object_key/0(object_key)",
                "version_lyric_line/PRIMARY/0(id)", "version_lyric_line/version_id/0(version_id,line_no)",
                "version_lyric_line/version_id_2/0(version_id,source_line_id)",
                "lyric_token/PRIMARY/0(id)", "lyric_token/version_line_id/0(version_line_id,token_no)",
                "package_version_asset/PRIMARY/0(version_id,source_path)",
                "package_version_asset/ix_version_asset/1(asset_id,version_id)")) {
                assertTrue(indexes.contains(expected), "Missing or incorrect index: " + expected);
            }
            assertEquals(Set.of("app_user:1", "song:3", "song_ownership:1", "song_package_version:2",
                "stored_asset:1", "version_lyric_line:1", "lyric_token:1"), query(connection, """
                SELECT CONCAT(table_name, ':', COUNT(*)) FROM information_schema.table_constraints
                WHERE constraint_schema = DATABASE() AND constraint_type = 'CHECK'
                GROUP BY table_name HAVING SUM(enforced = 'YES') = COUNT(*)
                """), "Missing or non-enforced CHECK constraint.");
        }
    }

    private static Set<String> query(Connection connection, String sql) throws SQLException {
        Set<String> values = new HashSet<>();
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            while (result.next()) assertFalse(!values.add(result.getString(1)), "Duplicate metadata entry.");
        }
        return values;
    }
}
