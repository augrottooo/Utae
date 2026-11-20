package com.utae.catalog;

import java.util.List;
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
    List<SongRow> list(String userId, String scope, String keyword, int size, long offset);

    @Select("<script>SELECT COUNT(*) FROM song s WHERE " + VISIBLE + FILTER + "</script>")
    long count(String userId, String scope, String keyword);

    @Select("SELECT s.id,s.title,s.artist,s.duration_ms,s.visibility,s.lifecycle_status,s.current_published_version_id FROM song s WHERE s.id=#{songId} AND " + VISIBLE)
    SongRow song(String songId, String userId);

    @Select("SELECT v.* FROM song_package_version v JOIN song s ON s.id=v.song_id WHERE s.id=#{songId} AND v.status='PUBLISHED' AND " + VISIBLE + " ORDER BY v.published_at DESC,v.id")
    List<VersionRow> versions(String songId, String userId);

    @Select("SELECT v.* FROM song_package_version v JOIN song s ON s.id=v.song_id WHERE s.id=#{songId} AND v.id=#{versionId} AND v.status='PUBLISHED' AND " + VISIBLE)
    VersionRow version(String songId, String versionId, String userId);

    @Select("SELECT a.*,p.source_path,p.role FROM stored_asset a JOIN package_version_asset p ON p.asset_id=a.id JOIN song_package_version v ON v.id=p.version_id JOIN song s ON s.id=v.song_id WHERE v.id=#{versionId} AND s.id=#{songId} AND v.status='PUBLISHED' AND " + VISIBLE)
    List<AssetRow> assets(String songId, String versionId, String userId);

    @Select("SELECT a.*,p.source_path,p.role FROM stored_asset a JOIN package_version_asset p ON p.asset_id=a.id JOIN song_package_version v ON v.id=p.version_id JOIN song s ON s.id=v.song_id WHERE a.id=#{assetId} AND v.id=#{versionId} AND v.status='PUBLISHED' AND " + VISIBLE + " LIMIT 1")
    AssetRow asset(String assetId, String versionId, String userId);
}
