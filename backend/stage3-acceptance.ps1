param(
    [string]$ApiBaseUrl = $env:UTAE_STAGE3_API_BASE_URL,
    [string]$AliceUsername = $env:UTAE_STAGE3_ALICE_USERNAME,
    [string]$AlicePassword = $env:UTAE_STAGE3_ALICE_PASSWORD,
    [string]$BobUsername = $env:UTAE_STAGE3_BOB_USERNAME,
    [string]$BobPassword = $env:UTAE_STAGE3_BOB_PASSWORD,
    [string]$SharedSongId = $env:UTAE_STAGE3_SHARED_SONG_ID,
    [string]$SharedVersionId = $env:UTAE_STAGE3_SHARED_VERSION_ID,
    [string]$SharedAssetId = $env:UTAE_STAGE3_SHARED_ASSET_ID,
    [string]$SharedAssetSha256 = $env:UTAE_STAGE3_SHARED_ASSET_SHA256,
    [string]$PrivateSongId = $env:UTAE_STAGE3_PRIVATE_SONG_ID,
    [string]$PrivateVersionId = $env:UTAE_STAGE3_PRIVATE_VERSION_ID,
    [string]$PrivateAssetId = $env:UTAE_STAGE3_PRIVATE_ASSET_ID,
    [string]$PrivateAssetSha256 = $env:UTAE_STAGE3_PRIVATE_ASSET_SHA256
)

$ErrorActionPreference = 'Stop'

function Require-Value([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing $Name. Refusing to run without dedicated Stage 3 fixture configuration."
    }
}

if ($ApiBaseUrl -cne 'http://127.0.0.1:18080') {
    throw 'Set UTAE_STAGE3_API_BASE_URL=http://127.0.0.1:18080 for the dedicated fixture API.'
}
if ($env:UTAE_STORAGE_MODE -cne 'minio' -or $env:UTAE_MINIO_BUCKET -cne 'utae-stage3-test') {
    throw 'Run the fixture API with UTAE_STORAGE_MODE=minio and UTAE_MINIO_BUCKET=utae-stage3-test, and repeat these two values here.'
}
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

if ($AliceUsername -ieq $BobUsername -or $SharedSongId -ieq $PrivateSongId -or
    $SharedVersionId -ieq $PrivateVersionId -or $SharedAssetId -ieq $PrivateAssetId) {
    throw 'The fixture must have distinct users, songs, versions and normal-speed assets.'
}
foreach ($fixtureId in @($SharedSongId, $SharedVersionId, $SharedAssetId, $PrivateSongId, $PrivateVersionId, $PrivateAssetId)) {
    if ($fixtureId -cnotmatch '\A[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}\z') { throw 'Invalid fixture ID.' }
}
if ($SharedAssetSha256 -notmatch '\A[0-9a-f]{64}\z' -or $PrivateAssetSha256 -notmatch '\A[0-9a-f]{64}\z') {
    throw 'Set UTAE_STAGE3_SHARED_ASSET_SHA256 and UTAE_STAGE3_PRIVATE_ASSET_SHA256 from the WAV fixtures.'
}

Add-Type -AssemblyName System.Net.Http

function New-ApiClient {
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.BaseAddress = [uri]$ApiBaseUrl
    $client.Timeout = [timespan]::FromSeconds(15)
    $client.MaxResponseContentBufferSize = 4194304
    return $client
}

function Invoke-Api($Session, [string]$Path, [string]$Method = 'GET', [hashtable]$Headers = @{}, $Body = $null) {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Path)
    try {
        foreach ($name in $Headers.Keys) { $request.Headers.Add($name, [string]$Headers[$name]) }
        if ($null -ne $Body) {
            $request.Content = [System.Net.Http.StringContent]::new(
                ($Body | ConvertTo-Json -Compress), [System.Text.Encoding]::UTF8, 'application/json')
        }
        $response = $Session.SendAsync($request).GetAwaiter().GetResult()
        try {
            $receivedHeaders = @{}
            foreach ($header in $response.Headers) { $receivedHeaders[$header.Key] = ($header.Value -join ', ') }
            foreach ($header in $response.Content.Headers) { $receivedHeaders[$header.Key] = ($header.Value -join ', ') }
            $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
            $isJson = $receivedHeaders['Content-Type'] -match '^application/json(?:;|$)'
            return [pscustomobject]@{
                Status = [int]$response.StatusCode; Headers = $receivedHeaders; Bytes = $bytes
                Body = if ($isJson) { [System.Text.Encoding]::UTF8.GetString($bytes) } else { $null }
            }
        } finally { $response.Dispose() }
    } finally { $request.Dispose() }
}

function Assert-Status($Response, [int]$Expected, [string]$Label) {
    if ($Response.Status -ne $Expected) {
        throw "$Label expected HTTP $Expected, got $($Response.Status)."
    }
}

function Json($Response, [string]$Label) {
    if ([string]::IsNullOrWhiteSpace($Response.Body)) { throw "$Label did not return JSON." }
    try { return $Response.Body | ConvertFrom-Json } catch { throw "$Label did not return valid JSON." }
}

function Assert-NoStorageReference($Node) {
    if ($Node -is [string]) {
        if ($Node -match 'stage3-fixture/|s3://|https?://') { throw 'Manifest contains a storage path or external URL.' }
    } elseif ($Node -is [array]) {
        foreach ($item in $Node) { Assert-NoStorageReference $item }
    } elseif ($Node -is [pscustomobject]) {
        foreach ($property in $Node.PSObject.Properties) {
            if ($property.Name -match 'object[_-]?key|stage3-fixture/|s3://|https?://') {
                throw 'Manifest contains a storage field or path.'
            }
            Assert-NoStorageReference $property.Value
        }
    }
}

Write-Host '== Stage 3 API, authorization and asset checks ==' -ForegroundColor Cyan
$alice = New-ApiClient
$bob = New-ApiClient
$anonymous = New-ApiClient

$csrf = Invoke-Api $alice '/api/auth/csrf'
Assert-Status $csrf 200 'Alice CSRF'
$csrfData = Json $csrf 'Alice CSRF'
$token = $csrfData.data.token
Require-Value 'CSRF response token' $token

Assert-Status (Invoke-Api $anonymous '/api/auth/login' 'POST' @{} @{ username = $AliceUsername; password = $AlicePassword }) 403 'Missing CSRF'
$login = Invoke-Api $alice '/api/auth/login' 'POST' @{ 'X-CSRF-TOKEN' = $token } @{ username = $AliceUsername; password = $AlicePassword }
Assert-Status $login 200 'Alice login'
$me = Json (Invoke-Api $alice '/api/me') 'Alice /api/me'
if ($me.code -ne 'OK' -or $me.data.username -ne $AliceUsername) { throw 'Alice session did not resolve to the server-side user identity.' }
Assert-Status (Invoke-Api $alice "/api/songs/$PrivateSongId") 200 'Alice private detail'
Assert-Status (Invoke-Api $alice "/api/songs/$PrivateSongId/versions/$PrivateVersionId") 200 'Alice private version'

$library = Json (Invoke-Api $alice '/api/songs?scope=library&page=0&size=100') 'Alice shared catalog'
if ($library.code -ne 'OK' -or @($library.data.items | Where-Object songId -eq $SharedSongId).Count -eq 0 -or
    @($library.data.items | Where-Object songId -eq $PrivateSongId).Count -ne 0) {
    throw 'Shared catalog must include the shared fixture and exclude the private fixture.'
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

function Check-Manifest([string]$SongId, [string]$VersionId, [string]$AssetId, [string]$Visibility) {
    $response = Invoke-Api $alice "/api/songs/$SongId/manifest?versionId=$VersionId"
    Assert-Status $response 200 "$Visibility Manifest"
    $manifest = Json $response "$Visibility Manifest"
    Assert-NoStorageReference $manifest
    $player = $manifest.data.playerSong
    if ($manifest.code -cne 'OK' -or $manifest.data.songId -cne $SongId -or $manifest.data.versionId -cne $VersionId -or
        $manifest.data.schemaVersion -ne 1 -or $manifest.data.visibility -cne $Visibility -or
        $player.schemaVersion -ne 1 -or !$player.lines -or !$player.lines[0].tokens[0].romaji) {
        throw "$Visibility Manifest does not contain the expected version and schema-1 lyric data."
    }
    foreach ($rate in @('1', '0.75', '0.5')) {
        $src = $player.audio.$rate.src
        if ($src -cnotmatch ('\A/api/assets/[A-Za-z0-9_-]+\?versionId=' + [regex]::Escape($VersionId) + '\z')) {
            throw "Audio rate $rate does not use an authorized URL for the requested version."
        }
    }
    if ($player.audio.'1'.src -cne "/api/assets/$AssetId`?versionId=$VersionId") { throw 'Unexpected normal-speed fixture asset.' }
}

Check-Manifest $SharedSongId $SharedVersionId $SharedAssetId 'SHARED'
Check-Manifest $PrivateSongId $PrivateVersionId $PrivateAssetId 'PRIVATE'

function Check-Audio([string]$Path, [string]$ExpectedDigest, [string]$Label) {
    $full = Invoke-Api $alice $Path
    Assert-Status $full 200 "$Label full GET"
    $head = Invoke-Api $alice $Path 'HEAD'
    Assert-Status $head 200 "$Label HEAD"
    $range = Invoke-Api $alice $Path 'GET' @{ Range = 'bytes=0-15' }
    Assert-Status $range 206 "$Label Range"
    foreach ($response in @($full, $head, $range)) {
        if ($response.Headers['Accept-Ranges'] -ne 'bytes' -or $response.Headers['Cache-Control'] -notmatch '\bno-store\b') {
            throw "$Label response is missing byte ranges or no-store."
        }
    }
    if ($full.Bytes.Length -lt 16 -or $head.Bytes.Length -ne 0 -or [long]$head.Headers['Content-Length'] -ne $full.Bytes.Length) {
        throw "$Label HEAD did not return the full asset length with an empty body."
    }
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try { $digest = [BitConverter]::ToString($sha256.ComputeHash($full.Bytes)).Replace('-', '') }
    finally { $sha256.Dispose() }
    if ($digest -ine $ExpectedDigest) { throw "$Label bytes do not match the uploaded WAV fixture." }
    if ($range.Headers['Content-Range'] -ne "bytes 0-15/$($full.Bytes.Length)" -or
        $range.Bytes.Length -ne 16 -or
        [BitConverter]::ToString($range.Bytes) -ne [BitConverter]::ToString($full.Bytes, 0, 16)) {
        throw "$Label Range did not return the requested 16 bytes."
    }
}

$sharedAssetPath = "/api/assets/$SharedAssetId`?versionId=$SharedVersionId"
$privateAssetPath = "/api/assets/$PrivateAssetId`?versionId=$PrivateVersionId"
Check-Audio $sharedAssetPath $SharedAssetSha256 'Alice shared asset'
Check-Audio $privateAssetPath $PrivateAssetSha256 'Alice private asset'
Assert-Status (Invoke-Api $alice "/api/assets/$PrivateAssetId`?versionId=$SharedVersionId") 404 'Private asset with wrong version'

$bobCsrf = Invoke-Api $bob '/api/auth/csrf'
Assert-Status $bobCsrf 200 'Bob CSRF'
$bobToken = (Json $bobCsrf 'Bob CSRF').data.token
Require-Value 'Bob CSRF response token' $bobToken
$bobLogin = Invoke-Api $bob '/api/auth/login' 'POST' @{ 'X-CSRF-TOKEN' = $bobToken } @{ username = $BobUsername; password = $BobPassword }
Assert-Status $bobLogin 200 'Bob login'
$bobMe = Json (Invoke-Api $bob '/api/me') 'Bob /api/me'
if ($bobMe.code -ne 'OK' -or $bobMe.data.username -ne $BobUsername -or $bobMe.data.id -eq $me.data.id) {
    throw 'Bob session did not resolve to a separate server-side user identity.'
}
$bobShared = Invoke-Api $bob "/api/songs/$SharedSongId/manifest?versionId=$SharedVersionId"
Assert-Status $bobShared 200 'Bob shared manifest'
Assert-Status (Invoke-Api $bob $sharedAssetPath 'HEAD') 200 'Bob shared asset'
$bobMine = Json (Invoke-Api $bob '/api/songs?scope=mine&page=0&size=100') 'Bob private catalog'
if ($bobMine.code -ne 'OK' -or @($bobMine.data.items | Where-Object songId -eq $PrivateSongId).Count -ne 0) {
    throw 'Alice private song leaked into Bob user-scoped catalog results.'
}

$bobPrivate = Invoke-Api $bob "/api/songs/$PrivateSongId/manifest?versionId=$PrivateVersionId"
Assert-Status $bobPrivate 404 'Bob private manifest denial'
Assert-Status (Invoke-Api $bob "/api/songs/$PrivateSongId") 404 'Bob private song denial'
Assert-Status (Invoke-Api $bob "/api/songs/$PrivateSongId/versions") 404 'Bob private version list denial'
Assert-Status (Invoke-Api $bob "/api/songs/$PrivateSongId/versions/$PrivateVersionId") 404 'Bob private version denial'
Assert-Status (Invoke-Api $bob "/api/songs/$PrivateSongId/versions/$PrivateVersionId/assets") 404 'Bob private asset catalog denial'
$anonymousPrivate = Invoke-Api $anonymous "/api/songs/$PrivateSongId/manifest?versionId=$PrivateVersionId"
Assert-Status $anonymousPrivate 404 'Anonymous private manifest denial'
$bobAsset = Invoke-Api $bob $privateAssetPath 'GET' @{Range = 'bytes=0-15'}
Assert-Status $bobAsset 404 'Bob private asset denial'
Assert-Status (Invoke-Api $bob $privateAssetPath 'HEAD') 404 'Bob private HEAD denial'
$anonymousAsset = Invoke-Api $anonymous $privateAssetPath
Assert-Status $anonymousAsset 404 'Anonymous private asset denial'

$alice.Dispose()
$bob.Dispose()
$anonymous.Dispose()
Write-Host 'PASS: HTTP session, authorization, manifests and asset GET/HEAD/Range matched the fixture. Browser playback is separate.' -ForegroundColor Green
