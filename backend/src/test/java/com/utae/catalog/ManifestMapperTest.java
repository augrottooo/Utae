package com.utae.catalog;
import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import static com.utae.catalog.Rows.*;
class ManifestMapperTest {
    private final ManifestMapper mapper = new ManifestMapper(new ObjectMapper());
    @Test void mapsSoraneSchemaPreservingTimingAndHidingObjectKeys() throws Exception {
        String source = """
            {"playerSong":{"schemaVersion":1,"id":"song-a","title":"歌","artist":"者","duration":8.5,
             "audio":{"1":{"src":"audio.wav"},"0.75":{"src":"slow.wav"},"0.5":{"src":"slower.wav"},"0.25":{"src":"ultra.wav","note":"keep"}},
             "lines":[{"id":"line","jp":"歌","section":"verse","start":1.2,"end":2.3,"translation":"译",
               "tokens":[{"jp":"歌","kana":"うた","romaji":"uta","start":1.2,"end":2.3}]}]},"playerChunks":{}}""";
        var version = new VersionRow("v-a", "song-a", "2026.1", 1, "PUBLISHED", source, "a".repeat(64), null);
        var assets = List.of("audio.wav", "slow.wav", "slower.wav", "ultra.wav").stream().map(path ->
            new AssetRow("asset-" + path, "private/bucket/key", "b".repeat(64), 40, "audio/wav", path, "AUDIO")).toList();
        var result = mapper.map(new SongRow("song-a", "歌", "者", 8500, "SHARED", "ACTIVE", "v-a"), version, assets);
        assertEquals("/api/assets/asset-audio.wav?versionId=v-a", result.path("playerSong").path("audio").path("1").path("src").asText());
        assertEquals(1.2, result.path("playerSong").path("lines").get(0).path("tokens").get(0).path("start").asDouble());
        assertEquals("keep", result.path("playerSong").path("audio").path("0.25").path("note").asText());
        assertFalse(result.toString().contains("private/bucket/key"));
    }
    @Test void missingAssetMappingFailsClosed() {
        var version = new VersionRow("v-a", "song-a", "1", 1, "PUBLISHED", "{\"playerSong\":{},\"playerChunks\":{}}", "a".repeat(64), null);
        assertEquals("PACKAGE_INVALID", assertThrows(com.utae.common.ApiException.class,
            () -> mapper.map(new SongRow("song-a", "a", "b", 1000, "SHARED", "ACTIVE", "v-a"), version, List.of())).code);
    }
}
