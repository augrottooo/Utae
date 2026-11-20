package com.utae.catalog;

public final class Rows {
    private Rows() {}
    public record SongRow(String id, String title, String artist, long durationMs, String visibility,
                          String lifecycleStatus, String currentPublishedVersionId) {}
    public record VersionRow(String id, String songId, String packageVersion, int schemaVersion,
                             String status, String manifestJson, String sha256, java.time.LocalDateTime publishedAt) {}
    public record AssetRow(String id, String objectKey, String sha256, long sizeBytes,
                           String mediaType, String sourcePath, String role) {}
}
