package com.utae.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.utae.common.ApiException;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.utae.catalog.Rows.*;

@Service
@Transactional(readOnly = true)
public class CatalogService {
    private final CatalogMapper repository;
    private final ManifestMapper manifests;
    public CatalogService(CatalogMapper repository, ManifestMapper manifests) {
        this.repository = repository; this.manifests = manifests;
    }
    public Map<String, Object> list(String userId, String scope, String keyword, int page, int size) {
        if (!List.of("library", "mine").contains(scope)) throw new ApiException(400, "INVALID_SCOPE", "未知曲库范围。");
        if (scope.equals("mine") && userId == null) throw new ApiException(401, "UNAUTHENTICATED", "请先登录。");
        var items = repository.list(userId, scope, keyword, size, (long) page * size).stream().map(s -> summary(s, userId)).toList();
        return Map.of("items", items, "page", page, "size", size, "total", repository.count(userId, scope, keyword));
    }
    public SongRow song(String songId, String userId) {
        var song = repository.song(songId, userId);
        if (song == null) throw ApiException.missing();
        return song;
    }
    public VersionRow version(String songId, String versionId, String userId) {
        var song = song(songId, userId);
        var version = repository.version(songId, versionId == null ? song.currentPublishedVersionId() : versionId, userId);
        if (version == null) throw ApiException.missing();
        return version;
    }
    public Map<String, Object> detail(String songId, String userId) { return summary(song(songId, userId), userId); }
    private Map<String, Object> summary(SongRow song, String userId) {
        var v = version(song.id(), null, userId);
        return Map.of("songId", song.id(), "title", song.title(), "artist", song.artist(), "durationMs", song.durationMs(),
            "visibility", song.visibility(), "lifecycleStatus", song.lifecycleStatus(), "versionId", v.id(),
            "packageVersion", v.packageVersion(), "schemaVersion", v.schemaVersion());
    }
    public List<Map<String, Object>> versions(String songId, String userId) {
        song(songId, userId);
        return repository.versions(songId, userId).stream().map(this::versionDto).toList();
    }
    public Map<String, Object> versionDto(VersionRow version) {
        return Map.of("versionId", version.id(), "songId", version.songId(), "packageVersion", version.packageVersion(),
            "schemaVersion", version.schemaVersion(), "status", version.status(), "sha256", version.sha256(), "publishedAt", version.publishedAt());
    }
    public JsonNode manifest(String songId, String versionId, String userId) {
        var song = song(songId, userId);
        var version = version(songId, versionId, userId);
        return manifests.map(song, version, repository.assets(songId, version.id(), userId));
    }
    public List<Map<String, Object>> assets(String songId, String versionId, String userId) {
        version(songId, versionId, userId);
        return repository.assets(songId, versionId, userId).stream().map(a -> Map.<String, Object>of(
            "assetId", a.id(), "role", a.role(), "sizeBytes", a.sizeBytes(), "mediaType", a.mediaType(),
            "url", "/api/assets/" + a.id() + "?versionId=" + versionId)).toList();
    }
    public JsonNode lyrics(String songId, String versionId, String userId) {
        var lines = manifest(songId, versionId, userId).path("playerSong").path("lines").deepCopy();
        for (var line : lines) {
            var object = (com.fasterxml.jackson.databind.node.ObjectNode) line;
            object.put("startMs", Math.round(line.path("start").asDouble() * 1000));
            object.put("endMs", Math.round(line.path("end").asDouble() * 1000));
            object.remove(List.of("start", "end", "clipStart", "clipEnd", "narration"));
            for (var token : object.path("tokens")) {
                var t = (com.fasterxml.jackson.databind.node.ObjectNode) token;
                t.put("startMs", Math.round(t.path("start").asDouble() * 1000));
                t.put("endMs", Math.round(t.path("end").asDouble() * 1000)); t.remove(List.of("start", "end"));
            }
        }
        return lines;
    }
}
