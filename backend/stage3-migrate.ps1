$ErrorActionPreference = 'Stop'

if ($env:UTAE_TEST_DB_URL -cne 'jdbc:mysql://127.0.0.1:13306/utae_stage3_test') {
    throw 'Expected an isolated MySQL instance: jdbc:mysql://127.0.0.1:13306/utae_stage3_test'
}
if ($env:UTAE_TEST_DB_USER -cne 'utae_stage3_test' -or [string]::IsNullOrWhiteSpace($env:UTAE_TEST_DB_PASSWORD)) {
    throw 'Set UTAE_TEST_DB_USER=utae_stage3_test and its dedicated test password.'
}

$pom = Join-Path $PSScriptRoot 'pom.xml'
& mvn -f $pom '-Pmysql-it' '-Dit.test=FlywayMySqlIT' '-Dutae.stage3.migration.required=true' verify
if ($LASTEXITCODE -ne 0) { throw "Flyway/MySQL verification failed with exit code $LASTEXITCODE." }
Write-Host 'PASS: empty MySQL schema migrated; tables, foreign keys, indexes and enforced CHECK constraints verified.'
