package com.utae.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.utae.common.ApiException;
import java.util.Map;
import java.util.List;
import java.util.function.UnaryOperator;
import org.springframework.stereotype.Component;
import static com.utae.catalog.Rows.*;

/** Map an immutable schema-1 snapshot, preserving seconds and all playback metadata. */
@Component
public class ManifestMapper {
    private final ObjectMapper json;
    public ManifestMapper(ObjectMapper json) { this.json = json; }

    public ObjectNode map(SongRow song, VersionRow version, List<AssetRow> assets) {
        Map<String, String> urls = new java.util.HashMap<>();
        for (var a : assets) urls.put(a.sourcePath(), "/api/assets/" + a.id() + "?versionId=" + version.id());
        try {
            var snapshot = json.readTree(version.manifestJson());
            ObjectNode player = projectSong(snapshot.path("playerSong"), path -> {
                if (!urls.containsKey(path)) throw invalid();
                return urls.get(path);
            });
            if (!player.path("id").isTextual() || player.path("id").asText().isBlank()) throw invalid();
            ObjectNode chunks = mapChunks(snapshot.path("playerChunks"), path -> {
                if (!urls.containsKey(path)) throw invalid();
                return urls.get(path);
            });
            var result = json.createObjectNode();
            result.put("songId", song.id()).put("versionId", version.id())
                .put("packageVersion", version.packageVersion()).put("schemaVersion", version.schemaVersion())
                .put("visibility", song.visibility()).put("lifecycleStatus", song.lifecycleStatus());
            result.set("playerSong", player); result.set("playerChunks", chunks);
            return result;
        } catch (java.io.IOException | IllegalArgumentException e) { throw invalid(); }
    }

    public ObjectNode projectSong(JsonNode source, UnaryOperator<String> asset) {
        ObjectNode song = pick(source, "schemaVersion", "id", "title", "artist", "duration");
        if (song.path("schemaVersion").asInt() != 1 || !song.path("duration").isNumber()
                || song.path("duration").asDouble() <= 0 || !source.path("lines").isArray()
                || source.path("lines").isEmpty()) throw invalid();
        ObjectNode audio = json.createObjectNode();
        if (!source.path("audio").isObject()) throw invalid();
        source.path("audio").fields().forEachRemaining(rateEntry -> {
            if (!rateEntry.getValue().isObject()) throw invalid();
            ObjectNode entry = ((ObjectNode) rateEntry.getValue()).deepCopy();
            entry.put("src", asset.apply(required(entry, "src"))); audio.set(rateEntry.getKey(), entry);
        });
        for (String rate : List.of("1", "0.75", "0.5")) if (!audio.has(rate)) throw invalid();
        song.set("audio", audio);
        var lines = json.createArrayNode();
        for (var sourceLine : source.path("lines")) {
            var line = pick(sourceLine, "id", "jp", "section", "start", "end", "clipStart", "clipEnd", "translation");
            var tokens = json.createArrayNode();
            if (!sourceLine.path("tokens").isArray() || sourceLine.path("tokens").isEmpty()) throw invalid();
            for (var token : sourceLine.path("tokens")) tokens.add(pick(token, "jp", "kana", "romaji", "start", "end", "ruby", "readingParts"));
            line.set("tokens", tokens);
            if (sourceLine.has("narration")) {
                var narration = json.createObjectNode();
                for (String speed : List.of("normal", "slow", "verySlow")) {
                    var voice = pick(sourceLine.path("narration").path(speed), "src", "duration", "tokens");
                    voice.put("src", asset.apply(required(voice, "src"))); narration.set(speed, voice);
                }
                line.set("narration", narration);
            }
            lines.add(line);
        }
        song.set("lines", lines);
        return song;
    }

    public ObjectNode mapChunks(JsonNode source, UnaryOperator<String> asset) {
        var result = json.createObjectNode();
        if (source.isMissingNode() || source.isNull()) return result;
        if (!source.isObject()) throw invalid();
        source.fields().forEachRemaining(entry -> {
            var manifest = pick(entry.getValue(), "sampleRate", "frames");
            var chunks = json.createArrayNode();
            if (!entry.getValue().path("chunks").isArray()) throw invalid();
            for (var item : entry.getValue().path("chunks")) {
                var chunk = pick(item, "src", "first", "last", "decodedFrames", "trimStart", "postRoll", "crossfadeFrames");
                chunk.put("src", asset.apply(required(chunk, "src")));
                if (item.has("parts")) {
                    var parts = json.createArrayNode();
                    for (var part : item.path("parts")) parts.add(asset.apply(part.asText()));
                    chunk.set("parts", parts);
                }
                chunks.add(chunk);
            }
            manifest.set("chunks", chunks); result.set(asset.apply(entry.getKey()), manifest);
        });
        return result;
    }

    private ObjectNode pick(JsonNode source, String... fields) {
        if (!source.isObject()) throw invalid();
        ObjectNode result = json.createObjectNode();
        for (String field : fields) if (source.has(field)) result.set(field, source.get(field).deepCopy());
        return result;
    }
    private static String required(JsonNode source, String field) {
        if (!source.path(field).isTextual() || source.path(field).asText().isBlank()) throw invalid();
        return source.path(field).asText();
    }
    private static ApiException invalid() { return new ApiException(409, "PACKAGE_INVALID", "歌曲版本或资产映射不完整。"); }
}
