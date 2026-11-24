package com.utae.catalog;

import java.util.List;
import org.apache.ibatis.annotations.Arg;
import org.apache.ibatis.annotations.ConstructorArgs;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import static com.utae.catalog.Rows.*;

/** Explicit scoped SQL only; never expose unscoped BaseMapper CRUD to services. */
@Mapper
public interface CatalogMapper {
    String ACCESS = "s.lifecycle_status='ACTIVE' AND s.deleted_at IS NULL AND "
        + "(s.visibility='SHARED' OR EXISTS (SELECT 1 FROM song_ownership o WHERE o.song_id=s.id AND o.user_id=#{userId}))";
    String VISIBLE = ACCESS + " AND EXISTS (SELECT 1 FROM song_package_version v WHERE v.id=s.current_published_version_id AND v.song_id=s.id AND v.status='PUBLISHED')";
    String FILTER = "<if test=\"scope == 'mine'\"> AND EXISTS (SELECT 1 FROM song_ownership m WHERE m.song_id=s.id AND m.user_id=#{userId})</if>"
        + "<if test=\"scope == 'library'\"> AND s.visibility='SHARED'</if>"
        + " AND (LOCATE(#{keyword},s.title)>0 OR LOCATE(#{keyword},s.artist)>0) ";

    @Select("<script>SELECT s.id,s.title,s.artist,s.duration_ms,s.visibility,s.lifecycle_status,s.current_published_version_id FROM song s WHERE "
        + VISIBLE + FILTER + " ORDER BY s.id LIMIT #{size} OFFSET #{offset}</script>")
    @ConstructorArgs({
        @Arg(column = "id", javaType = String.class, id = true),
        @Arg(column = "title", javaType = String.class),
        @Arg(column = "artist", javaType = String.class),
        @Arg(column = "duration_ms", javaType = long.class),
        @Arg(column = "visibility", javaType = String.class),
        @Arg(column = "lifecycle_status", javaType = String.class),
        @Arg(column = "current_published_version_id", javaType = String.class)
    })
    List<SongRow> list(String userId, String scope, String keyword, int size, long offset);

    @Select("<script>SELECT COUNT(*) FROM song s WHERE " + VISIBLE + FILTER + "</script>")
    long count(String userId, String scope, String keyword);

    @ConstructorArgs({
        @Arg(column = "id", javaType = String.class, id = true),
        @Arg(column = "title", javaType = String.class),
        @Arg(column = "artist", javaType = String.class),
        @Arg(column = "duration_ms", javaType = long.class),
        @Arg(column = "visibility", javaType = String.class),
        @Arg(column = "lifecycle_status", javaType = String.class),
        @Arg(column = "current_published_version_id", javaType = String.class)
    })
    @Select("SELECT s.id,s.title,s.artist,s.duration_ms,s.visibility,s.lifecycle_status,s.current_published_version_id FROM song s WHERE s.id=#{songId} AND " + VISIBLE)
    SongRow song(String songId, String userId);

    @ConstructorArgs({
        @Arg(column = "id", javaType = String.class, id = true),
        @Arg(column = "song_id", javaType = String.class),
        @Arg(column = "package_version", javaType = String.class),
        @Arg(column = "schema_version", javaType = int.class),
        @Arg(column = "status", javaType = String.class),
        @Arg(column = "manifest_json", javaType = String.class),
        @Arg(column = "sha256", javaType = String.class),
        @Arg(column = "published_at", javaType = java.time.LocalDateTime.class)
    })
    @Select("SELECT v.id,v.song_id,v.package_version,v.schema_version,v.status,v.manifest_json,v.sha256,v.published_at FROM song_package_version v JOIN song s ON s.id=v.song_id WHERE s.id=#{songId} AND v.status='PUBLISHED' AND " + VISIBLE + " ORDER BY v.published_at DESC,v.id")
    List<VersionRow> versions(String songId, String userId);

    @ConstructorArgs({
        @Arg(column = "id", javaType = String.class, id = true),
        @Arg(column = "song_id", javaType = String.class),
        @Arg(column = "package_version", javaType = String.class),
        @Arg(column = "schema_version", javaType = int.class),
        @Arg(column = "status", javaType = String.class),
        @Arg(column = "manifest_json", javaType = String.class),
        @Arg(column = "sha256", javaType = String.class),
        @Arg(column = "published_at", javaType = java.time.LocalDateTime.class)
    })
    @Select("SELECT v.id,v.song_id,v.package_version,v.schema_version,v.status,v.manifest_json,v.sha256,v.published_at FROM song_package_version v JOIN song s ON s.id=v.song_id WHERE s.id=#{songId} AND v.id=#{versionId} AND v.status='PUBLISHED' AND " + VISIBLE)
    VersionRow version(String songId, String versionId, String userId);

    @ConstructorArgs({
        @Arg(column = "asset_id", javaType = String.class, id = true),
        @Arg(column = "asset_object_key", javaType = String.class),
        @Arg(column = "asset_sha256", javaType = String.class),
        @Arg(column = "asset_size_bytes", javaType = long.class),
        @Arg(column = "asset_media_type", javaType = String.class),
        @Arg(column = "asset_source_path", javaType = String.class),
        @Arg(column = "asset_role", javaType = String.class)
    })
    @Select("SELECT a.id AS asset_id,a.object_key AS asset_object_key,a.sha256 AS asset_sha256,a.size_bytes AS asset_size_bytes,a.media_type AS asset_media_type,p.source_path AS asset_source_path,p.role AS asset_role FROM stored_asset a JOIN package_version_asset p ON p.asset_id=a.id JOIN song_package_version v ON v.id=p.version_id JOIN song s ON s.id=v.song_id WHERE v.id=#{versionId} AND s.id=#{songId} AND v.status='PUBLISHED' AND " + VISIBLE)
    List<AssetRow> assets(String songId, String versionId, String userId);

    @ConstructorArgs({
        @Arg(column = "asset_id", javaType = String.class, id = true),
        @Arg(column = "asset_object_key", javaType = String.class),
        @Arg(column = "asset_sha256", javaType = String.class),
        @Arg(column = "asset_size_bytes", javaType = long.class),
        @Arg(column = "asset_media_type", javaType = String.class),
        @Arg(column = "asset_source_path", javaType = String.class),
        @Arg(column = "asset_role", javaType = String.class)
    })
    @Select("SELECT a.id AS asset_id,a.object_key AS asset_object_key,a.sha256 AS asset_sha256,a.size_bytes AS asset_size_bytes,a.media_type AS asset_media_type,p.source_path AS asset_source_path,p.role AS asset_role FROM stored_asset a JOIN package_version_asset p ON p.asset_id=a.id JOIN song_package_version v ON v.id=p.version_id JOIN song s ON s.id=v.song_id WHERE a.id=#{assetId} AND v.id=#{versionId} AND v.status='PUBLISHED' AND " + VISIBLE + " LIMIT 1")
    AssetRow asset(String assetId, String versionId, String userId);
}
