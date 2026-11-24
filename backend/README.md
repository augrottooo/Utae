# Utae Java API

Java 21 / Spring Boot 3 API module. It requires a project-owned MySQL schema and MinIO-compatible storage. No schema is selected or migrated by default (`UTAE_MIGRATE=false`).

Review `src/main/resources/db/migration/V1__identity_catalog.sql`, create a dedicated database/user, and set the values from `.env.example` in the project run configuration or current shell. Spring Boot does not load `.env` automatically. Explicitly enable Flyway only for that database. The migration is additive and Flyway clean is disabled. Production session cookies are HttpOnly, Secure and SameSite=Lax; the `dev` profile disables Secure for local HTTP only.

Set both `UTAE_BOOTSTRAP_USERNAME` and a unique `UTAE_BOOTSTRAP_PASSWORD` (16+ characters) to create the initial maintainer account if it does not exist. There is no built-in development identity or public signup endpoint. Clear the bootstrap variables after use.

```powershell
mvn test
```

The opt-in `mysql-it` Maven profile is covered by step A below. A skipped integration test does not verify MySQL compatibility.

The dev filesystem object store is an opt-in adapter for local exercises and resolves keys beneath `UTAE_ASSET_ROOT`; production defaults to MinIO. Asset responses require the authorized song/version mapping and support a single byte range. No upload or processing API is included in this stage.

## Isolated MySQL + MinIO acceptance

### A. Migrate an empty test database

Use a separate MySQL 8.0.16+ instance listening on loopback port `13306`, with its own data directory. Provision an empty `utae_stage3_test` schema and a `utae_stage3_test` user with privileges limited to that schema. Never forward the test port to an existing MySQL service. From the repository root, set these variables for the current PowerShell process (supply the test password through your local run configuration):

```powershell
$env:UTAE_TEST_DB_URL = 'jdbc:mysql://127.0.0.1:13306/utae_stage3_test'
$env:UTAE_TEST_DB_USER = 'utae_stage3_test'
# Supply UTAE_TEST_DB_PASSWORD before running this command.
& .\backend\stage3-migrate.ps1
```

The script fails for absent credentials, unexpected server identity, nonempty schema, or a migration or metadata mismatch. It checks the eight application tables, Flyway history, restrictive foreign keys, primary and application indexes, and enforced CHECK constraints. It does not provision the schema or run cleanup. After it passes, leave the migrated schema in place for step B.

### B. Verify the fixture API and MinIO assets

Use a dedicated MinIO instance with a new volume or data directory and bind only its S3 API to loopback (proposed Windows address: `127.0.0.1:19000`). A working Docker Engine in WSL can run one container built from the [official MinIO source and Dockerfile](https://github.com/minio/minio#source-only-distribution) at the pinned release `RELEASE.2025-10-15T17-29-55Z`. Confirm Windows can reach the loopback endpoint before configuring the Java API. An alternative on a managed test host is the same container over a preapproved private connection. Use a new bucket called `utae-stage3-test` and separate credentials: the fixture operator can put objects into that bucket, while the API only needs to stat and read them. Do not mount any existing bucket or data directory.

Environment inspection on 2026-11-20 confirmed Ubuntu 24.04 WSL 2 and an existing Docker Engine 29.9.3. The default WSL user cannot access the Docker socket; root can read the engine state. The only existing image is `hello-world`, with one stopped container and no running containers. No MinIO or Podman executable was found in that distro. Starting the approved WSL inspection brought up its existing Docker daemon automatically; no daemon configuration or user groups were changed. A dedicated source-built MinIO container remains pending approval. Reserve roughly 6–10 GiB for source build/cache and test data; the WSL virtual disk's reported free space is not the same as free space on its Windows backing drive.

Prepare fixtures outside the runner in this order:

1. Add enabled `alice` and `bob` users with BCrypt password hashes in the migrated test schema. Add an `ACTIVE` shared song and an `ACTIVE` private song owned only by Alice.
2. Create a published version per song, then set the song's current version. Each version needs a schema-1 snapshot with `playerSong`, nonempty lyric lines with romanized tokens and audio entries for `1`, `0.75` and `0.5`. An unchunked fixture can omit `playerChunks`. Use simple fixture text without external links.
3. Upload the WAV assets to distinct object keys under `stage3-fixture/` in the test bucket, and record the original byte length and SHA-256 of each file in `stored_asset`. Keep both normal-speed WAVs below 4 MiB. Map each manifest source path through `package_version_asset`. Give the shared and private normal-speed WAVs distinct asset IDs and object keys, and do not map the private normal-speed asset to the shared version; the runner checks this mismatched pair.

Start the approved test API separately using the `dev` profile. Set `UTAE_DB_URL`, `UTAE_DB_USER` and `UTAE_DB_PASSWORD` to the isolated database from A, `UTAE_MIGRATE=false`, `UTAE_BIND_ADDRESS=127.0.0.1`, and `UTAE_API_PORT=18080`. Set `UTAE_STORAGE_MODE=minio`, `UTAE_MINIO_BUCKET=utae-stage3-test` and the isolated MinIO endpoint and credentials in the API process. Do not seed accounts through the maintainer bootstrap. The runner itself only uses HTTP; it does not use JDBC credentials or MinIO credentials.

From the repository root, set `UTAE_STAGE3_ALICE_USERNAME`, `UTAE_STAGE3_ALICE_PASSWORD`, `UTAE_STAGE3_BOB_USERNAME` and `UTAE_STAGE3_BOB_PASSWORD`. For both `UTAE_STAGE3_SHARED_*` and `UTAE_STAGE3_PRIVATE_*`, set `SONG_ID`, `VERSION_ID`, `ASSET_ID` (normal speed) and `ASSET_SHA256` (from the corresponding local WAV before upload).

```powershell
$env:UTAE_STAGE3_API_BASE_URL = 'http://127.0.0.1:18080'
$env:UTAE_STORAGE_MODE = 'minio'
$env:UTAE_MINIO_BUCKET = 'utae-stage3-test'
& .\backend\stage3-acceptance.ps1
```

The runner checks CSRF and separate sessions, catalog/detail/version reads, shared/private visibility, version-bound Manifest URLs, and denial for Bob, anonymous clients and a mismatched asset/version. It checks for object-key fields, external URLs and the fixture key prefix anywhere in the returned Manifest. For both WAVs it verifies full GET and SHA-256, an empty HEAD with the correct length, and the exact bytes returned by Range. The isolated API configuration establishes the storage backend; a matching WAV hash alone does not identify MinIO. The only POSTs are fixture logins; everything else is GET or HEAD. Run B again against the same prepared data without rerunning A.

For the separate browser check, set Vite's `UTAE_API_ORIGIN` to `http://127.0.0.1:18080`. Use the fixture API through the React dev server, sign in as Alice, open the shared and private songs and play, seek and refresh a practice page. Repeat the private-route access as Bob to verify the denial. Record the HTTP and browser results separately.
