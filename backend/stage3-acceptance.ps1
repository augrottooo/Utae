param(
    [string]$ApiBaseUrl = $(if ($env:UTAE_STAGE3_API_BASE_URL) { $env:UTAE_STAGE3_API_BASE_URL } else { 'http://127.0.0.1:8080' }),
    [string]$AliceUsername = $env:UTAE_STAGE3_ALICE_USERNAME,
    [string]$AlicePassword = $env:UTAE_STAGE3_ALICE_PASSWORD,
    [string]$BobUsername = $env:UTAE_STAGE3_BOB_USERNAME,
    [string]$BobPassword = $env:UTAE_STAGE3_BOB_PASSWORD,
    [string]$SharedSongId = $env:UTAE_STAGE3_SHARED_SONG_ID,
    [string]$SharedVersionId = $env:UTAE_STAGE3_SHARED_VERSION_ID,
    [string]$SharedAssetId = $env:UTAE_STAGE3_SHARED_ASSET_ID,
    [string]$PrivateSongId = $env:UTAE_STAGE3_PRIVATE_SONG_ID,
    [string]$PrivateVersionId = $env:UTAE_STAGE3_PRIVATE_VERSION_ID,
    [string]$PrivateAssetId = $env:UTAE_STAGE3_PRIVATE_ASSET_ID
)

$ErrorActionPreference = 'Stop'

function Require-Value([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing $Name. Refusing to run without dedicated Stage 3 fixture configuration."
    }
}

Require-Value 'UTAE_TEST_DB_URL' $env:UTAE_TEST_DB_URL
Require-Value 'UTAE_TEST_DB_USER' $env:UTAE_TEST_DB_USER
Require-Value 'UTAE_TEST_DB_PASSWORD' $env:UTAE_TEST_DB_PASSWORD
if ($env:UTAE_TEST_DB_URL -notmatch '^jdbc:mysql://[^/]+/utae_stage3_test(?:\?.*)?$') {
    throw 'UTAE_TEST_DB_URL must point to the dedicated utae_stage3_test MySQL schema.'
}
Require-Value 'UTAE_MINIO_ENDPOINT' $env:UTAE_MINIO_ENDPOINT
Require-Value 'UTAE_MINIO_ACCESS_KEY' $env:UTAE_MINIO_ACCESS_KEY
Require-Value 'UTAE_MINIO_SECRET_KEY' $env:UTAE_MINIO_SECRET_KEY
Require-Value 'UTAE_MINIO_BUCKET' $env:UTAE_MINIO_BUCKET
if ($env:UTAE_STORAGE_MODE -ne 'minio') { throw 'Set UTAE_STORAGE_MODE=minio in the API process before running this real MinIO acceptance.' }
Require-Value 'UTAE_STAGE3_ALICE_USERNAME' $AliceUsername
Require-Value 'UTAE_STAGE3_ALICE_PASSWORD' $AlicePassword
Require-Value 'UTAE_STAGE3_BOB_USERNAME' $BobUsername
Require-Value 'UTAE_STAGE3_BOB_PASSWORD' $BobPassword
Require-Value 'UTAE_STAGE3_SHARED_SONG_ID' $SharedSongId
Require-Value 'UTAE_STAGE3_SHARED_VERSION_ID' $SharedVersionId
Require-Value 'UTAE_STAGE3_SHARED_ASSET_ID' $SharedAssetId
Require-Value 'UTAE_STAGE3_PRIVATE_SONG_ID' $PrivateSongId
Require-Value 'UTAE_STAGE3_PRIVATE_VERSION_ID' $PrivateVersionId
Require-Value 'UTAE_STAGE3_PRIVATE_ASSET_ID' $PrivateAssetId

function Invoke-Api($Session, [string]$Path, [string]$Method = 'GET', [hashtable]$Headers = @{}, $Body = $null) {
    $params = @{ Uri = "$ApiBaseUrl$Path"; Method = $Method; WebSession = $Session; Headers = $Headers; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = ($Body | ConvertTo-Json -Compress)
    }
    try {
        $response = Invoke-WebRequest @params
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Headers = $response.Headers; Body = $response.Content }
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        if ($response.GetType().FullName -eq 'System.Net.Http.HttpResponseMessage') {
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            $headers = @{}
            foreach ($header in $response.Headers) { $headers[$header.Key] = ($header.Value -join ', ') }
            foreach ($header in $response.Content.Headers) { $headers[$header.Key] = ($header.Value -join ', ') }
        } else {
            $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
            try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
            $headers = $response.Headers
        }
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Headers = $headers; Body = $body }
    }
}

function Assert-Status($Response, [int]$Expected, [string]$Label) {
    if ($Response.Status -ne $Expected) {
        throw "$Label expected HTTP $Expected, got $($Response.Status): $($Response.Body)"
    }
}

function Json($Response, [string]$Label) {
    try { return $Response.Body | ConvertFrom-Json } catch { throw "$Label did not return JSON: $($Response.Body)" }
}

Write-Host '== Stage 3 isolated Flyway migration ==' -ForegroundColor Cyan
& mvn -f backend/pom.xml -Pmysql-it verify
if ($LASTEXITCODE -ne 0) { throw "Flyway/MySQL verification failed with exit code $LASTEXITCODE." }

Write-Host '== Stage 3 API, authorization and asset checks ==' -ForegroundColor Cyan
$alice = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$bob = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$anonymous = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

$csrf = Invoke-Api $alice '/api/auth/csrf'
Assert-Status $csrf 200 'Alice CSRF'
$csrfData = Json $csrf 'Alice CSRF'
$token = $csrfData.data.token
Require-Value 'CSRF response token' $token

$login = Invoke-Api $alice '/api/auth/login' 'POST' @{ 'X-CSRF-TOKEN' = $token } @{ username = $AliceUsername; password = $AlicePassword }
Assert-Status $login 200 'Alice login'
$me = Json (Invoke-Api $alice '/api/me') 'Alice /api/me'
if ($me.code -ne 'OK' -or $me.data.username -ne $AliceUsername) { throw 'Alice session did not resolve to the server-side user identity.' }
$privateManifest = Invoke-Api $alice "/api/songs/$PrivateSongId/manifest?versionId=$PrivateVersionId"
Assert-Status $privateManifest 200 'Alice private manifest'

$library = Json (Invoke-Api $alice '/api/songs?scope=library&page=0&size=100') 'Alice shared catalog'
if ($library.code -ne 'OK' -or @($library.data.items | Where-Object songId -eq $SharedSongId).Count -eq 0) {
    throw 'Shared song was not returned by the library API.'
}
Assert-Status (Invoke-Api $alice "/api/songs/$SharedSongId") 200 'Shared song detail'
$mine = Json (Invoke-Api $alice '/api/songs?scope=mine&page=0&size=100') 'Alice private catalog'
if ($mine.code -ne 'OK' -or @($mine.data.items | Where-Object songId -eq $PrivateSongId).Count -eq 0) {
    throw 'Alice private song was not returned by the user-scoped catalog API.'
}
$versions = Json (Invoke-Api $alice "/api/songs/$SharedSongId/versions") 'Shared song versions'
if ($versions.code -ne 'OK' -or @($versions.data | Where-Object versionId -eq $SharedVersionId).Count -eq 0) {
    throw 'Published shared song version was not returned by the versions API.'
}
Assert-Status (Invoke-Api $alice "/api/songs/$SharedSongId/versions/$SharedVersionId") 200 'Shared version detail'

$sharedManifest = Invoke-Api $alice "/api/songs/$SharedSongId/manifest?versionId=$SharedVersionId"
Assert-Status $sharedManifest 200 'Shared manifest'
if ($sharedManifest.Body -match 'object[_-]?key|s3://|minio') { throw 'Manifest contains an internal object-store reference.' }
$sharedJson = Json $sharedManifest 'Shared manifest'
$audio = $sharedJson.data.playerSong.audio
foreach ($property in $audio.PSObject.Properties) {
    if ([string]::IsNullOrWhiteSpace($property.Value.src) -or $property.Value.src -notmatch '^/api/assets/[^?]+\?versionId=') {
        throw "Audio rate $($property.Name) is not mapped to an authorized asset URL."
    }
}

$asset = Invoke-Api $alice "/api/assets/$SharedAssetId`?versionId=$SharedVersionId" 'GET' @{ Range = 'bytes=0-15' }
Assert-Status $asset 206 'Alice Range asset'
if ($asset.Headers['Content-Range'] -notmatch '^bytes 0-15/') { throw "Unexpected Content-Range: $($asset.Headers['Content-Range'])" }
if ($asset.Headers['Accept-Ranges'] -ne 'bytes') { throw 'Asset response did not advertise byte ranges.' }
if ($asset.Headers['Cache-Control'] -notmatch 'no-store') { throw 'Authorized asset response is missing the private no-store cache policy.' }

$head = Invoke-Api $alice "/api/assets/$SharedAssetId`?versionId=$SharedVersionId" 'HEAD'
Assert-Status $head 200 'Alice HEAD asset'
if ($head.Headers['Content-Length'] -le 0) { throw 'HEAD did not return a positive asset length.' }
$privateAsset = Invoke-Api $alice "/api/assets/$PrivateAssetId`?versionId=$PrivateVersionId" 'GET' @{ Range = 'bytes=0-15' }
Assert-Status $privateAsset 206 'Alice private Range asset'
if ($privateAsset.Headers['Content-Length'] -ne '16') { throw 'Private asset Range response did not return the requested 16 bytes.' }

$bobCsrf = Invoke-Api $bob '/api/auth/csrf'
Assert-Status $bobCsrf 200 'Bob CSRF'
$bobToken = (Json $bobCsrf 'Bob CSRF').data.token
$bobLogin = Invoke-Api $bob '/api/auth/login' 'POST' @{ 'X-CSRF-TOKEN' = $bobToken } @{ username = $BobUsername; password = $BobPassword }
Assert-Status $bobLogin 200 'Bob login'
$bobShared = Invoke-Api $bob "/api/songs/$SharedSongId/manifest?versionId=$SharedVersionId"
Assert-Status $bobShared 200 'Bob shared manifest'
$bobMine = Json (Invoke-Api $bob '/api/songs?scope=mine&page=0&size=100') 'Bob private catalog'
if ($bobMine.code -ne 'OK' -or @($bobMine.data.items | Where-Object songId -eq $PrivateSongId).Count -ne 0) {
    throw 'Alice private song leaked into Bob user-scoped catalog results.'
}

$bobPrivate = Invoke-Api $bob "/api/songs/$PrivateSongId/manifest?versionId=$PrivateVersionId"
Assert-Status $bobPrivate 404 'Bob private manifest denial'
$anonymousPrivate = Invoke-Api $anonymous "/api/songs/$PrivateSongId/manifest?versionId=$PrivateVersionId"
Assert-Status $anonymousPrivate 404 'Anonymous private manifest denial'
$bobAsset = Invoke-Api $bob "/api/assets/$PrivateAssetId`?versionId=$PrivateVersionId"
Assert-Status $bobAsset 404 'Bob private asset denial'
$anonymousAsset = Invoke-Api $anonymous "/api/assets/$PrivateAssetId`?versionId=$PrivateVersionId"
Assert-Status $anonymousAsset 404 'Anonymous private asset denial'

Write-Host 'PASS: MySQL Flyway, CSRF session, shared/private authorization, manifest projection, MinIO-backed GET/HEAD and Range.' -ForegroundColor Green
