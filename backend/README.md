# Utae Java API

Java 21 / Spring Boot 3 API module. It requires a project-owned MySQL schema and MinIO-compatible storage. No schema is selected or migrated by default (`UTAE_MIGRATE=false`).

Review `src/main/resources/db/migration/V1__identity_catalog.sql`, create a dedicated database/user, and set the values from `.env.example` in the project run configuration or current shell. Spring Boot does not load `.env` automatically. Explicitly enable Flyway only for that database. The migration is additive and Flyway clean is disabled. Production session cookies are HttpOnly, Secure and SameSite=Lax; the `dev` profile disables Secure for local HTTP only.

Set both `UTAE_BOOTSTRAP_USERNAME` and a unique `UTAE_BOOTSTRAP_PASSWORD` (16+ characters) to create the initial maintainer account if it does not exist. There is no built-in development identity or public signup endpoint. Clear the bootstrap variables after use.

```powershell
mvn test
mvn -Pmysql-it verify
```

The second command runs only when `UTAE_TEST_DB_URL`, `UTAE_TEST_DB_USER` and `UTAE_TEST_DB_PASSWORD` point to a fresh, dedicated `utae_stage3_test` MySQL schema. It refuses any pre-existing tables, never runs `clean`, and verifies the server is MySQL rather than MariaDB. A skipped test is not evidence of MySQL compatibility.

The dev filesystem object store is an opt-in adapter for local exercises and resolves keys beneath `UTAE_ASSET_ROOT`; production defaults to MinIO. Asset responses require the authorized song/version mapping and support a single byte range. No upload or processing API is included in this stage.

## Isolated MySQL + MinIO acceptance

Use a disposable MySQL 8.0.16+ database named `utae_stage3_test` and a dedicated test user. Do not point the test variables at a development or production schema. Verify that the schema is empty, then set `UTAE_TEST_DB_URL`, `UTAE_TEST_DB_USER`, and `UTAE_TEST_DB_PASSWORD` for the current process and run `mvn -Pmysql-it verify`. The integration test checks the server is MySQL, refuses every pre-existing table (including an old Flyway history table), applies Flyway to the empty schema, and verifies all eight application tables plus Flyway history. A skipped test does not verify compatibility.

For the asset path, create a disposable MinIO bucket and test credentials, set `UTAE_MINIO_ENDPOINT`, `UTAE_MINIO_ACCESS_KEY`, `UTAE_MINIO_SECRET_KEY`, and `UTAE_MINIO_BUCKET`, then insert only fixture rows in the dedicated schema: two users (`alice` and `bob`); one `SHARED`/`ACTIVE` song and one `PRIVATE`/`ACTIVE` song owned by `alice`; a published version for each song; and three immutable `stored_asset` rows mapped into each version through `package_version_asset`. Put a small WAV object at each of the three unique object keys; the three schema-1 manifests must reference the three package source paths and use the correct version IDs. Configure `UTAE_STAGE3_SHARED_*` and `UTAE_STAGE3_PRIVATE_*` IDs to match those rows. A private asset ID may reuse one of the same immutable asset rows as the shared version, since authorization must also bind the requested version and song visibility.

With the API running in the `dev` profile, obtain a CSRF token, log in as `alice`, and verify: shared manifest and `GET`/`HEAD` asset access; `Range: bytes=0-15` returns `206` with the correct `Content-Range`; the manifest contains `/api/assets/{assetId}?versionId=...` and never an object key; `bob` and anonymous requests cannot read the private song or its assets; missing object/version mappings return the documented error without a cacheable response. Remove the disposable bucket and schema after the run.

The repeatable HTTP acceptance runner is `backend/stage3-acceptance.ps1`. It requires the dedicated schema, MinIO settings, API `UTAE_STORAGE_MODE=minio`, and fixture IDs/credentials supplied through `UTAE_STAGE3_*` variables. It runs `mvn -Pmysql-it verify`, then checks CSRF login, server-side identity, catalog/detail/version reads, shared and private manifests, object-key hiding, MinIO-backed GET/HEAD, a `bytes=0-15` range, and Bob/anonymous private-resource denial. It never creates, deletes, or cleans a database, bucket, row, or object; missing or non-dedicated configuration is rejected before any connection attempt.
